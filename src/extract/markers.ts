/**
 * Marker placement (spec 3.7). Reserved by M3-T2; M3-T10 builds it. The worker's `place` handler
 * and the `extracted` reply's `points` call it, on the worker's analysis copy or the pixels the
 * main-thread fallback sends (spec 7.4).
 */
import type { Oklab } from "../color/convert";
import type { ImagePoint } from "../types";
import type { AnalysisImage } from "./pipeline";

/**
 * One normalized point per color: where its swatch's pixels are densest in the cluster map's
 * per-pixel `labels` (palette index per analysis pixel, 255 for filtered pixels).
 */
export function placeMarkers(
  _labels: Uint8Array,
  _width: number,
  _height: number,
  _colors: readonly Oklab[],
  _analysis: AnalysisImage,
): ImagePoint[] {
  throw new Error("not built: placeMarkers (M3-T10)");
}
