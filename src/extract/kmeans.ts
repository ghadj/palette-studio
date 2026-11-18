/**
 * Weighted k-means with k-means++ seeding (spec 2.2, 2.4, 7.6) over the histogram bins: Euclidean
 * distance in the working space, a seeded mulberry32 PRNG so the same seed gives the same palette,
 * restarts that keep the lowest error, empty clusters reseeded to the farthest point, and a stop
 * when the largest centroid shift falls below 1e-4 or the iteration cap is reached. Pure.
 */
import type { Histogram } from "./histogram";
import type { Cluster } from "./median-cut";

export interface KMeansOptions {
  k: number;
  /** 5 to 100 (spec 2.4). */
  iterations?: number;
  /** 1 to 10. */
  restarts?: number;
  seed?: number;
  tolerance?: number;
}

export interface KMeansResult {
  clusters: Cluster[];
  /** Weighted sum of squared distances to the nearest centroid. */
  error: number;
  iterations: number;
  converged: boolean;
  restartErrors: number[];
}

/** mulberry32: a small, fast, seeded PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dist2 = (m: Float64Array, i: number, c: Float64Array, j: number): number => {
  const d0 = (m[i * 3] ?? 0) - (c[j * 3] ?? 0);
  const d1 = (m[i * 3 + 1] ?? 0) - (c[j * 3 + 1] ?? 0);
  const d2 = (m[i * 3 + 2] ?? 0) - (c[j * 3 + 2] ?? 0);
  return d0 * d0 + d1 * d1 + d2 * d2;
};

/** Picks an index with probability proportional to its weight. */
function pick(weights: Float64Array, total: number, rng: () => number): number {
  let target = rng() * total;
  let last = -1;
  for (let i = 0; i < weights.length; i += 1) {
    const w = weights[i] ?? 0;
    if (w <= 0) continue;
    last = i;
    target -= w;
    if (target < 0) return i;
  }
  return last;
}

/**
 * k-means++ seeding: the first centroid by weight, each next one with probability proportional to
 * weight × squared distance to the nearest chosen centroid. Returns the chosen bin indices.
 */
export function initCentroids(h: Histogram, k: number, rng: () => number): number[] {
  const chosen: number[] = [];
  if (h.size === 0) return chosen;
  chosen.push(pick(h.counts, h.total, rng));
  const nearest = new Float64Array(h.size).fill(Number.POSITIVE_INFINITY);
  const scores = new Float64Array(h.size);
  const one = new Float64Array(3);
  while (chosen.length < k) {
    const last = chosen[chosen.length - 1] ?? 0;
    one[0] = h.means[last * 3] ?? 0;
    one[1] = h.means[last * 3 + 1] ?? 0;
    one[2] = h.means[last * 3 + 2] ?? 0;
    let total = 0;
    for (let i = 0; i < h.size; i += 1) {
      const d = dist2(h.means, i, one, 0);
      if (d < (nearest[i] ?? 0)) nearest[i] = d;
      const s = (h.counts[i] ?? 0) * (nearest[i] ?? 0);
      scores[i] = s;
      total += s;
    }
    if (total <= 0) break;
    chosen.push(pick(scores, total, rng));
  }
  return chosen;
}

interface Run {
  clusters: Cluster[];
  error: number;
  iterations: number;
  converged: boolean;
}

function assign(
  h: Histogram,
  centroids: Float64Array,
  k: number,
  assignment: Int32Array,
  d: Float64Array,
) {
  for (let i = 0; i < h.size; i += 1) {
    let best = 0;
    let bestD = Number.POSITIVE_INFINITY;
    for (let j = 0; j < k; j += 1) {
      const dd = dist2(h.means, i, centroids, j);
      if (dd < bestD) {
        bestD = dd;
        best = j;
      }
    }
    assignment[i] = best;
    d[i] = bestD;
  }
}

/** Weighted sums per cluster for an assignment. */
function accumulate(
  h: Histogram,
  assignment: Int32Array,
  sums: Float64Array,
  weights: Float64Array,
) {
  sums.fill(0);
  weights.fill(0);
  for (let i = 0; i < h.size; i += 1) {
    const j = assignment[i] ?? 0;
    const w = h.counts[i] ?? 0;
    weights[j] = (weights[j] ?? 0) + w;
    for (let c = 0; c < 3; c += 1)
      sums[j * 3 + c] = (sums[j * 3 + c] ?? 0) + w * (h.means[i * 3 + c] ?? 0);
  }
}

