/**
 * WCAG 2.x contrast (spec 3.5; plan D7). Relative luminance from sRGB, the ratio
 * (L1 + 0.05) / (L2 + 0.05), and the AA/AAA badge. No APCA in M3 (decision 6a).
 */
import { parseHex } from "./hex";

/** The linear-light value of an 8-bit sRGB channel (WCAG 2.x). */
const channel = (value: number): number => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance of a `#RRGGBB` color, 0 to 1. Unparseable input counts as black. */
export function relativeLuminance(hex: string): number {
  const parsed = parseHex(hex) ?? "#000000";
  const r = Number.parseInt(parsed.slice(1, 3), 16);
  const g = Number.parseInt(parsed.slice(3, 5), 16);
  const b = Number.parseInt(parsed.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** The WCAG contrast ratio, 1 to 21, symmetric in its arguments. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export type ContrastBadge = "AAA" | "AA" | "AA large" | "Fail";

/** AAA at 7 or more, AA at 4.5, "AA large" at 3, otherwise "Fail" (plan D7). Unrounded. */
export function badge(ratio: number): ContrastBadge {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA large";
  return "Fail";
}
