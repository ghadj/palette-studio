/**
 * Close in value (spec 3.8, plan D19): swatch pairs whose OKLab lightness differs by less than a
 * threshold. Such colors merge in grayscale. The Values view lists them and the strip marks them.
 */
import type { Oklch } from "../types";

/** The threshold's range in OKLab L (spec 3.8: adjustable 0.01 to 0.10; default 0.03). */
export const CLOSE_IN_VALUE_MIN = 0.01;
export const CLOSE_IN_VALUE_MAX = 0.1;

/** A flagged pair: palette indexes, `first` < `second`, and their lightness difference. */
export interface ValuePair {
  first: number;
  second: number;
  deltaL: number;
}

/** Clamps a close-in-value threshold to 0.01 to 0.10. */
export const clampCloseInValue = (threshold: number): number =>
  Math.min(CLOSE_IN_VALUE_MAX, Math.max(CLOSE_IN_VALUE_MIN, threshold));

/**
 * Every pair of swatches whose OKLab L differs by less than `threshold` (clamped to 0.01 to
 * 0.10), in palette order: by the first index, then the second. OKLCH L is OKLab L.
 */
export function closeInValue(
  palette: readonly { color: Pick<Oklch, "l"> }[],
  threshold: number,
): ValuePair[] {
  const limit = clampCloseInValue(threshold);
  const pairs: ValuePair[] = [];
  for (let first = 0; first < palette.length; first += 1) {
    for (let second = first + 1; second < palette.length; second += 1) {
      const a = palette[first]?.color.l ?? 0;
      const b = palette[second]?.color.l ?? 0;
      const deltaL = Math.abs(a - b);
      if (deltaL < limit) pairs.push({ first, second, deltaL });
    }
  }
  return pairs;
}
