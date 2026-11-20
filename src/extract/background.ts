/**
 * Ignore background, auto-detected from the border (spec 2.4; M2 decision 4). A band 2% of the
 * shorter side wide is sampled around the edge. If one color, give or take ΔE OK 0.04, covers at
 * least half of the band, it is the background, and its pixels connected to the border are
 * flood-filled and removed. Otherwise nothing is removed. Pure; runs in the worker.
 */
import { rgb8ToWorking } from "../color/working-space";
import type { Oklab } from "../types";
import type { AnalysisImage } from "./pipeline";

/** Width of the border band, as a share of the shorter side (decision 4). */
export const BAND_FRACTION = 0.02;
/** Colors within this ΔE OK of the background color count as background (decision 4). */
export const BACKGROUND_DELTA_E = 0.04;
/** Share of the band the background color must cover (decision 4). */
export const BACKGROUND_SHARE = 0.5;

export interface BackgroundResult {
  /** True when a background color was found. */
  found: boolean;
  /** The background color in OKLab, or null. */
  color: Oklab | null;
  /** One entry per pixel: 1 for a removed background pixel. */
  removed: Uint8Array;
  /** Number of pixels removed. */
  count: number;
}

/** Border band width in pixels: 2% of the shorter side, rounded, at least 1. */
export function bandWidth(width: number, height: number): number {
  return Math.max(1, Math.round(BAND_FRACTION * Math.min(width, height)));
}

/** Coarse bins for finding the most common band color: 4 bits per sRGB channel. */
const COARSE_SHIFT = 4;

/**
 * Finds the background color in the border band and removes the pixels of that color connected to
 * the border (4-connected). Pixels below the alpha cutoff are never background, but they still
 * count toward the band, so a mostly transparent border has no background.
 */
export function detectBackground(
  image: AnalysisImage,
  { alphaCutoff }: { alphaCutoff: number },
): BackgroundResult {
  const { width: w, height: h, data } = image;
  const n = Math.max(0, Math.min(w * h, Math.floor(data.length / 4)));
  const removed = new Uint8Array(n);
  const none: BackgroundResult = { found: false, color: null, removed, count: 0 };
  if (n === 0 || w <= 0 || h <= 0) return none;

  const toOklab = rgb8ToWorking("oklab");
  const opaque = (p: number) => (data[p * 4 + 3] ?? 0) >= alphaCutoff;
  const labOf = (p: number, out: Float64Array, o: number) =>
    toOklab(data[p * 4] ?? 0, data[p * 4 + 1] ?? 0, data[p * 4 + 2] ?? 0, out, o);

  // The band's pixels: every pixel within `band` of an edge.
  const band = bandWidth(w, h);
  const bandPixels: number[] = [];
  for (let y = 0; y < h; y += 1) {
    if (y < band || y >= h - band) {
      for (let x = 0; x < w; x += 1) bandPixels.push(y * w + x);
    } else {
      for (let x = 0; x < Math.min(band, w); x += 1) bandPixels.push(y * w + x);
      for (let x = Math.max(band, w - band); x < w; x += 1) bandPixels.push(y * w + x);
    }
  }
  const bandTotal = bandPixels.length;

  // OKLab of the opaque band pixels, and the most common coarse color among them.
  const opaqueBand = bandPixels.filter(opaque);
  const labs = new Float64Array(opaqueBand.length * 3);
  const bins = new Map<number, { count: number; l: number; a: number; b: number }>();
  for (let k = 0; k < opaqueBand.length; k += 1) {
    const p = opaqueBand[k] ?? 0;
    labOf(p, labs, k * 3);
    const i = p * 4;
    const key =
      ((data[i] ?? 0) >> COARSE_SHIFT) * 256 +
      ((data[i + 1] ?? 0) >> COARSE_SHIFT) * 16 +
      ((data[i + 2] ?? 0) >> COARSE_SHIFT);
    const bin = bins.get(key) ?? { count: 0, l: 0, a: 0, b: 0 };
    bin.count += 1;
    bin.l += labs[k * 3] ?? 0;
    bin.a += labs[k * 3 + 1] ?? 0;
    bin.b += labs[k * 3 + 2] ?? 0;
    bins.set(key, bin);
  }
  let mode: { key: number; count: number; l: number; a: number; b: number } | null = null;
  for (const [key, bin] of bins) {
    if (!mode || bin.count > mode.count || (bin.count === mode.count && key < mode.key)) {
      mode = { key, ...bin };
    }
  }
  if (!mode) return none;

  const limit = BACKGROUND_DELTA_E * BACKGROUND_DELTA_E;
  const near = (ref: Oklab, l: number, a: number, b: number) =>
    (l - ref.l) ** 2 + (a - ref.a) ** 2 + (b - ref.b) ** 2 <= limit;
  /** Band pixels within ΔE OK 0.04 of a color, and their mean. */
  const cover = (ref: Oklab) => {
    let count = 0;
    let l = 0;
    let a = 0;
    let b = 0;
    for (let k = 0; k < opaqueBand.length; k += 1) {
      const pl = labs[k * 3] ?? 0;
      const pa = labs[k * 3 + 1] ?? 0;
      const pb = labs[k * 3 + 2] ?? 0;
      if (!near(ref, pl, pa, pb)) continue;
      count += 1;
      l += pl;
      a += pa;
      b += pb;
    }
    return { count, mean: count > 0 ? { l: l / count, a: a / count, b: b / count } : ref };
  };
  // Start from the most common coarse color's mean, then re-center once on the pixels it covers.
  const seed: Oklab = { l: mode.l / mode.count, a: mode.a / mode.count, b: mode.b / mode.count };
  const first = cover(seed);
  const second = cover(first.mean);
  const [color, covered] =
    second.count >= first.count ? [first.mean, second.count] : [seed, first.count];
  if (covered < BACKGROUND_SHARE * bandTotal) return none;

  // Flood fill from the outermost pixels through pixels of the background color.
  // state: 0 not looked at, 1 background, 2 not background.
  const state = new Uint8Array(n);
  const stack = new Int32Array(n);
  const one = new Float64Array(3);
  let top = 0;
  const visit = (p: number) => {
    if (state[p] !== 0) return;
    if (opaque(p)) {
      labOf(p, one, 0);
      if (near(color, one[0] ?? 0, one[1] ?? 0, one[2] ?? 0)) {
        state[p] = 1;
        stack[top++] = p;
        return;
      }
    }
    state[p] = 2;
  };
  for (let x = 0; x < w; x += 1) {
    visit(x);
    visit((h - 1) * w + x);
  }
  for (let y = 1; y < h - 1; y += 1) {
    visit(y * w);
    visit(y * w + w - 1);
  }
  let count = 0;
  while (top > 0) {
    const p = stack[--top] ?? 0;
    removed[p] = 1;
    count += 1;
    const x = p % w;
    if (x > 0) visit(p - 1);
    if (x < w - 1) visit(p + 1);
    if (p >= w) visit(p - w);
    if (p + w < n) visit(p + w);
  }
  return { found: true, color, removed, count };
}
