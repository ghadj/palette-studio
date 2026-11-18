/**
 * Even spread (farthest-point; spec 2.2; M2-T5): the first pick is the heaviest bin; each next pick
 * is the bin farthest (Euclidean in the working space) from its nearest pick. Ties go to the lower
 * bin. Populations come from assigning every bin to its nearest pick. Colors come back in pick
 * order. Pure and deterministic.
 */
import type { Histogram } from "./histogram";
import type { Cluster } from "./median-cut";

export function evenSpread(h: Histogram, n: number): Cluster[] {
  if (h.size === 0 || h.total <= 0 || n <= 0) return [];
  const dist2 = (i: number, j: number) =>
    ((h.means[i * 3] ?? 0) - (h.means[j * 3] ?? 0)) ** 2 +
    ((h.means[i * 3 + 1] ?? 0) - (h.means[j * 3 + 1] ?? 0)) ** 2 +
    ((h.means[i * 3 + 2] ?? 0) - (h.means[j * 3 + 2] ?? 0)) ** 2;
  // Entries are in ascending bin order, so a strict comparison keeps the lower bin on ties.
  let first = 0;
  for (let i = 1; i < h.size; i += 1) if ((h.counts[i] ?? 0) > (h.counts[first] ?? 0)) first = i;
  const picks = [first];
  const nearest = new Float64Array(h.size);
  const owner = new Int32Array(h.size);
  for (let i = 0; i < h.size; i += 1) nearest[i] = dist2(i, first);
  while (picks.length < n) {
    let far = -1;
    let farD = 0;
    for (let i = 0; i < h.size; i += 1) {
      if ((nearest[i] ?? 0) > farD) {
        farD = nearest[i] ?? 0;
        far = i;
      }
    }
    if (far < 0) break;
    const index = picks.length;
    picks.push(far);
    for (let i = 0; i < h.size; i += 1) {
      const d = dist2(i, far);
      if (d < (nearest[i] ?? 0)) {
        nearest[i] = d;
        owner[i] = index;
      }
    }
  }
  const weight = new Float64Array(picks.length);
  for (let i = 0; i < h.size; i += 1) {
    const j = owner[i] ?? 0;
    weight[j] = (weight[j] ?? 0) + (h.counts[i] ?? 0);
  }
  return picks.map((bin, j) => ({
    color: [h.means[bin * 3] ?? 0, h.means[bin * 3 + 1] ?? 0, h.means[bin * 3 + 2] ?? 0],
    population: (weight[j] ?? 0) / h.total,
  }));
}
