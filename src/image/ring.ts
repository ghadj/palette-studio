/**
 * The mean color of an annulus of the working master (spec 3.7, 4.2 "Image sample", radial scan;
 * plan D18). M4-T2 reserves the signature and the worker's `ring` request; M4-T5 builds the body.
 * The worker calls it on the master at display size, so the UI thread never loops over pixels
 * (spec 7.4).
 */
import type { Oklab } from "../color/convert";
import type { AnalysisImage } from "../extract/pipeline";
import type { ImagePoint } from "../types";

/**
 * The mean OKLab color of the pixels between radii `r0` and `r1` around `center`. All three are
 * normalized: the center to 0 to 1 on each axis, the radii as fractions of the image's width.
 * Not built yet.
 */
export function ringMean(
  _image: AnalysisImage,
  _center: ImagePoint,
  _r0: number,
  _r1: number,
): Oklab {
  throw new Error("not built");
}
