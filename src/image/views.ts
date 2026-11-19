/**
 * The Palette and Values image views (spec 3.8). Reserved by M3-T2; M3-T11 builds them. The
 * worker's `view` handler calls them on the working master at display size, made in the worker or
 * sent once per image by the main-thread fallback (spec 7.4).
 */
import type { Oklab } from "../color/convert";
import type { AnalysisImage } from "../extract/pipeline";
import type { ViewSettings } from "../types";

/** A drawn view: RGBA pixels at the image's size, and what the rows under the image show. */
export interface DrawnView {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
  /** Palette view: each color's share of the opaque pixels, in palette order; else empty. */
  shares: number[];
  /** Values view: each band's share, dark to light; else empty. */
  bandShares: number[];
}

/** Each pixel takes its nearest palette color in OKLab; optional dither (plan D18). */
export function paletteView(
  _image: AnalysisImage,
  _colors: readonly Oklab[],
  _dither: boolean,
): DrawnView {
  throw new Error("not built: paletteView (M3-T11)");
}

/** Gray bands of OKLab L, each drawn as the gray at its middle (spec 3.8, plan D19). */
export function valuesView(_image: AnalysisImage, _bands: ViewSettings["bands"]): DrawnView {
  throw new Error("not built: valuesView (M3-T11)");
}
