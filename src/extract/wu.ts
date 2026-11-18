/**
 * Wu's color quantizer (Wu 1992; spec 2.2, 7.6) over the weighted histogram. Cumulative moment
 * tables of (2^bits + 1)^3 cells are built over the sRGB bin grid; boxes are cut in that bin-index
 * space, while the moments (weight, weighted color, weighted squared norm) use each bin's
 * working-space mean, so variance and the box means are in the working space. Each step splits the
 * box with the largest variance at the cut that maximizes between-class variance. Pure and
 * deterministic: ties go to the first axis (r, g, b) and the lowest cut.
 */
import type { Histogram } from "./histogram";
import type { Cluster } from "./median-cut";

/** A box of grid cells: lower bounds are exclusive, upper bounds inclusive (Wu's convention). */
interface Box {
  r0: number;
  r1: number;
  g0: number;
  g1: number;
  b0: number;
  b1: number;
}

interface Moments {
  side: number;
  wt: Float64Array;
  m0: Float64Array;
  m1: Float64Array;
  m2: Float64Array;
  sq: Float64Array;
}

/** Builds the cumulative moment tables for a histogram. */
function moments(h: Histogram): Moments {
  const n = 1 << h.bits;
  const side = n + 1;
  const cells = side * side * side;
  const wt = new Float64Array(cells);
  const m0 = new Float64Array(cells);
  const m1 = new Float64Array(cells);
  const m2 = new Float64Array(cells);
  const sq = new Float64Array(cells);
  const mask = n - 1;
  for (let k = 0; k < h.size; k += 1) {
    const bin = h.bins[k] ?? 0;
    const r = ((bin >> (2 * h.bits)) & mask) + 1;
    const g = ((bin >> h.bits) & mask) + 1;
    const b = (bin & mask) + 1;
    const i = (r * side + g) * side + b;
    const w = h.counts[k] ?? 0;
    const x = h.means[k * 3] ?? 0;
    const y = h.means[k * 3 + 1] ?? 0;
    const z = h.means[k * 3 + 2] ?? 0;
    wt[i] = (wt[i] ?? 0) + w;
    m0[i] = (m0[i] ?? 0) + w * x;
    m1[i] = (m1[i] ?? 0) + w * y;
    m2[i] = (m2[i] ?? 0) + w * z;
    sq[i] = (sq[i] ?? 0) + w * (x * x + y * y + z * z);
  }
  // Prefix sums along each axis in turn make every cell the sum of the box from the origin.
  const strides = [side * side, side, 1];
  for (const stride of strides) {
    for (let r = 0; r < side; r += 1) {
      for (let g = 0; g < side; g += 1) {
        for (let b = 0; b < side; b += 1) {
          const i = (r * side + g) * side + b;
          const coord = stride === 1 ? b : stride === side ? g : r;
          if (coord === 0) continue;
          const j = i - stride;
          wt[i] = (wt[i] ?? 0) + (wt[j] ?? 0);
          m0[i] = (m0[i] ?? 0) + (m0[j] ?? 0);
          m1[i] = (m1[i] ?? 0) + (m1[j] ?? 0);
          m2[i] = (m2[i] ?? 0) + (m2[j] ?? 0);
          sq[i] = (sq[i] ?? 0) + (sq[j] ?? 0);
        }
      }
    }
  }
  return { side, wt, m0, m1, m2, sq };
}

/** The sum of a moment table over a box, by inclusion and exclusion. */
function volume(m: Moments, t: Float64Array, x: Box): number {
  const s = m.side;
  const at = (r: number, g: number, b: number) => t[(r * s + g) * s + b] ?? 0;
  return (
    at(x.r1, x.g1, x.b1) -
    at(x.r1, x.g1, x.b0) -
    at(x.r1, x.g0, x.b1) +
    at(x.r1, x.g0, x.b0) -
    at(x.r0, x.g1, x.b1) +
    at(x.r0, x.g1, x.b0) +
    at(x.r0, x.g0, x.b1) -
    at(x.r0, x.g0, x.b0)
  );
}

interface Stats {
  w: number;
  s0: number;
  s1: number;
  s2: number;
}

const stats = (m: Moments, x: Box): Stats => ({
  w: volume(m, m.wt, x),
  s0: volume(m, m.m0, x),
  s1: volume(m, m.m1, x),
  s2: volume(m, m.m2, x),
});

