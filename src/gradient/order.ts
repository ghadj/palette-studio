/**
 * Ordering techniques and the "Most distinct" subset (spec 4.2, 7.6 "Smooth-path ordering"; plan
 * M4-T4, D13 to D16): Sorted, Smooth path (nearest neighbor from every start, then 2-opt),
 * Constrained random (seeded), Population-weighted positions and Most distinct.
 *
 * Distances are taken between OKLab colors under the current distance metric (M2 decision 7):
 * ΔE OK or CIEDE2000. Every result is deterministic: ties go to palette order, and randomness comes
 * from the seeded mulberry32 that extraction uses (spec 2).
 *
 * `sources.ts` (shared, plan M4-T2) calls `orderedStops` and `distinctSwatches`; keep their
 * signatures. The metric defaults to the setting, so the live gradient rebuilds when it changes.
 */
import { contrastRatio } from "../color/contrast";
import { type Oklab, type Oklch, oklchToHex, oklchToOklab } from "../color/convert";
import { type DistanceMetric, deltaE, thresholdFor } from "../color/delta-e";
import { mulberry32 } from "../extract/kmeans";
import { settings } from "../state/signals";
import type { GradientStop, SortBy, Swatch, Technique } from "../types";
import { swatchStops } from "./model";

/** Constrained random tries this many seeded shuffles (plan D15). */
export const RANDOM_TRIES = 200;
/** Population-weighted: a band is at least this share of the gradient (plan D16). */
export const MIN_POPULATION_SHARE = 0.02;

/** Improvements smaller than this are rounding noise, so 2-opt always stops. */
const EPS = 1e-12;

const currentMetric = (): DistanceMetric => settings.value.distanceMetric;

/** Pairwise distances under `metric`, as rows of a symmetric matrix. */
export function distanceMatrix(labs: readonly Oklab[], metric: DistanceMetric): number[][] {
  const n = labs.length;
  const d: number[][] = labs.map(() => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const v = deltaE(metric, labs[i] as Oklab, labs[j] as Oklab);
      (d[i] as number[])[j] = v;
      (d[j] as number[])[i] = v;
    }
  }
  return d;
}

const at = (d: readonly (readonly number[])[], i: number, j: number): number =>
  (d[i] as readonly number[])[j] as number;

function pathCost(order: readonly number[], d: readonly (readonly number[])[]): number {
  let total = 0;
  for (let k = 1; k < order.length; k++) total += at(d, order[k - 1] as number, order[k] as number);
  return total;
}

// Sorted

/** OKLCH hue, 0 to 360. Grays carry hue 0 (`oklabToOklch`), as in the strip's hue sort. */
const hueOf = (c: Oklch): number => (Number.isFinite(c.h) ? ((c.h % 360) + 360) % 360 : 0);

/**
 * The swatches sorted for the Sorted technique (plan D13): lightness dark to light, chroma high to
 * low (M2 decision 16), or hue ascending, starting just after the largest gap around the wheel so
 * the run doesn't break in the middle of a hue family. Equal keys keep palette order.
 */
export function sortSwatches(palette: readonly Swatch[], by: SortBy): Swatch[] {
  const indexed = palette.map((s, i) => ({ s, i }));
  const stable = (key: (s: Swatch) => number) =>
    indexed.sort((x, y) => key(x.s) - key(y.s) || x.i - y.i).map((x) => x.s);
  if (by === "lightness") return stable((s) => s.color.l);
  if (by === "chroma") return stable((s) => -s.color.c);

  const byHue = stable((s) => hueOf(s.color));
  if (byHue.length < 2) return byHue;
  // The gap after each swatch, the last one wrapping round to the first.
  let start = 0;
  let widest = -1;
  for (let k = 0; k < byHue.length; k++) {
    const h = hueOf((byHue[k] as Swatch).color);
    const next = hueOf((byHue[(k + 1) % byHue.length] as Swatch).color);
    const gap = k === byHue.length - 1 ? next + 360 - h : next - h;
    if (gap > widest + EPS) {
      widest = gap;
      start = (k + 1) % byHue.length;
    }
  }
  return [...byHue.slice(start), ...byHue.slice(0, start)];
}

// Smooth path

