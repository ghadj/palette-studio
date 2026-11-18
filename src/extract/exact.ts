/**
 * Exact colors (popularity; spec 2.2; M2 decision 12): counts exact 24-bit sRGB colors among the
 * kept pixels, with their weights, and takes the N most common; ties go to the lower packed RGB.
 * Every output is an input color, never an average. Pixels of the colors left out count toward
 * their nearest chosen color (Euclidean in the working space), so populations still sum to 1.
 * Vividness doesn't apply (decision 6). Pure.
 */
import { rgb8ToWorking } from "../color/working-space";
import type { WorkingSpace } from "../types";
import type { Cluster } from "./median-cut";

export interface ExactOptions {
  n: number;
  space?: WorkingSpace;
  /** Pixels with alpha below this are ignored (spec 2.4). */
  alphaCutoff?: number;
  /** One entry per pixel; 0 drops the pixel. */
  mask?: Uint8Array;
  /** One entry per pixel; each pixel counts with this weight instead of 1. */
  weights?: Float32Array | Float64Array;
}

export function exactColors(
  rgba: Uint8ClampedArray | Uint8Array,
  { n, space = "oklab", alphaCutoff = 128, mask, weights }: ExactOptions,
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
  const convert = rgb8ToWorking(space);
  const color = (key: number, out: Float64Array, offset: number) =>
    convert((key >> 16) & 255, (key >> 8) & 255, key & 255, out, offset);
  const centers = new Float64Array(chosen.length * 3);
  for (let j = 0; j < chosen.length; j += 1)
    color((chosen[j] as [number, number])[0], centers, j * 3);
  const weight = chosen.map(([, count]) => count);
  // Leftover colors join their nearest chosen color; ties go to the earlier (more common) one.
  const one = new Float64Array(3);
  for (let r = chosen.length; r < ranked.length; r += 1) {
    const [key, count] = ranked[r] as [number, number];
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
