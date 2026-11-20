/**
 * CSS for a gradient (spec 4.5; plan D7, D9, D10). M5's export uses `nativeCss` and `bakedCss` too.
 *
 * - `nativeCss` (path 1): the stops as the sRGB HEX the strip shows, after the gamut handling, with
 *   an `in <space>` clause (and the hue method, for the polar spaces) that carries the
 *   interpolation. A midpoint hint is a CSS color hint. A non-linear easing can't be said in CSS, so
 *   each segment gets 8 to 32 intermediate stops on the eased curve (hint included), as few as keep
 *   the browser's interpolation between them within 1/255 of the curve. Between such close stops the
 *   hue takes the shorter arc, so the clause then drops the hue method: "longer" would send every
 *   short step the long way round.
 * - `bakedCss` (path 2): baked stops, with no clause, so plain sRGB interpolation draws them.
 * - `previewCss` picks between them (D10): native when `CSS.supports` accepts the clause, baked
 *   otherwise, and baked when premultiplied alpha is off and a stop has alpha, since CSS always
 *   premultiplies.
 *
 * Numbers have a fixed precision (2 decimals, trailing zeros dropped) and a period as the decimal
 * separator under any locale (spec 5): they are built with `toFixed`, which ignores the locale.
 */
import { hexToOklch, oklchToHex, oklchToOklab, type Rgb, rgbToHex } from "../color/convert";
import { toSrgb } from "../color/gamut";
import type { Gradient, HueMethod, InterpolationSpace } from "../types";
import { BAKE_TOLERANCE, type BakedStop, bake, sampler } from "./bake";
import { mixer } from "./interpolate";
import type { ResolvedStop } from "./model";
import { hueIndex } from "./spaces";

const byte = (alpha: number): string =>
  Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();

/** `#RRGGBB`, or `#RRGGBBAA` when the stop is not opaque (plan D8). */
export function stopHex(stop: Pick<ResolvedStop, "color" | "alpha">): string {
  const hex = oklchToHex(stop.color);
  return stop.alpha >= 1 ? hex : `${hex}${byte(stop.alpha)}`;
}

/** A HEX with the alpha byte when the alpha rounds below 255. */
const hexAlpha = (hex: string, alpha: number): string =>
  Math.round(alpha * 255) >= 255 ? hex : `${hex}${byte(alpha)}`;

/**
 * A number for CSS: 2 decimals at most, trailing zeros dropped, never an exponent or "-0", and a
 * period as the decimal separator whatever the locale.
 */
export function cssNumber(n: number): string {
  const fixed = n.toFixed(2).replace(/\.?0+$/, "");
  return fixed === "-0" || fixed === "" ? "0" : fixed;
}

const pct = (fraction: number): string => `${cssNumber(fraction * 100)}%`;

/** The hue method the clause names: none for rectangular spaces, and shorter between eased stops. */
function clauseHue(gradient: Gradient, space: InterpolationSpace): HueMethod | null {
  if (hueIndex(space) < 0) return null;
  return gradient.easing.kind === "linear" ? gradient.hue : "shorter";
}

/** ` in oklab`, ` in oklch longer hue` and so on. "shorter" is the default, so it is left out. */
function clause(space: InterpolationSpace, hue: HueMethod | null): string {
  return hue && hue !== "shorter" ? ` in ${space} ${hue} hue` : ` in ${space}`;
}

/** The gradient function's opening, up to its first comma, with `extra` (a clause) at its end. */
function head(gradient: Gradient, extra: string): string {
  const { geometry } = gradient;
  const at = `at ${pct(geometry.center.x)} ${pct(geometry.center.y)}`;
  switch (gradient.type) {
    case "linear":
      return `linear-gradient(${cssNumber(geometry.angle)}deg${extra}`;
    case "radial":
      return `radial-gradient(${geometry.shape} ${geometry.size} ${at}${extra}`;
    case "conic":
      return `conic-gradient(from ${cssNumber(geometry.from)}deg ${at}${extra}`;
  }
}

const supportsCache = new Map<string, boolean>();

