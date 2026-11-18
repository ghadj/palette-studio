/**
 * Weighted histogram (spec 2.2, 7.6): pixels are binned at 5 bits per sRGB channel (at most 32,768
 * bins), and each bin keeps its pixel count and the mean of its pixels in the working space. Every
 * algorithm runs on these weighted bins instead of raw pixels. Pure; runs in the worker.
 */
import { rgb8ToWorking } from "../color/working-space";
import type { HistogramBits, WorkingSpace } from "../types";

export interface Histogram {
  /** Number of non-empty bins. */
  size: number;
  /** Pixel count per bin. */
  counts: Float64Array;
  /** Mean working-space color per bin, three values each. */
  means: Float64Array;
  /** Pixels counted (after the alpha cutoff). */
  total: number;
}

export interface HistogramOptions {
  space?: WorkingSpace;
  /** Pixels with alpha below this are ignored (spec 2.4: 0 to 255, default 128). */
  alphaCutoff?: number;
  bits?: HistogramBits;
}

export function buildHistogram(
  rgba: Uint8ClampedArray | Uint8Array,
  { space = "oklab", alphaCutoff = 128, bits = 5 }: HistogramOptions = {},
): Histogram {
  const shift = 8 - bits;
  const binCount = 1 << (bits * 3);
  const counts = new Float64Array(binCount);
  const sums = new Float64Array(binCount * 3);
  const convert = rgb8ToWorking(space);
  const color = new Float64Array(3);
  let total = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if ((rgba[i + 3] ?? 0) < alphaCutoff) continue;
    const r = rgba[i] ?? 0;
    const g = rgba[i + 1] ?? 0;
    const b = rgba[i + 2] ?? 0;
    const bin = ((r >> shift) << (2 * bits)) | ((g >> shift) << bits) | (b >> shift);
    convert(r, g, b, color, 0);
    counts[bin] = (counts[bin] ?? 0) + 1;
    sums[bin * 3] = (sums[bin * 3] ?? 0) + (color[0] ?? 0);
    sums[bin * 3 + 1] = (sums[bin * 3 + 1] ?? 0) + (color[1] ?? 0);
    sums[bin * 3 + 2] = (sums[bin * 3 + 2] ?? 0) + (color[2] ?? 0);
    total += 1;
  }
  let size = 0;
  for (let bin = 0; bin < binCount; bin += 1) if ((counts[bin] ?? 0) > 0) size += 1;
  const outCounts = new Float64Array(size);
  const means = new Float64Array(size * 3);
  let k = 0;
  for (let bin = 0; bin < binCount; bin += 1) {
    const n = counts[bin] ?? 0;
    if (n === 0) continue;
    outCounts[k] = n;
    means[k * 3] = (sums[bin * 3] ?? 0) / n;
    means[k * 3 + 1] = (sums[bin * 3 + 1] ?? 0) / n;
    means[k * 3 + 2] = (sums[bin * 3 + 2] ?? 0) / n;
    k += 1;
  }
  return { size, counts: outCounts, means, total };
}
