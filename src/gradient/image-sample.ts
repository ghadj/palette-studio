/**
 * Image sample stops (spec 4.2, 3.7; plan D18): colors read along a line, a scan or the markers.
 * The sampling itself runs in the worker (spec 7.4) and its result is stored in
 * `technique.sample.colors`; this builds the stops from that. M4-T1 reserves the function
 * `sources.ts` calls, with a fallback; M4-T5 replaces its body, builds `scanPoints`, `markerOrder`,
 * `sampleStops` and `ringStops` under it, and owns this file. `sources.ts` is shared: keep this
 * signature.
 */
import type { GradientStop, Swatch, Technique } from "../types";
import { swatchStops } from "./model";

/**
 * Stops for the Image sample technique: fixed stops from `technique.sample.colors`, or linked
 * stops for the marker modes (plan D18). Fallback: palette order.
 */
export function sampledStops(_technique: Technique, swatches: readonly Swatch[]): GradientStop[] {
  return swatchStops(swatches);
}