/**
 * True when the browser draws gradients `in <space>` with this hue method (spec 4.5, 7.8): a
 * `CSS.supports` check, cached per clause. False where there is no `CSS.supports`.
 */
export function supportsInterpolation(space: InterpolationSpace, hue: HueMethod): boolean {
  const text = clause(space, hueIndex(space) < 0 ? null : hue);
  const known = supportsCache.get(text);
  if (known !== undefined) return known;
  const css = (globalThis as { CSS?: { supports?: (p: string, v: string) => boolean } }).CSS;
  let ok = false;
  try {
    ok =
      typeof css?.supports === "function" &&
      css.supports("background-image", `linear-gradient(${text.trim()}, red, blue)`);
  } catch {
    ok = false;
  }
  supportsCache.set(text, ok);
  return ok;
}

/** Forgets the `CSS.supports` answers (for tests). */
export function clearSupportsCache(): void {
  supportsCache.clear();
}

/** Premultiplied channels and alpha: what a browser blends. */
interface Premultiplied {
  r: number;
  g: number;
  b: number;
  a: number;
}
const premultiply = (rgb: Rgb, a: number): Premultiplied => ({
  r: rgb.r * a,
  g: rgb.g * a,
  b: rgb.b * a,
  a,
});
const distance = (x: Premultiplied, y: Premultiplied): number =>
  Math.max(Math.abs(x.r - y.r), Math.abs(x.g - y.g), Math.abs(x.b - y.b), Math.abs(x.a - y.a));

/** Intermediate stops per eased segment (plan D7: 8 to 32), tried in steps of 4. */
const EASED_MIN = 8;
const EASED_MAX = 32;
const EASED_STEP = 4;

/** A stop as CSS writes it: its HEX (with alpha) and the color that HEX stands for. */
interface Written {
  text: string;
  hex: string;
  alpha: number;
}

/**
 * The native stops of an eased segment from `a` (at `pa`) to `b` (at `pb`): as few as keep the
 * browser's interpolation between neighbors, in the space with the shorter hue arc, within 1/255.
 */
function easedStops(
  a: Written,
  b: Written,
  pa: number,
  pb: number,
  sample: (t: number) => { rgb: Rgb; alpha: number },
  gradient: Gradient,
  space: InterpolationSpace,
): string[] {
  const options = { space, hue: "shorter" as const, premultiplied: true };
  const truth = (t: number): Premultiplied => {
    const s = sample(t);
    return premultiply(s.rgb, s.alpha);
  };
  /** The `n` intermediate stops, and whether the browser's blend between them stays on the curve. */
  const attempt = (n: number): { inner: Written[]; ok: boolean } => {
    const inner: Written[] = [];
    for (let k = 1; k <= n; k++) {
      const t = pa + ((pb - pa) * k) / (n + 1);
      const s = sample(t);
      const hex = rgbToHex(s.rgb);
      inner.push({ text: `${hexAlpha(hex, s.alpha)} ${pct(t)}`, hex, alpha: s.alpha });
    }
    const chain = [a, ...inner, b];
    for (let k = 0; k + 1 < chain.length; k++) {
      const x = chain[k] as Written;
      const y = chain[k + 1] as Written;
      const mix = mixer(
        { color: hexToOklch(x.hex), alpha: Math.round(x.alpha * 255) / 255 },
        { color: hexToOklch(y.hex), alpha: Math.round(y.alpha * 255) / 255 },
        options,
      );
      const t0 = pa + ((pb - pa) * k) / (n + 1);
      const t1 = pa + ((pb - pa) * (k + 1)) / (n + 1);
      for (const s of [0.25, 0.5, 0.75]) {
        const drawn = mix(s);
        const rgb = toSrgb(drawn.color, gradient.gamut).rgb;
        const off = distance(premultiply(rgb, drawn.alpha), truth(t0 + (t1 - t0) * s));
        if (off > BAKE_TOLERANCE) return { inner, ok: false };
      }
    }
    return { inner, ok: true };
  };
  // The fewest that pass: 8 usually does; else a binary search up to 32, which is kept anyway.
  const fewest = attempt(EASED_MIN);
  if (fewest.ok) return fewest.inner.map((w) => w.text);
  let best = attempt(EASED_MAX);
  if (!best.ok) return best.inner.map((w) => w.text);
  let lo = EASED_MIN;
  let hi = EASED_MAX;
  while (hi - lo > EASED_STEP) {
    const mid = lo + Math.round((hi - lo) / 2 / EASED_STEP) * EASED_STEP;
    const tried = attempt(mid);
    if (tried.ok) {
      hi = mid;
      best = tried;
    } else lo = mid;
  }
  return best.inner.map((w) => w.text);
}

