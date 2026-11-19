/**
 * Global adjustments (spec 3.3, 7.5): parameters applied on top of the base swatches, so they stay
 * non-destructive and resettable. This is the identity stub; M3-T6 fills it in.
 */
import type { Adjustments, Swatch } from "../types";

/** The adjusted palette shown and exported. The stub returns the base list itself. */
export function applyAdjustments(palette: Swatch[], _adjustments: Adjustments): Swatch[] {
  return palette;
}
