/**
 * The cluster map (spec 2.6): which swatch each analysis pixel belongs to. A swatch's pixels are
 * those that pass the filters and are nearest to it in the working space (M2 decision 13a); the
 * whole image is used (no region of interest, decision 15a). Pure; runs in the worker, so the UI
 * thread never loops over the pixels (spec 7.4).
 */
import { type Oklab, oklabToLab, oklabToLinearRgb, oklabToRgb } from "../color/convert";
import { rgb8ToWorking } from "../color/working-space";
import type { WorkingSpace } from "../types";
import type { AnalysisImage } from "./pipeline";

/** The label of a pixel the filters dropped. */
export const FILTERED = 255;

/** The most swatches a map can label: the indices 0 to 254, since 255 marks filtered pixels. */
export const MAX_MAP_COLORS = FILTERED;

export interface ClusterMap {
  /** Size of the analysis copy the map was made from. */
  width: number;
  height: number;
  /** One entry per analysis pixel, row by row: the nearest swatch's index, or FILTERED. */
  labels: Uint8Array;
  /** Each swatch's share of the kept pixels, in palette order; they sum to 1 (all 0 if none kept). */
  shares: number[];
}

/** An OKLab color in working-space coordinates, unclamped, to compare with converted pixels. */
function toWorking(space: WorkingSpace, c: Oklab): [number, number, number] {
  switch (space) {
    case "oklab":
      return [c.l, c.a, c.b];
    case "cielab": {
      const lab = oklabToLab(c);
      return [lab.l, lab.a, lab.b];
    }
    case "linear-srgb": {
      const rgb = oklabToLinearRgb(c);
      return [rgb.r, rgb.g, rgb.b];
    }
    case "srgb": {
      const rgb = oklabToRgb(c);
      return [rgb.r, rgb.g, rgb.b];
    }
  }
}

/**
 * Labels every pixel kept by `keep` (1 keeps, 0 drops) with the index of the nearest color in the
 * working space, by Euclidean distance; ties go to the lower index. Dropped pixels get FILTERED.
 */
export function assignPixels(
  image: AnalysisImage,
  keep: Uint8Array,
  colors: readonly Oklab[],
  space: WorkingSpace,
): ClusterMap {
  if (colors.length > MAX_MAP_COLORS) {
    throw new Error(`A cluster map labels at most ${MAX_MAP_COLORS} colors`);
  }
  const count = image.width * image.height;
  const labels = new Uint8Array(count).fill(FILTERED);
  const k = colors.length;
  const centers = new Float64Array(k * 3);
  for (const [i, c] of colors.entries()) centers.set(toWorking(space, c), i * 3);
  const counts = new Float64Array(k);
  const convert = rgb8ToWorking(space);
  const p = new Float64Array(3);
  const data = image.data;
  let kept = 0;
  // Consecutive pixels often share a color, so the last answer is reused.
  let lastKey = -1;
  let lastLabel = 0;
  for (let i = 0; i < count; i += 1) {
    if (keep[i] !== 1 || k === 0) continue;
    const o = i * 4;
    const key = ((data[o] ?? 0) << 16) | ((data[o + 1] ?? 0) << 8) | (data[o + 2] ?? 0);
    if (key !== lastKey) {
      convert(data[o] ?? 0, data[o + 1] ?? 0, data[o + 2] ?? 0, p, 0);
      const x = p[0] ?? 0;
      const y = p[1] ?? 0;
      const z = p[2] ?? 0;
      let best = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let j = 0; j < k; j += 1) {
        const dx = x - (centers[j * 3] ?? 0);
        const dy = y - (centers[j * 3 + 1] ?? 0);
        const dz = z - (centers[j * 3 + 2] ?? 0);
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bestDistance) {
          bestDistance = d;
          best = j;
        }
      }
      lastKey = key;
      lastLabel = best;
    }
    labels[i] = lastLabel;
    counts[lastLabel] = (counts[lastLabel] ?? 0) + 1;
    kept += 1;
  }
  const shares = Array.from(counts, (n) => (kept > 0 ? n / kept : 0));
  return { width: image.width, height: image.height, labels, shares };
}