/**
 * The gradient as native CSS with an `in <space>` clause (spec 4.5 path 1); `space` overrides the
 * gradient's own, for compare mode (plan D22).
 */
export function nativeCss(
  stops: readonly ResolvedStop[],
  gradient: Gradient,
  space: InterpolationSpace = gradient.space,
): string {
  const g = space === gradient.space ? gradient : { ...gradient, space };
  return `${head(g, clause(space, clauseHue(g, space)))}, ${nativeList(stops, g)})`;
}

/** The last native stop list, so the preview and the stop bar share one (they differ in geometry). */
let lastList: { stops: readonly ResolvedStop[]; key: string; list: string } | null = null;

/** The native color stops, hints and eased intermediate stops, comma-separated. */
function nativeList(stops: readonly ResolvedStop[], g: Gradient): string {
  const e = g.easing;
  const key = `${g.space}|${g.hue}|${g.gamut}|${e.kind}|${e.bezier.join(",")}`;
  if (lastList && lastList.stops === stops && lastList.key === key) return lastList.list;
  const { space } = g;
  const eased = e.kind !== "linear";
  const written: Written[] = stops.map((s) => {
    const hex = rgbToHex(toSrgb(oklchToOklab(s.color), g.gamut).rgb);
    return { text: `${hexAlpha(hex, s.alpha)} ${pct(s.position)}`, hex, alpha: s.alpha };
  });
  let sample: ((t: number) => { rgb: Rgb; alpha: number }) | null = null;
  if (eased && stops.length > 1) {
    const f = sampler(stops, g);
    sample = (t) => {
      const s = f(t);
      return { rgb: toSrgb(s.color, g.gamut).rgb, alpha: s.alpha };
    };
  }
  const parts: string[] = [];
  stops.forEach((s, i) => {
    parts.push((written[i] as Written).text);
    const next = stops[i + 1];
    if (!next || next.position <= s.position) return;
    if (sample) {
      parts.push(
        ...easedStops(
          written[i] as Written,
          written[i + 1] as Written,
          s.position,
          next.position,
          sample,
          g,
          space,
        ),
      );
    } else if (s.hint !== 0.5) {
      parts.push(pct(s.position + s.hint * (next.position - s.position)));
    }
  });
  const list = parts.join(", ");
  lastList = { stops, key, list };
  return list;
}

/** The gradient as plain CSS from baked stops (spec 4.5 path 2), with no `in` clause. */
export function bakedCss(baked: readonly BakedStop[], gradient: Gradient): string {
  const list = baked.map((s) => `${hexAlpha(s.hex, s.alpha)} ${pct(s.position)}`).join(", ");
  return `${head(gradient, "")}, ${list})`;
}

/**
 * How the preview draws the gradient (plan D10): "native" when the browser supports the clause,
 * unless premultiplied alpha is off while a stop has alpha (CSS always premultiplies).
 */
export function previewMode(
  stops: readonly ResolvedStop[],
  gradient: Gradient,
  space: InterpolationSpace = gradient.space,
): "native" | "baked" {
  const g = space === gradient.space ? gradient : { ...gradient, space };
  if (!g.premultiplied && stops.some((s) => s.alpha < 1)) return "baked";
  return supportsInterpolation(space, clauseHue(g, space) ?? "shorter") ? "native" : "baked";
}

/** The CSS the preview shows: native or baked, as `previewMode` decides. */
export function previewCss(stops: readonly ResolvedStop[], gradient: Gradient): string {
  return previewMode(stops, gradient) === "native"
    ? nativeCss(stops, gradient)
    : bakedCss(bake(stops, gradient).stops, gradient);
}
