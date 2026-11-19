/**
 * Whole-number sRGB and HSL views of an OKLCH color, for the Swatch row's RGB and HSL fields
 * (spec 3.2). Typed values come back as the OKLCH color of that sRGB byte triple.
 */
import { hslToRgb, type Oklch, oklabToRgb, oklchToOklab, rgbToHsl, rgbToOklab } from "./convert";

const toByte = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 255);

/** The color as sRGB bytes, 0 to 255, clamped. */
export function oklchToBytes(color: Oklch): [number, number, number] {
  const c = oklabToRgb(oklchToOklab(color));
  return [toByte(c.r), toByte(c.g), toByte(c.b)];
}

/** The OKLCH color of an sRGB byte triple. */
export function bytesToOklch([r, g, b]: readonly [number, number, number]): Oklch {
  const lab = rgbToOklab({ r: r / 255, g: g / 255, b: b / 255 });
  const c = Math.hypot(lab.a, lab.b);
  const h = c < 1e-9 ? 0 : ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360;
  return { l: lab.l, c, h };
}

/** HSL as whole numbers: hue 0 to 359, saturation and lightness 0 to 100. */
export function oklchToHslInts(color: Oklch): [number, number, number] {
  const [r, g, b] = oklchToBytes(color);
  const { h, s, l } = rgbToHsl({ r: r / 255, g: g / 255, b: b / 255 });
  return [Math.round(h) % 360, Math.round(s * 100), Math.round(l * 100)];
}

/** The OKLCH color of whole-number HSL (hue in degrees, S and L in percent). */
export function hslIntsToOklch([h, s, l]: readonly [number, number, number]): Oklch {
  const { r, g, b } = hslToRgb({ h, s: s / 100, l: l / 100 });
  return bytesToOklch([toByte(r), toByte(g), toByte(b)]);
}