/** A greedy walk from `start` to the nearest unvisited color each time (ties: palette order). */
function nearestNeighbor(start: number, d: readonly (readonly number[])[]): number[] {
  const n = d.length;
  const used = new Array<boolean>(n).fill(false);
  const order = [start];
  used[start] = true;
  for (let k = 1; k < n; k++) {
    const from = order[k - 1] as number;
    let next = -1;
    let best = Infinity;
    for (let j = 0; j < n; j++) {
      if (used[j]) continue;
      const v = at(d, from, j);
      if (v < best) {
        best = v;
        next = j;
      }
    }
    order.push(next);
    used[next] = true;
  }
  return order;
}

/**
 * 2-opt for an open path: reverses the run order[i..j] while that shortens the path. Within the
 * path a reversal swaps two edges; at either end it swaps one, since an open path has no edge out
 * of its ends. Returns a new array; repeats until no reversal helps.
 */
export function twoOpt(order: readonly number[], d: readonly (readonly number[])[]): number[] {
  const p = [...order];
  const n = p.length;
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const pi = p[i] as number;
        const pj = p[j] as number;
        let delta = 0;
        if (i > 0) {
          const before = p[i - 1] as number;
          delta += at(d, before, pj) - at(d, before, pi);
        }
        if (j < n - 1) {
          const after = p[j + 1] as number;
          delta += at(d, pi, after) - at(d, pj, after);
        }
        if (delta < -EPS) {
          for (let a = i, b = j; a < b; a++, b--) {
            const t = p[a] as number;
            p[a] = p[b] as number;
            p[b] = t;
          }
          improved = true;
        }
      }
    }
  }
  return p;
}

/**
 * The Smooth path order (spec 4.2, 7.6): an open path through every color that keeps the total
 * neighbor ΔE small. Nearest neighbor from every start keeps the shortest walk, then 2-opt
 * improves it. The result starts at whichever end comes first in palette order (plan D13).
 * Returns indexes into `labs`.
 */
export function smoothPath(labs: readonly Oklab[], metric: DistanceMetric): number[] {
  const n = labs.length;
  if (n <= 2) return labs.map((_, i) => i);
  const d = distanceMatrix(labs, metric);
  let best: number[] = [];
  let bestCost = Infinity;
  for (let s = 0; s < n; s++) {
    const walk = nearestNeighbor(s, d);
    const cost = pathCost(walk, d);
    if (cost < bestCost - EPS) {
      best = walk;
      bestCost = cost;
    }
  }
  const path = twoOpt(best, d);
  return (path[0] as number) > (path[n - 1] as number) ? path.reverse() : path;
}

// Most distinct

/**
 * The `n` most distinct colors (plan D14): the farthest pair first, then each time the color
 * farthest from all those chosen (largest smallest distance). Ties go to palette order. Returns
 * indexes in palette order; all of them when `n` ≥ the count.
 */
export function mostDistinct(labs: readonly Oklab[], n: number, metric: DistanceMetric): number[] {
  const count = labs.length;
  const want = Math.max(1, Math.floor(n));
  if (want >= count) return labs.map((_, i) => i);
  if (want === 1) return [0];
  const d = distanceMatrix(labs, metric);
  let pair: [number, number] = [0, 1];
  let far = -1;
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      if (at(d, i, j) > far + EPS) {
        far = at(d, i, j);
        pair = [i, j];
      }
    }
  }
  const chosen = new Set<number>(pair);
  // Each color's distance to the nearest chosen one.
  const nearest = labs.map((_, i) => Math.min(at(d, i, pair[0]), at(d, i, pair[1])));
  while (chosen.size < want) {
    let next = -1;
    let best = -1;
    for (let i = 0; i < count; i++) {
      if (chosen.has(i)) continue;
      if ((nearest[i] as number) > best + EPS) {
        best = nearest[i] as number;
        next = i;
      }
    }
    chosen.add(next);
    for (let i = 0; i < count; i++) nearest[i] = Math.min(nearest[i] as number, at(d, i, next));
  }
  return [...chosen].sort((a, b) => a - b);
}

// Constrained random

/** The `RANDOM_TRIES` seeded Fisher-Yates shuffles of 0..n−1 that Constrained random tries. */
export function randomTries(n: number, seed: number): number[][] {
  const rng = mulberry32(seed);
  const tries: number[][] = [];
  for (let t = 0; t < RANDOM_TRIES; t++) {
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = order[i] as number;
      order[i] = order[j] as number;
      order[j] = tmp;
    }
    tries.push(order);
  }
  return tries;
}