/** Weighted variance of a box (the sum of squared distances to its mean). */
function variance(m: Moments, x: Box): number {
  const s = stats(m, x);
  if (s.w <= 0) return 0;
  return volume(m, m.sq, x) - (s.s0 * s.s0 + s.s1 * s.s1 + s.s2 * s.s2) / s.w;
}

const cells = (x: Box): number => (x.r1 - x.r0) * (x.g1 - x.g0) * (x.b1 - x.b0);

type Axis = 0 | 1 | 2;

function withUpper(x: Box, axis: Axis, v: number): Box {
  if (axis === 0) return { ...x, r1: v };
  if (axis === 1) return { ...x, g1: v };
  return { ...x, b1: v };
}

function withLower(x: Box, axis: Axis, v: number): Box {
  if (axis === 0) return { ...x, r0: v };
  if (axis === 1) return { ...x, g0: v };
  return { ...x, b0: v };
}

const bounds = (x: Box, axis: Axis): [number, number] =>
  axis === 0 ? [x.r0, x.r1] : axis === 1 ? [x.g0, x.g1] : [x.b0, x.b1];

/**
 * The best cut of a box along one axis: the position that maximizes the between-class variance
 * term |sum₁|²/w₁ + |sum₂|²/w₂, with both halves non-empty. Returns the cut and its score.
 */
function maximize(m: Moments, x: Box, axis: Axis, whole: Stats): { cut: number; score: number } {
  const [lo, hi] = bounds(x, axis);
  let best = { cut: -1, score: 0 };
  for (let i = lo + 1; i < hi; i += 1) {
    const half = stats(m, withUpper(x, axis, i));
    if (half.w <= 0) continue;
    const rest: Stats = {
      w: whole.w - half.w,
      s0: whole.s0 - half.s0,
      s1: whole.s1 - half.s1,
      s2: whole.s2 - half.s2,
    };
    // A tiny epsilon keeps rounding from treating an empty half as non-empty.
    if (rest.w <= whole.w * 1e-12) continue;
    const score =
      (half.s0 * half.s0 + half.s1 * half.s1 + half.s2 * half.s2) / half.w +
      (rest.s0 * rest.s0 + rest.s1 * rest.s1 + rest.s2 * rest.s2) / rest.w;
    if (score > best.score) best = { cut: i, score };
  }
  return best;
}

/** Splits a box in two, or returns null when it can't be split into two non-empty boxes. */
function cut(m: Moments, x: Box): [Box, Box] | null {
  const whole = stats(m, x);
  let axis: Axis | null = null;
  let best = { cut: -1, score: 0 };
  for (const a of [0, 1, 2] as const) {
    const found = maximize(m, x, a, whole);
    if (found.cut >= 0 && (axis === null || found.score > best.score)) {
      axis = a;
      best = found;
    }
  }
  if (axis === null) return null;
  return [withUpper(x, axis, best.cut), withLower(x, axis, best.cut)];
}

export function wu(h: Histogram, n: number): Cluster[] {
  if (h.size === 0 || h.total <= 0 || n <= 0) return [];
  const m = moments(h);
  const side = m.side - 1;
  const boxes: Box[] = [{ r0: 0, r1: side, g0: 0, g1: side, b0: 0, b1: side }];
  const vv: number[] = [variance(m, boxes[0] as Box)];
  while (boxes.length < n) {
    // The box with the largest variance; ties go to the earliest box.
    let next = -1;
    for (let i = 0; i < boxes.length; i += 1) {
      if ((vv[i] ?? 0) > 0 && (next < 0 || (vv[i] ?? 0) > (vv[next] ?? 0))) next = i;
    }
    if (next < 0) break;
    const parts = cut(m, boxes[next] as Box);
    if (!parts) {
      vv[next] = 0;
      continue;
    }
    const [a, b] = parts;
    boxes[next] = a;
    boxes.push(b);
    vv[next] = cells(a) > 1 ? variance(m, a) : 0;
    vv.push(cells(b) > 1 ? variance(m, b) : 0);
  }
  const clusters: Cluster[] = [];
  for (const x of boxes) {
    const s = stats(m, x);
    if (s.w <= 0) continue;
    clusters.push({ color: [s.s0 / s.w, s.s1 / s.w, s.s2 / s.w], population: s.w / h.total });
  }
  return clusters;
}
