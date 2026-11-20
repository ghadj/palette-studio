/**
 * Derived stops (spec 4.2; plan D17): analogous, complementary, monochrome and warm-to-cool, made
 * from one base swatch. They stay linked to it through `StopColor.derive`, so its edits flow in.
 * M4-T1 reserves the signature with a fallback; M4-T5 replaces the body and owns this file.
 */
import type { GradientStop, Swatch, Technique } from "../types";
import { swatchStops } from "./model";

/**
 * Stops for the Derived technique. The base is `technique.derive.from`, or the first swatch when
 * it is null or gone (plan D17). Fallback: palette order.
 */
export function derivedStops(_technique: Technique, swatches: readonly Swatch[]): GradientStop[] {
  return swatchStops(swatches);
}