/** The neutral mid-gray the overlay dims other pixels toward (M2 decision 13b), as sRGB 0 to 255. */
export const OVERLAY_GRAY = 128;
/** How far other pixels are dimmed toward OVERLAY_GRAY: about 70% (decision 13b), as alpha. */
export const OVERLAY_ALPHA = Math.round(0.7 * 255);

/**
 * The overlay for one swatch's cluster map (spec 2.6), as RGBA pixels the size of the map: the
 * swatch's pixels are clear, so the image shows through unchanged, and every other pixel, filtered
 * ones included, is OVERLAY_GRAY at OVERLAY_ALPHA. It is the same in both themes. Runs in the worker.
 */
export function overlayPixels(labels: Uint8Array, index: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(labels.length * 4);
  for (let i = 0; i < labels.length; i += 1) {
    if (labels[i] === index) continue;
    const o = i * 4;
    rgba[o] = OVERLAY_GRAY;
    rgba[o + 1] = OVERLAY_GRAY;
    rgba[o + 2] = OVERLAY_GRAY;
    rgba[o + 3] = OVERLAY_ALPHA;
  }
  return rgba;
}

/** A pixel of the swatch's region that touches a pixel outside it (the dark, inner line). */
export const EDGE_INNER = 1;
/** A pixel outside the region that touches a pixel inside it (the light, outer line). */
export const EDGE_OUTER = 2;

/**
 * The boundary of one swatch's region in a label map (spec 2.6, M3 decision 61), by the 4-neighbour
 * edge test: a region pixel with a 4-neighbour outside the region is EDGE_INNER, and a pixel outside
 * with a 4-neighbour in the region is EDGE_OUTER. Everything else is 0. The map's own border is not
 * an edge. Together the two make a 2 px line along the boundary: light outside, dark inside. Runs in
 * the worker, at the map's resolution.
 */
export function regionBoundary(
  labels: Uint8Array,
  width: number,
  height: number,
  index: number,
): Uint8Array {
  const edges = new Uint8Array(labels.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = y * width + x;
      const inside = labels[at] === index;
      const touches = (neighbour: number): boolean => (labels[neighbour] === index) !== inside;
      if (
        (x > 0 && touches(at - 1)) ||
        (x < width - 1 && touches(at + 1)) ||
        (y > 0 && touches(at - width)) ||
        (y < height - 1 && touches(at + width))
      ) {
        edges[at] = inside ? EDGE_INNER : EDGE_OUTER;
      }
    }
  }
  return edges;
}

/** The outline's light line (outside the region) as RGBA; the same in both themes. */
export const OUTLINE_LIGHT = [255, 255, 255, 230] as const;
/** The outline's dark line (inside the region) as RGBA. */
export const OUTLINE_DARK = [22, 22, 22, 230] as const;

/**
 * The overlay for a cluster map with the swatch's region outlined (M3 decision 61): the dimming of
 * `overlayPixels`, then a 1 px light line just outside the region and a 1 px dark line just inside
 * it, like the marker ring. Both are fixed colors, so it is the same in both themes. Runs in the worker.
 */
export function outlinedOverlayPixels(
  labels: Uint8Array,
  width: number,
  height: number,
  index: number,
): Uint8ClampedArray {
  const rgba = overlayPixels(labels, index);
  const edges = regionBoundary(labels, width, height, index);
  for (let i = 0; i < edges.length; i += 1) {
    const edge = edges[i];
    if (!edge) continue;
    rgba.set(edge === EDGE_INNER ? OUTLINE_DARK : OUTLINE_LIGHT, i * 4);
  }
  return rgba;
}
