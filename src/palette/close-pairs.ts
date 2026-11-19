/**
 * Close pairs (spec 3.5; M3-T8): swatch pairs nearer than the merge threshold under the chosen
 * distance metric (M2 decision 7), so near-duplicates that extraction kept apart are flagged.
 * Locked and unlocked swatches are both checked.
 */
import { deltaE, thresholdFor } from "../color/delta-e";
import type { DistanceMetric, Swatch } from "../types";
import { swatchOklab } from "./model";

/** A flagged pair: palette indexes, `first` < `second`, and their distance in the metric's units. */
export interface ClosePair {
  first: number;
  second: number;
  distance: number;
}

/** `stored` is the settings' merge threshold (ΔE OK units); CIEDE2000 reads it ×100. */
export function closePairs(
  palette: readonly Swatch[],
  metric: DistanceMetric,
  stored: number,
): ClosePair[] {
  const limit = thresholdFor(metric, stored);
  const labs = palette.map(swatchOklab);
  const pairs: ClosePair[] = [];
  for (let first = 0; first < labs.length; first += 1) {
    for (let second = first + 1; second < labs.length; second += 1) {
      const a = labs[first];
      const b = labs[second];
      if (!a || !b) continue;
      const distance = deltaE(metric, a, b);
      if (distance < limit) pairs.push({ first, second, distance });
    }
  }
  return pairs;
}
