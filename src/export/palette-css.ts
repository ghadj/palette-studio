/**
 * Copy CSS (spec 5.1 CSS; M1 decision 7): a :root block with --palette-1 to --palette-N, uppercase
 * hex, in palette order. Hex only until M5 adds the other formats. No locale-dependent formatting.
 */
import { swatchHex } from "../palette/model";
import type { Swatch } from "../types";

export function paletteToCss(palette: readonly Swatch[]): string {
  const lines = palette.map((swatch, i) => `  --palette-${i + 1}: ${swatchHex(swatch)};`);
  return [":root {", ...lines, "}"].join("\n");
}
