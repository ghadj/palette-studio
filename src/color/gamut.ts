/**
 * Gamut mapping (spec 3.3 "Gamut", 3.5, 7.9). All gamut checks and clamping live here, so a
 * Display-P3 target can be added later. v1 targets sRGB only.
 */
import type { GamutHandling } from "../types";
import type { Oklab, Oklch, Rgb } from "./convert";

/** Channel tolerance: rounding in the OKLab round trip stays well below it. */
const EPSILON = 1e-6;
/** The binary search on chroma stops once the bracket is this narrow (plan D3). */
const CHROMA_STEP = 1e-4;

/** The sRGB transfer function, signed, as culori's `convertLrgbToRgb` writes it. */
const encode = (c: number): number => {
  const abs = Math.abs(c);
  if (abs > 0.0031308) return (Math.sign(c) || 1) * (1.055 * abs ** (1 / 2.4) - 0.055);
  return c * 12.92;
};

/**
 * OKLab to sRGB (unclamped) with the same constants and steps as culori's `oklab` → `rgb`, so the
 * result is the same to the last bit, but without culori's objects and dispatch: the gamut search
 * and the gradient bake call it hundreds of times per frame (spec 7.7).
 */
function oklabRgb(l: number, a: number, b: number): Rgb {
  const L = (l + 0.3963377773761749 * a + 0.2158037573099136 * b) ** 3;
  const M = (l - 0.1055613458156586 * a - 0.0638541728258133 * b) ** 3;
  const S = (l - 0.0894841775298119 * a - 1.2914855480194092 * b) ** 3;
  return {
    r: encode(4.0767416360759574 * L - 3.3077115392580616 * M + 0.2309699031821044 * S),
    g: encode(-1.2684379732850317 * L + 2.6097573492876887 * M - 0.3413193760026573 * S),
    b: encode(-0.0041960761386756 * L - 0.7034186179359362 * M + 1.7076146940746117 * S),
  };
}

/** OKLCH to sRGB (unclamped), as culori's `oklch` → `oklab` → `rgb`. */
function oklchRgb(color: Oklch): Rgb {
  const angle = (color.h / 180) * Math.PI;
  const a = color.c ? color.c * Math.cos(angle) : 0;
  const b = color.c ? color.c * Math.sin(angle) : 0;
  return oklabRgb(color.l, a, b);
}

/** True when the color's sRGB channels all lie within 0 to 1. */
export function inGamut(color: Oklch): boolean {
  const { r, g, b } = oklchRgb(color);
  return (
    r >= -EPSILON &&
    r <= 1 + EPSILON &&
    g >= -EPSILON &&
    g <= 1 + EPSILON &&
    b >= -EPSILON &&
    b <= 1 + EPSILON
  );
}

/**
 * Reduces OKLCH chroma until the color fits sRGB, keeping L and H (plan D3): a binary search on C
 * to 1e-4 that returns the in-gamut end of the bracket. A color already in gamut comes back as is.
 * When even C = 0 doesn't fit (L outside 0 to 1), the result is that gray. `step` narrows the
 * search: a gradient needs a smooth result along t, and a 1e-4 bracket moves a channel near the
 * boundary by up to about 1/255 from one sample to the next (M4-T10).
 */
export function clampChroma(color: Oklch, step = CHROMA_STEP): Oklch {
  if (inGamut(color)) return color;
  // The hue is fixed, so its cosine and sine are worked out once; each step then tests linear
  // sRGB against the bounds that `inGamut`'s ±EPSILON maps to, which is the same test, since the
  // transfer function is increasing.
  const angle = (color.h / 180) * Math.PI;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const fits = (c: number): boolean => fitsLinear(color.l, c ? c * cos : 0, c ? c * sin : 0);
  let low = 0;
  let high = color.c;
  if (!fits(low)) return { ...color, c: 0 };
  while (high - low > step) {
    const mid = (low + high) / 2;
    if (fits(mid)) low = mid;
    else high = mid;
  }
  return { ...color, c: low };
}

/** `inGamut`'s bounds in linear sRGB: the transfer function's inverse at -EPSILON and 1 + EPSILON. */
const LINEAR_LOW = -EPSILON / 12.92;
const LINEAR_HIGH = ((1 + EPSILON + 0.055) / 1.055) ** 2.4;

/** True when OKLab (l, a, b) lies in sRGB, within `inGamut`'s tolerance. */
function fitsLinear(l: number, a: number, b: number): boolean {
  const L = (l + 0.3963377773761749 * a + 0.2158037573099136 * b) ** 3;
  const M = (l - 0.1055613458156586 * a - 0.0638541728258133 * b) ** 3;
  const S = (l - 0.0894841775298119 * a - 1.2914855480194092 * b) ** 3;
  const r = 4.0767416360759574 * L - 3.3077115392580616 * M + 0.2309699031821044 * S;
  const g = -1.2684379732850317 * L + 2.6097573492876887 * M - 0.3413193760026573 * S;
  const bl = -0.0041960761386756 * L - 0.7034186179359362 * M + 1.7076146940746117 * S;
  return (
    r >= LINEAR_LOW &&
    r <= LINEAR_HIGH &&
    g >= LINEAR_LOW &&
    g <= LINEAR_HIGH &&
    bl >= LINEAR_LOW &&
    bl <= LINEAR_HIGH
  );
}

/** Clips each sRGB channel to 0 to 1: the Clamp gamut handling (spec 4.3; plan D12). */
export function clipRgb(c: Rgb): Rgb {
  const clip = (v: number): number => Math.min(1, Math.max(0, v));
  return { r: clip(c.r), g: clip(c.g), b: clip(c.b) };
}

/**
 * How far a channel may stray outside 0 to 1 and still count as in sRGB when a gradient is baked:
 * far below a byte step (1/255), and above the float noise of the round trips through the
 * interpolation spaces (D50 Lab and LCH, XYZ, Display-P3).
 */
export const GRADIENT_GAMUT_EPSILON = 1e-4;
/** The chroma search's bracket for gradients: fine enough that mapped colors vary smoothly. */
const GRADIENT_CHROMA_STEP = 1e-7;

/**
 * An OKLab color as sRGB, mapped by the gradient's gamut handling (spec 4.3, 7.6 "Bake"; plan D12):
 * "chroma" reduces OKLCH chroma, keeping L and H (`clampChroma`); "clamp" clips the channels.
 * `mapped` is true when the color was outside sRGB by more than `GRADIENT_GAMUT_EPSILON`.
 */
export function toSrgb(color: Oklab, handling: GamutHandling): { rgb: Rgb; mapped: boolean } {
  const rgb = oklabRgb(color.l, color.a, color.b);
  const low = -GRADIENT_GAMUT_EPSILON;
  const high = 1 + GRADIENT_GAMUT_EPSILON;
  const inside =
    rgb.r >= low && rgb.r <= high && rgb.g >= low && rgb.g <= high && rgb.b >= low && rgb.b <= high;
  if (inside || handling === "clamp") return { rgb: clipRgb(rgb), mapped: !inside };
  // OKLab to OKLCH as culori's `convertLabToLch` does it, without its objects.
  const c = Math.sqrt(color.a * color.a + color.b * color.b);
  const h = c ? ((((Math.atan2(color.b, color.a) * 180) / Math.PI) % 360) + 360) % 360 : 0;
  const reduced = clampChroma({ l: color.l, c, h }, GRADIENT_CHROMA_STEP);
  return { rgb: clipRgb(oklchRgb(reduced)), mapped: true };
}
