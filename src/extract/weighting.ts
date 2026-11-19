/**
 * Spatial weighting (spec 2.4; M2 decision 9): per-pixel weights that the histogram and exact
 * colors count instead of 1, so populations become weighted shares (decision 9b).
 * - Center: a Gaussian with σ 0.35 on the distance from the image center, normalized so the
 *   corners are at 1.
 * - Contrast: 0.25 plus the Sobel gradient magnitude of OKLab L, normalized by its largest value in
 *   the image. A flat image therefore weighs every pixel the same, like uniform.
 * Pure; runs in the worker.
 */
import { rgb8ToWorking } from "../color/working-space";
import type { SpatialWeighting } from "../types";
import type { AnalysisImage } from "./pipeline";

/** σ of the center Gaussian, on the normalized distance (decision 9a). */
export const CENTER_SIGMA = 0.35;
/** The contrast weight of a pixel with no gradient (decision 9a). */
export const CONTRAST_FLOOR = 0.25;

/** Distance from the center to a corner, in coordinates that run from −0.5 to 0.5 on each axis. */
const CORNER = Math.SQRT1_2;

/**
 * Center weight at (u, v), each running from −0.5 (left or top edge) to 0.5 (right or bottom
 * edge): exp(−d² / 2σ²) with d the distance from the center divided by the corner distance.
 */
export function centerWeight(u: number, v: number): number {
  const d = Math.hypot(u, v) / CORNER;
  return Math.exp(-(d * d) / (2 * CENTER_SIGMA * CENTER_SIGMA));
}

/** Per-pixel weights for a weighting mode, or null for uniform (every pixel counts 1). */
export function spatialWeights(image: AnalysisImage, mode: SpatialWeighting): Float64Array | null {
  switch (mode) {
    case "center":
      return centerWeights(image);
    case "contrast":
      return contrastWeights(image);
    default:
      return null;
  }
}

function centerWeights({ width: w, height: h }: AnalysisImage): Float64Array {
  const out = new Float64Array(w * h);
  for (let y = 0; y < h; y += 1) {
    const v = (y + 0.5) / h - 0.5;
    for (let x = 0; x < w; x += 1) out[y * w + x] = centerWeight((x + 0.5) / w - 0.5, v);
  }
  return out;
}

function contrastWeights({ width: w, height: h, data }: AnalysisImage): Float64Array {
  const n = w * h;
  const lightness = new Float64Array(n);
  const toOklab = rgb8ToWorking("oklab");
  const lab = new Float64Array(3);
  for (let p = 0; p < n; p += 1) {
    toOklab(data[p * 4] ?? 0, data[p * 4 + 1] ?? 0, data[p * 4 + 2] ?? 0, lab, 0);
    lightness[p] = lab[0] ?? 0;
  }
  // Sobel 3 × 3, with edge pixels repeated past the border.
  const L = (x: number, y: number) =>
    lightness[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))] ?? 0;
  const magnitude = new Float64Array(n);
  let max = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      // Each side is summed on its own, so equal sides cancel exactly on flat areas.
      const gx =
        L(x + 1, y - 1) +
        2 * L(x + 1, y) +
        L(x + 1, y + 1) -
        (L(x - 1, y - 1) + 2 * L(x - 1, y) + L(x - 1, y + 1));
      const gy =
        L(x - 1, y + 1) +
        2 * L(x, y + 1) +
        L(x + 1, y + 1) -
        (L(x - 1, y - 1) + 2 * L(x, y - 1) + L(x + 1, y - 1));
      const m = Math.hypot(gx, gy);
      magnitude[y * w + x] = m;
      if (m > max) max = m;
    }
  }
  const out = new Float64Array(n);
  for (let p = 0; p < n; p += 1) {
    out[p] = CONTRAST_FLOOR + (max > 0 ? (magnitude[p] ?? 0) / max : 0);
  }
  return out;
}
