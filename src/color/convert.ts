/**
 * Color conversions (spec 2.3, 7.9). Work happens in OKLab and OKLCH; output is sRGB.
 * Channels are floats: sRGB and linear sRGB in 0..1 (unclamped), OKLab L in 0..1,
 * OKLCH hue in degrees 0..360, CIELAB and XYZ relative to D65 (Y of white = 1).
 *
 * culori is imported from `culori/fn` so only the modes used here are bundled (spec 7.7).
 */
import {
  converter,
  modeLab65,
  modeLrgb,
  modeOklab,
  modeOklch,
  modeRgb,
  modeXyz65,
  useMode,
} from "culori/fn";

useMode(modeRgb);
useMode(modeLrgb);
useMode(modeOklab);
useMode(modeOklch);
useMode(modeLab65);
useMode(modeXyz65);

export interface Rgb {
  r: number;
  g: number;
  b: number;
}
export type LinearRgb = Rgb;
export interface Oklab {
  l: number;
  a: number;
  b: number;
}
export interface Oklch {
  l: number;
  c: number;
  h: number;
}
export interface Lab {
  l: number;
  a: number;
  b: number;
}
export interface Xyz {
  x: number;
  y: number;
  z: number;
}

const toRgb = converter("rgb");
const toLrgb = converter("lrgb");
const toOklab = converter("oklab");
const toOklch = converter("oklch");
const toLab65 = converter("lab65");
const toXyz65 = converter("xyz65");

const rgb = (c: { r: number; g: number; b: number }): Rgb => ({ r: c.r, g: c.g, b: c.b });
const oklab = (c: { l: number; a: number; b: number }): Oklab => ({ l: c.l, a: c.a, b: c.b });

// Hex

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Parses #RGB or #RRGGBB (the # is optional) into sRGB 0..1. Throws on anything else. */
export function hexToRgb(hex: string): Rgb {
  const match = HEX.exec(hex.trim());
  if (!match?.[1]) throw new Error(`Not a hex color: ${hex}`);
  let digits = match[1];
  if (digits.length === 3) digits = [...digits].map((d) => d + d).join("");
  const n = Number.parseInt(digits, 16);
  return { r: ((n >> 16) & 0xff) / 255, g: ((n >> 8) & 0xff) / 255, b: (n & 0xff) / 255 };
}

const byte = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 255);

/** Formats sRGB 0..1 as uppercase #RRGGBB, clamping each channel to the sRGB range. */
export function rgbToHex(c: Rgb): string {
  const n = (byte(c.r) << 16) | (byte(c.g) << 8) | byte(c.b);
  return `#${n.toString(16).padStart(6, "0").toUpperCase()}`;
}

// sRGB and linear sRGB

export function srgbToLinear(c: Rgb): LinearRgb {
  return rgb(toLrgb({ mode: "rgb", ...c }));
}

export function linearToSrgb(c: LinearRgb): Rgb {
  return rgb(toRgb({ mode: "lrgb", ...c }));
}

// OKLab and OKLCH

export function linearRgbToOklab(c: LinearRgb): Oklab {
  return oklab(toOklab({ mode: "lrgb", ...c }));
}

export function oklabToLinearRgb(c: Oklab): LinearRgb {
  return rgb(toLrgb({ mode: "oklab", ...c }));
}

export function rgbToOklab(c: Rgb): Oklab {
  return oklab(toOklab({ mode: "rgb", ...c }));
}

export function oklabToRgb(c: Oklab): Rgb {
  return rgb(toRgb({ mode: "oklab", ...c }));
}

/** OKLab to OKLCH. Achromatic colors get hue 0. */
export function oklabToOklch(c: Oklab): Oklch {
  const lch = toOklch({ mode: "oklab", ...c });
  return { l: lch.l, c: lch.c, h: lch.h ?? 0 };
}

export function oklchToOklab(c: Oklch): Oklab {
  return oklab(toOklab({ mode: "oklch", ...c }));
}

export function hexToOklab(hex: string): Oklab {
  return rgbToOklab(hexToRgb(hex));
}

export function hexToOklch(hex: string): Oklch {
  return oklabToOklch(hexToOklab(hex));
}

/** OKLab to hex. Out-of-gamut colors are clipped per channel; gamut mapping lives in gamut.ts (M3). */
export function oklabToHex(c: Oklab): string {
  return rgbToHex(oklabToRgb(c));
}

export function oklchToHex(c: Oklch): string {
  return oklabToHex(oklchToOklab(c));
}

// CIELAB (D65) and XYZ (D65)

export function rgbToLab(c: Rgb): Lab {
  const lab = toLab65({ mode: "rgb", ...c });
  return { l: lab.l, a: lab.a, b: lab.b };
}

export function labToRgb(c: Lab): Rgb {
  return rgb(toRgb({ mode: "lab65", ...c }));
}

export function rgbToXyz(c: Rgb): Xyz {
  const xyz = toXyz65({ mode: "rgb", ...c });
  return { x: xyz.x, y: xyz.y, z: xyz.z };
}

export function xyzToOklab(c: Xyz): Oklab {
  return oklab(toOklab({ mode: "xyz65", ...c }));
}

export function oklabToXyz(c: Oklab): Xyz {
  const xyz = toXyz65({ mode: "oklab", ...c });
  return { x: xyz.x, y: xyz.y, z: xyz.z };
}
