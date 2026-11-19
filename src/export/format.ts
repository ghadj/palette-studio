import { type Oklch, oklabToRgb, oklchToOklab, rgbToHsl } from "../color/convert";

/**
 * Locale-independent number formatting for exports (spec 5): always a period as the decimal
 * separator, no grouping, and no negative zero. Never use toLocaleString or Intl here.
 */
export function formatNumber(value: number, digits: number): string {
  if (!Number.isFinite(value)) throw new Error(`Cannot format ${value}`);
  const text = value.toFixed(digits);
  return /^-0(\.0*)?$/.test(text) ? text.slice(1) : text;
}

// CSS Color 4 color strings (plan D14). Each takes the swatch's OKLCH color and writes the
// space-separated syntax; RGB and HSL are the sRGB color rounded to whole numbers, clipped to the
// gamut like the HEX.

const byte = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 255);

/** `rgb(232 105 58)`. */
export function formatRgb(color: Oklch): string {
  const c = oklabToRgb(oklchToOklab(color));
  return `rgb(${byte(c.r)} ${byte(c.g)} ${byte(c.b)})`;
}

/** `hsl(16 79% 57%)`, from the clipped, 8-bit sRGB color so it matches the HEX. */
export function formatHsl(color: Oklch): string {
  const c = oklabToRgb(oklchToOklab(color));
  const hsl = rgbToHsl({ r: byte(c.r) / 255, g: byte(c.g) / 255, b: byte(c.b) / 255 });
  return `hsl(${formatNumber(Math.round(hsl.h) % 360, 0)} ${Math.round(hsl.s * 100)}% ${Math.round(hsl.l * 100)}%)`;
}

/** `oklch(0.700 0.150 40.0)`: 3 decimals for L and C, 1 for H. */
export function formatOklch(color: Oklch): string {
  const hue = formatNumber(color.h, 1);
  return `oklch(${formatNumber(color.l, 3)} ${formatNumber(color.c, 3)} ${hue === "360.0" ? "0.0" : hue})`;
}