/**
 * Constrained random (spec 4.2; plan D15): seeded shuffles, keeping the first whose every pair of
 * neighbors is at least `minDeltaE` apart (stored in ΔE OK units, scaled to the metric's own as
 * the merge threshold is) and has WCAG contrast at least `minContrast` (1 is off). When no try
 * meets both, the order whose worst neighbor pair comes closest is kept, with `met` false.
 *
 * A try's score is its worst ratio of value to threshold over neighbors and active constraints, so
 * with one constraint on, the best try is the one with the largest smallest-neighbor value. The
 * score is at least 1 exactly when the constraints are met.
 */
export function constrainedRandom(
  colors: readonly Oklch[],
  seed: number,
  minDeltaE: number,
  minContrast: number,
  metric: DistanceMetric,
): { order: number[]; met: boolean } {
  const n = colors.length;
  const deMin = minDeltaE > 0 ? thresholdFor(metric, minDeltaE) : 0;
  const crMin = minContrast > 1 ? minContrast : 0;
  const labs = colors.map(oklchToOklab);
  const d = distanceMatrix(labs, metric);
  const hex = colors.map(oklchToHex);
  const contrast = (i: number, j: number) => contrastRatio(hex[i] as string, hex[j] as string);

  const score = (order: readonly number[]): number => {
    let worst = Infinity;
    for (let k = 1; k < order.length; k++) {
      const i = order[k - 1] as number;
      const j = order[k] as number;
      if (deMin > 0) worst = Math.min(worst, at(d, i, j) / deMin);
      if (crMin > 0) worst = Math.min(worst, contrast(i, j) / crMin);
    }
    return worst;
  };

  const tries = randomTries(n, seed);
  let best = tries[0] as number[];
  let bestScore = -Infinity;
  for (const order of tries) {
    const s = score(order);
    if (s >= 1) return { order, met: true };
    if (s > bestScore) {
      best = order;
      bestScore = s;
    }
  }
  return { order: best, met: n < 2 };
}

// Population-weighted

/**
 * Stop positions for Population-weighted (plan D16): each swatch gets a band in proportion to its
 * share (normalized over the swatches given, at least 2% each); stops sit at the band centers,
 * stretched so the first is at 0 and the last at 1. All-zero shares give equal bands.
 */
export function populationPositions(shares: readonly number[]): number[] {
  const n = shares.length;
  if (n === 0) return [];
  if (n === 1) return [0];
  const clean = shares.map((s) => (Number.isFinite(s) && s > 0 ? s : 0));
  const total = clean.reduce((a, b) => a + b, 0);
  const widths = clean.map((s) => Math.max(total > 0 ? s / total : 0, MIN_POPULATION_SHARE));
  const centers: number[] = [];
  let edge = 0;
  for (const w of widths) {
    centers.push(edge + w / 2);
    edge += w;
  }
  const first = centers[0] as number;
  const span = (centers[n - 1] as number) - first;
  return centers.map((c, i) => (i === n - 1 ? 1 : (c - first) / span));
}

// The seams `sources.ts` calls

const labsOf = (swatches: readonly Swatch[]): Oklab[] => swatches.map((s) => oklchToOklab(s.color));
const pick = (swatches: readonly Swatch[], order: readonly number[]): Swatch[] =>
  order.map((i) => swatches[i] as Swatch);

/**
 * Stops for the Sorted, Smooth path, Constrained random and Population-weighted techniques over
 * `swatches` (the Colors subset, in palette order), linked by swatch id.
 */
export function orderedStops(
  technique: Technique,
  swatches: readonly Swatch[],
  metric: DistanceMetric = currentMetric(),
): GradientStop[] {
  switch (technique.kind) {
    case "sorted":
      return swatchStops(sortSwatches(swatches, technique.sortBy));
    case "smooth-path":
      return swatchStops(pick(swatches, smoothPath(labsOf(swatches), metric)));
    case "random": {
      const { order } = constrainedRandom(
        swatches.map((s) => s.color),
        technique.seed,
        technique.minDeltaE,
        technique.minContrast,
        metric,
      );
      return swatchStops(pick(swatches, order));
    }
    case "population":
      return swatchStops(swatches, populationPositions(swatches.map((s) => s.population)));
    default:
      return swatchStops(swatches);
  }
}

/** The `count` most distinct swatches (plan D14), in palette order. */
export function distinctSwatches(
  swatches: readonly Swatch[],
  count: number,
  metric: DistanceMetric = currentMetric(),
): Swatch[] {
  return pick(swatches, mostDistinct(labsOf(swatches), count, metric));
}
