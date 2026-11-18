/**
 * Weighted histogram (spec 2.2, 7.6): pixels are binned at 4 to 6 bits per sRGB channel (at most
 * 32,768 bins at 5 bits), and each bin keeps its weight and the weighted mean of its pixels in the
 * working space. Every algorithm runs on these weighted bins instead of raw pixels. An optional
 * per-pixel keep mask (filters, spec 2.1 step 3) and per-pixel weights (spatial weighting) shape
 * the counts. Pure; runs in the worker.
 */
import { rgb8ToWorking } from "../color/working-space";
import type { HistogramBits, WorkingSpace } from "../types";

export interface Histogram {
  /** Number of non-empty bins. */
  size: number;
  /** Weight per bin: the pixel count, or the sum of the pixels' weights. */
  counts: Float64Array;
  /** Mean working-space color per bin, three values each. */
  means: Float64Array;
  /** Total weight counted (after the alpha cutoff and the mask). */
  total: number;
  /** Bits per channel the bins were made at. */
  bits: HistogramBits;
  /**
   * Bin index of each entry, `(r << 2·bits) | (g << bits) | b` on the shifted sRGB channels, in
   * ascending order. Wu's moment tables are indexed by it.
   */
  bins: Uint32Array;
}

export interface HistogramOptions {
  space?: WorkingSpace;
  /** Pixels with alpha below this are ignored (spec 2.4: 0 to 255, default 128). */
  alphaCutoff?: number;
  bits?: HistogramBits;
  /** One entry per pixel; 0 drops the pixel. */
  mask?: Uint8Array;
  /** One entry per pixel; each pixel counts with this weight instead of 1. */
  weights?: Float32Array | Float64Array;
}

export function buildHistogram(
  rgba: Uint8ClampedArray | Uint8Array,
  { space = "oklab", alphaCutoff = 128, bits = 5, mask, weights }: HistogramOptions = {},
): Histogram {
  const shift = 8 - bits;
  const binCount = 1 << (bits * 3);
  const counts = new Float64Array(binCount);
  const sums = new Float64Array(binCount * 3);
  const convert = rgb8ToWorking(space);
  const color = new Float64Array(3);
  let total = 0;
  for (let i = 0, p = 0; i + 3 < rgba.length; i += 4, p += 1) {
    if ((rgba[i + 3] ?? 0) < alphaCutoff) continue;
    if (mask && mask[p] === 0) continue;
    const w = weights ? (weights[p] ?? 0) : 1;
    if (w <= 0) continue;
    const r = rgba[i] ?? 0;
    const g = rgba[i + 1] ?? 0;
    const b = rgba[i + 2] ?? 0;
    const bin = ((r >> shift) << (2 * bits)) | ((g >> shift) << bits) | (b >> shift);
    convert(r, g, b, color, 0);
    counts[bin] = (counts[bin] ?? 0) + w;
    sums[bin * 3] = (sums[bin * 3] ?? 0) + w * (color[0] ?? 0);
    sums[bin * 3 + 1] = (sums[bin * 3 + 1] ?? 0) + w * (color[1] ?? 0);
    sums[bin * 3 + 2] = (sums[bin * 3 + 2] ?? 0) + w * (color[2] ?? 0);
    total += w;
  }
  let size = 0;
  for (let bin = 0; bin < binCount; bin += 1) if ((counts[bin] ?? 0) > 0) size += 1;
  const outCounts = new Float64Array(size);
  const means = new Float64Array(size * 3);
  const bins = new Uint32Array(size);
  let k = 0;
  for (let bin = 0; bin < binCount; bin += 1) {
    const n = counts[bin] ?? 0;
    if (n === 0) continue;
    outCounts[k] = n;
    bins[k] = bin;
    means[k * 3] = (sums[bin * 3] ?? 0) / n;
    means[k * 3 + 1] = (sums[bin * 3 + 1] ?? 0) / n;
    means[k * 3 + 2] = (sums[bin * 3 + 2] ?? 0) / n;
    k += 1;
  }
  return { size, counts: outCounts, means, total, bits, bins };
}
