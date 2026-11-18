/**
 * Pixel filters (spec 2.1 step 3, 2.4): the alpha cutoff, ignore dark, ignore light and minimum
 * chroma. Lightness and chroma are OKLab L and C whatever the working space, so the same pixels
 * are dropped in every space (M2 decision 3). The result is a per-pixel keep mask that the
 * histogram and exact colors read. Pure; runs in the worker.
 */
import { rgb8ToWorking } from "../color/working-space";
import type { ExtractionSettings } from "../types";

export type PixelFilters = Pick<
  ExtractionSettings,
  "alphaCutoff" | "ignoreDark" | "ignoreLight" | "minChroma"
>;

export interface FilterResult {
  /** One entry per pixel: 1 keeps the pixel, 0 drops it. */
  mask: Uint8Array;
  /** Number of pixels kept. */
  kept: number;
}

/**
 * Keeps a pixel when its alpha is at least the cutoff, and, for each filter that is on, its OKLab
 * L is not below the dark threshold, not above the light threshold, and its chroma is not below
 * the minimum.
 */
export function filterPixels(rgba: Uint8ClampedArray | Uint8Array, f: PixelFilters): FilterResult {
  const count = Math.floor(rgba.length / 4);
  const mask = new Uint8Array(count);
  const dark = f.ignoreDark.on ? f.ignoreDark.threshold : Number.NEGATIVE_INFINITY;
  const light = f.ignoreLight.on ? f.ignoreLight.threshold : Number.POSITIVE_INFINITY;
  const minChroma = Math.max(f.minChroma, 0);
  const needsLab = f.ignoreDark.on || f.ignoreLight.on || minChroma > 0;
  const toOklab = rgb8ToWorking("oklab");
  const lab = new Float64Array(3);
  let kept = 0;
  for (let p = 0, i = 0; p < count; p += 1, i += 4) {
    if ((rgba[i + 3] ?? 0) < f.alphaCutoff) continue;
    if (needsLab) {
      toOklab(rgba[i] ?? 0, rgba[i + 1] ?? 0, rgba[i + 2] ?? 0, lab, 0);
      const l = lab[0] ?? 0;
      if (l < dark || l > light) continue;
      if (minChroma > 0 && Math.hypot(lab[1] ?? 0, lab[2] ?? 0) < minChroma) continue;
    }
    mask[p] = 1;
    kept += 1;
  }
  return { mask, kept };
}
