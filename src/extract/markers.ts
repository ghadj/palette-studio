/**
 * Marker placement (spec 3.7, plan M3-T10): where each swatch's color lives in the image. For each
 * swatch, the cluster map's pixels of that swatch form a mask; a box blur of about 3% of the
 * shorter side gives each pixel a density, and the marker goes on the swatch's pixel with the
 * highest density. The blur sums integer counts with a summed-area table, so equal densities are
 * exactly equal and ties are decided by rule, not by rounding:
 *
 * 1. the smallest ΔE OK between the pixel and the swatch color (spec 3.7),
 * 2. the pixel nearest the middle (centroid) of the pixels still tied, so a flat patch gets its
 *    marker in its center rather than at its top-left corner,
 * 3. the lowest y, then the lowest x.
 *
 * A swatch with no pixels gets the pixel nearest its color. Pure; runs in the worker on the
 * analysis copy, or on the pixels the main-thread fallback sends (spec 7.4).
 */
import type { Oklab } from "../color/convert";
import { rgb8ToWorking } from "../color/working-space";
import type { ImagePoint } from "../types";
import { FILTERED } from "./cluster-map";
import type { AnalysisImage } from "./pipeline";

/** The blur's radius in analysis pixels: 3% of the shorter side, rounded, at least 1 px. */
export function blurRadius(width: number, height: number): number {
  return Math.max(1, Math.round(0.03 * Math.min(width, height)));
}

/** The normalized point at the center of analysis pixel `index`. */
function centerOf(index: number, width: number, height: number): ImagePoint {
  const x = index % width;
  const y = (index - x) / width;
  return { x: (x + 0.5) / width, y: (y + 0.5) / height };
}

/** ΔE OK between analysis pixels and a color, cached by pixel color. */
function distanceTo(analysis: AnalysisImage, color: Oklab): (index: number) => number {
  const convert = rgb8ToWorking("oklab");
  const lab = new Float64Array(3);
  const cache = new Map<number, number>();
  const data = analysis.data;
  return (index) => {
    const o = index * 4;
    const r = data[o] ?? 0;
    const g = data[o + 1] ?? 0;
    const b = data[o + 2] ?? 0;
    const key = (r << 16) | (g << 8) | b;
    let d = cache.get(key);
    if (d === undefined) {
      convert(r, g, b, lab, 0);
      d = Math.hypot((lab[0] ?? 0) - color.l, (lab[1] ?? 0) - color.a, (lab[2] ?? 0) - color.b);
      cache.set(key, d);
    }
    return d;
  };
}

/**
 * The pixel nearest a color: among the kept pixels, or every pixel when the filters dropped all
 * of them. Ties go to the first in reading order (lowest y, then lowest x).
 */
function closestPixel(labels: Uint8Array, analysis: AnalysisImage, color: Oklab): number {
  const distance = distanceTo(analysis, color);
  const anyKept = labels.some((label) => label !== FILTERED);
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < labels.length; i += 1) {
    if (anyKept && labels[i] === FILTERED) continue;
    const d = distance(i);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
}

/**
 * One normalized point per color: where its swatch's pixels are densest in the cluster map's
 * per-pixel `labels` (palette index per analysis pixel, FILTERED for filtered pixels). `analysis`
 * is the image the labels were made from, `width` × `height` RGBA.
 */
export function placeMarkers(
  labels: Uint8Array,
  width: number,
  height: number,
  colors: readonly Oklab[],
  analysis: AnalysisImage,
): ImagePoint[] {
  const count = width * height;
  if (labels.length !== count || analysis.width !== width || analysis.height !== height) {
    throw new Error("The cluster map and the analysis copy differ in size");
  }
  const pixelsOf = new Int32Array(colors.length);
  for (const label of labels)
    if (label < colors.length) pixelsOf[label] = (pixelsOf[label] ?? 0) + 1;

  const r = blurRadius(width, height);
  const stride = width + 1;
  // sat[(y + 1) * stride + x + 1] counts the swatch's pixels in rows 0..y and columns 0..x.
  const sat = new Int32Array(stride * (height + 1));
  const candidates: number[] = [];

  return colors.map((color, k) => {
    if (pixelsOf[k] === 0) return centerOf(closestPixel(labels, analysis, color), width, height);

    for (let y = 0; y < height; y += 1) {
      let rowSum = 0;
      const row = y * width;
      const above = y * stride;
      const here = (y + 1) * stride;
      for (let x = 0; x < width; x += 1) {
        if (labels[row + x] === k) rowSum += 1;
        sat[here + x + 1] = (sat[above + x + 1] ?? 0) + rowSum;
      }
    }
    // The box sum around each of the swatch's pixels; outside the image counts as empty.
    const density = (x: number, y: number): number => {
      const x0 = Math.max(0, x - r);
      const y0 = Math.max(0, y - r);
      const x1 = Math.min(width, x + r + 1);
      const y1 = Math.min(height, y + r + 1);
      return (
        (sat[y1 * stride + x1] ?? 0) -
        (sat[y0 * stride + x1] ?? 0) -
        (sat[y1 * stride + x0] ?? 0) +
        (sat[y0 * stride + x0] ?? 0)
      );
    };

    // 1. The highest density among the swatch's pixels.
    let best = -1;
    candidates.length = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        if (labels[i] !== k) continue;
        const d = density(x, y);
        if (d > best) {
          best = d;
          candidates.length = 0;
        }
        if (d === best) candidates.push(i);
      }
    }

    // 2. The smallest ΔE to the swatch color.
    const distance = distanceTo(analysis, color);
    let nearest = Number.POSITIVE_INFINITY;
    for (const i of candidates) nearest = Math.min(nearest, distance(i));
    const tied = candidates.filter((i) => distance(i) === nearest);

    // 3. The pixel nearest the tied pixels' centroid; then reading order (lowest y, then x).
    let sumX = 0;
    let sumY = 0;
    for (const i of tied) {
      sumX += i % width;
      sumY += Math.floor(i / width);
    }
    const cx = sumX / tied.length;
    const cy = sumY / tied.length;
    let chosen = tied[0] ?? 0;
    let chosenDistance = Number.POSITIVE_INFINITY;
    for (const i of tied) {
      const dx = (i % width) - cx;
      const dy = Math.floor(i / width) - cy;
      const d = dx * dx + dy * dy;
      if (d < chosenDistance) {
        chosenDistance = d;
        chosen = i;
      }
    }
    return centerOf(chosen, width, height);
  });
}
