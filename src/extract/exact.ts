/**
 * Exact colors (popularity; spec 2.2; M2 decision 12): counts exact 24-bit sRGB colors among the
 * kept pixels, with their weights, and takes the N most common; ties go to the lower packed RGB.
 * Every output is an input color, never an average. Pixels of the colors left out count toward
 * their nearest chosen color (Euclidean in the working space), so populations still sum to 1.
 * Vividness doesn't apply (decision 6). With `outlier`, one more color joins the N chosen: the real
 * input color farthest from its nearest chosen color among colors holding at least 0.1% of the kept
 * pixels (M2 decision 8b), so the outlier is never a box mean. Pure.
 */
import { type DistanceMetric, deltaE } from "../color/delta-e";
import { rgb8ToWorking, workingToOklab } from "../color/working-space";
import type { WorkingSpace } from "../types";
import type { Cluster } from "./median-cut";
import { OUTLIER_MIN_SHARE } from "./outlier";

export interface ExactOptions {
  n: number;
  space?: WorkingSpace;
  /** Pixels with alpha below this are ignored (spec 2.4). */
  alphaCutoff?: number;
  /** One entry per pixel; 0 drops the pixel. */
  mask?: Uint8Array;
  /** One entry per pixel; each pixel counts with this weight instead of 1. */
  weights?: Float32Array | Float64Array;
  /** Add the most distinct real color as one more swatch; the value is the distance metric. */
  outlier?: DistanceMetric;
}

function rgb8ToWorkingTriple(space: WorkingSpace, key: number): Float64Array {
  const out = new Float64Array(3);
  rgb8ToWorking(space)((key >> 16) & 255, (key >> 8) & 255, key & 255, out, 0);
  return out;
}

export function exactColors(
  rgba: Uint8ClampedArray | Uint8Array,
  { n, space = "oklab", alphaCutoff = 128, mask, weights, outlier }: ExactOptions,
): Cluster[] {
  const counts = new Map<number, number>();
  let total = 0;
  for (let i = 0, p = 0; i + 3 < rgba.length; i += 4, p += 1) {
    if ((rgba[i + 3] ?? 0) < alphaCutoff) continue;
    if (mask && mask[p] === 0) continue;
    const w = weights ? (weights[p] ?? 0) : 1;
    if (w <= 0) continue;
    const key = ((rgba[i] ?? 0) << 16) | ((rgba[i + 1] ?? 0) << 8) | (rgba[i + 2] ?? 0);
    counts.set(key, (counts.get(key) ?? 0) + w);
    total += w;
  }
  if (total <= 0 || n <= 0) return [];
  const ranked = [...counts.entries()].sort((x, y) => y[1] - x[1] || x[0] - y[0]);
  const chosen = ranked.slice(0, n);
  if (outlier && chosen.length > 0) {
    const lab = (key: number) =>
      workingToOklab(
        space,
        ...(Array.from(rgb8ToWorkingTriple(space, key)) as [number, number, number]),
      );
    const chosenLab = chosen.map(([key]) => lab(key));
    let best: [number, number] | null = null;
    let bestD = 0;
    for (let r = chosen.length; r < ranked.length; r += 1) {
      const entry = ranked[r] as [number, number];
      if (entry[1] / total < OUTLIER_MIN_SHARE) continue;
      const l = lab(entry[0]);
      let nearest = Number.POSITIVE_INFINITY;
      for (const c of chosenLab) nearest = Math.min(nearest, deltaE(outlier, l, c));
      if (nearest > bestD) {
        bestD = nearest;
        best = entry;
      }
    }
    if (best) chosen.push(best);
  }
  const convert = rgb8ToWorking(space);
  const color = (key: number, out: Float64Array, offset: number) =>
    convert((key >> 16) & 255, (key >> 8) & 255, key & 255, out, offset);
  const centers = new Float64Array(chosen.length * 3);
  for (let j = 0; j < chosen.length; j += 1)
    color((chosen[j] as [number, number])[0], centers, j * 3);
  const weight = chosen.map(([, count]) => count);
  // Leftover colors join their nearest chosen color; ties go to the earlier (more common) one.
  const one = new Float64Array(3);
  const picked = new Set(chosen.map(([key]) => key));
  for (let r = 0; r < ranked.length; r += 1) {
    const [key, count] = ranked[r] as [number, number];
    if (picked.has(key)) continue;
    color(key, one, 0);
    let best = 0;
    let bestD = Number.POSITIVE_INFINITY;
    for (let j = 0; j < chosen.length; j += 1) {
      const d =
        ((one[0] ?? 0) - (centers[j * 3] ?? 0)) ** 2 +
        ((one[1] ?? 0) - (centers[j * 3 + 1] ?? 0)) ** 2 +
        ((one[2] ?? 0) - (centers[j * 3 + 2] ?? 0)) ** 2;
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    weight[best] = (weight[best] ?? 0) + count;
  }
  return chosen.map((_, j) => ({
    color: [centers[j * 3] ?? 0, centers[j * 3 + 1] ?? 0, centers[j * 3 + 2] ?? 0],
    population: (weight[j] ?? 0) / total,
  }));
}
