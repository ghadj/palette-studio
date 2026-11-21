/**
 * The mean color of an annulus of the working master (spec 3.7, 4.2 "Image sample", radial scan;
 * plan D18). The worker calls it on the master at display size, so the UI thread never loops over
 * pixels (spec 7.4).
 */
import type { Oklab } from "../color/convert";
import { rgb8ToWorking } from "../color/working-space";
import type { AnalysisImage } from "../extract/pipeline";
import type { ImagePoint } from "../types";

/**
 * The mean OKLab color of the pixels between radii `r0` and `r1` around `center` (a pixel counts
 * when its center is at a distance d with r0 <= d < r1; r0 = 0 includes the center). The center is
 * normalized to 0 to 1 on each axis, the radii are fractions of the image's width. Transparent
 * pixels count only when every pixel of the ring is transparent. A ring that holds no pixel (a thin
 * one on a tiny image) gives the pixel nearest its middle.
 */
export function ringMean(image: AnalysisImage, center: ImagePoint, r0: number, r1: number): Oklab {
  const { width, height, data } = image;
  const cx = center.x * width;
  const cy = center.y * height;
  const lo = Math.max(0, r0) * width;
  const hi = Math.max(0, r1) * width;
  const convert = rgb8ToWorking("oklab");
  const lab = new Float64Array(3);
  let l = 0;
  let a = 0;
  let b = 0;
  let n = 0;
  let tl = 0;
  let ta = 0;
  let tb = 0;
  let tn = 0;
  const top = Math.max(0, Math.floor(cy - hi));
  const bottom = Math.min(height - 1, Math.ceil(cy + hi));
  const left = Math.max(0, Math.floor(cx - hi));
  const right = Math.min(width - 1, Math.ceil(cx + hi));
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d >= hi || d < lo) continue;
      const o = (y * width + x) * 4;
      convert(data[o] ?? 0, data[o + 1] ?? 0, data[o + 2] ?? 0, lab, 0);
      tl += lab[0] ?? 0;
      ta += lab[1] ?? 0;
      tb += lab[2] ?? 0;
      tn += 1;
      if ((data[o + 3] ?? 0) > 0) {
        l += lab[0] ?? 0;
        a += lab[1] ?? 0;
        b += lab[2] ?? 0;
        n += 1;
      }
    }
  }
  if (n > 0) return { l: l / n, a: a / n, b: b / n };
  if (tn > 0) return { l: tl / tn, a: ta / tn, b: tb / tn };
  const mid = (lo + hi) / 2;
  const x = Math.min(width - 1, Math.max(0, Math.floor(cx + mid)));
  const y = Math.min(height - 1, Math.max(0, Math.floor(cy)));
  const o = (y * width + x) * 4;
  convert(data[o] ?? 0, data[o + 1] ?? 0, data[o + 2] ?? 0, lab, 0);
  return { l: lab[0] ?? 0, a: lab[1] ?? 0, b: lab[2] ?? 0 };
}
