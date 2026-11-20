/**
 * Hex text entry (spec 3.2, 6.1): the editor's HEX field accepts 3 or 6 digits, with or without a
 * leading #. The color math itself lives in `convert.ts`.
 */

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Normalizes "#e8693a", "E8693A" or "e63" to "#RRGGBB" (uppercase); null for anything else. */
export function parseHex(text: string): string | null {
  const match = HEX.exec(text.trim());
  const digits = match?.[1];
  if (!digits) return null;
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((d) => d + d)
          .join("")
      : digits;
  return `#${full.toUpperCase()}`;
}