/**
 * The clusters a run returns: the weighted means of the final assignment, with empty clusters
 * dropped, and the weighted squared error of every bin to its nearest returned cluster.
 */
function finalize(
  h: Histogram,
  centroids: Float64Array,
  k: number,
): { clusters: Cluster[]; error: number } {
  const assignment = new Int32Array(h.size);
  const d = new Float64Array(h.size);
  assign(h, centroids, k, assignment, d);
  const sums = new Float64Array(k * 3);
  const weights = new Float64Array(k);
  accumulate(h, assignment, sums, weights);
  const clusters: Cluster[] = [];
  const kept: number[] = [];
  for (let j = 0; j < k; j += 1) {
    const w = weights[j] ?? 0;
    if (w <= 0) continue;
    const color: [number, number, number] = [
      (sums[j * 3] ?? 0) / w,
      (sums[j * 3 + 1] ?? 0) / w,
      (sums[j * 3 + 2] ?? 0) / w,
    ];
    clusters.push({ color, population: w / h.total });
    kept.push(...color);
  }
  const final = Float64Array.from(kept);
  let error = 0;
  for (let i = 0; i < h.size; i += 1) {
    let best = Number.POSITIVE_INFINITY;
    for (let j = 0; j < clusters.length; j += 1) best = Math.min(best, dist2(h.means, i, final, j));
    error += (h.counts[i] ?? 0) * best;
  }
  return { clusters, error };
}

function run(
  h: Histogram,
  k: number,
  iterations: number,
  tolerance: number,
  rng: () => number,
): Run {
  const seeds = initCentroids(h, k, rng);
  const kk = seeds.length;
  const centroids = new Float64Array(kk * 3);
  seeds.forEach((bin, j) => {
    centroids.set(
      [h.means[bin * 3] ?? 0, h.means[bin * 3 + 1] ?? 0, h.means[bin * 3 + 2] ?? 0],
      j * 3,
    );
  });
  const assignment = new Int32Array(h.size);
  const d = new Float64Array(h.size);
  const sums = new Float64Array(kk * 3);
  const weights = new Float64Array(kk);
  let done = 0;
  let converged = false;
  while (done < iterations) {
    assign(h, centroids, kk, assignment, d);
    accumulate(h, assignment, sums, weights);
    let shift = 0;
    const taken = new Set<number>();
    for (let j = 0; j < kk; j += 1) {
      const next = [0, 0, 0];
      if ((weights[j] ?? 0) > 0) {
        for (let c = 0; c < 3; c += 1) next[c] = (sums[j * 3 + c] ?? 0) / (weights[j] ?? 1);
      } else {
        // Empty cluster: reseed it at the point farthest from its centroid.
        let far = 0;
        let farD = -1;
        for (let i = 0; i < h.size; i += 1) {
          if (taken.has(i)) continue;
          if ((d[i] ?? 0) > farD) {
            farD = d[i] ?? 0;
            far = i;
          }
        }
        taken.add(far);
        d[far] = 0;
        for (let c = 0; c < 3; c += 1) next[c] = h.means[far * 3 + c] ?? 0;
      }
      const move = Math.hypot(
        (next[0] ?? 0) - (centroids[j * 3] ?? 0),
        (next[1] ?? 0) - (centroids[j * 3 + 1] ?? 0),
        (next[2] ?? 0) - (centroids[j * 3 + 2] ?? 0),
      );
      if (move > shift) shift = move;
      centroids.set(next, j * 3);
    }
    done += 1;
    if (shift < tolerance) {
      converged = true;
      break;
    }
  }
  return { ...finalize(h, centroids, kk), iterations: done, converged };
}

export function kmeans(h: Histogram, options: KMeansOptions): KMeansResult {
  const { iterations = 25, restarts = 3, seed = 1, tolerance = 1e-4 } = options;
  const k = Math.min(options.k, h.size);
  if (k <= 0 || h.total === 0) {
    return { clusters: [], error: 0, iterations: 0, converged: true, restartErrors: [] };
  }
  const rng = mulberry32(seed);
  let best: Run | null = null;
  const restartErrors: number[] = [];
  for (let r = 0; r < Math.max(1, restarts); r += 1) {
    const result = run(h, k, iterations, tolerance, rng);
    restartErrors.push(result.error);
    if (!best || result.error < best.error) best = result;
  }
  const kept = best as Run;
  return { ...kept, restartErrors };
}
