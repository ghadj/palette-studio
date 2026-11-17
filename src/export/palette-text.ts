/** Copy HEX (spec 5.1 Text; M1 decision 7): one uppercase hex per line, in palette order. */
import { swatchHex } from "../palette/model";
import type { Swatch } from "../types";

export function paletteToHexText(palette: readonly Swatch[]): string {
  return palette.map(swatchHex).join("\n");
}
