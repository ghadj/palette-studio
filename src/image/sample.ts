/**
 * Patch sampling under a marker (spec 3.7, plan M3-T10 and D8): the color of the master pixels
 * within the sample radius of a point, as the mean in OKLab or the per-channel median, and the
 * loupe's crop. The worker's `sample` handler calls it with a window of the working master, read
 * in the worker or sent by the main-thread fallback (spec 7.4).
 */
import type { Oklab } from "../color/convert";
import { rgb8ToWorking } from "../color/working-space";
import type { ImagePoint, SampleStat } from "../types";
import { type MasterWindow, masterPixel } from "./tiers";

/** The loupe's crop is this many master pixels on each side, centered on the point. */
export const CROP_SIZE = 15;

export interface PatchSample {
  /** The patch's color: the mean in OKLab, or the per-channel median (plan D8). */
  color: Oklab;
  /** RGBA bytes, CROP_SIZE × CROP_SIZE, clamped at the image edges. */
  crop: Uint8ClampedArray<ArrayBuffer>;
}

/** Auto sample radius in master pixels: 0.5% of the shorter side, at least 2 px (spec 3.7). */
export function autoRadius(width: number, height: number): number {
  return Math.max(2, Math.round(0.005 * Math.min(width, height)));
}

/** The lower middle of a list of numbers, so the median is always one of them. */
function lowerMedian(values: Float64Array): number {
  const sorted = values.slice().sort();
  return sorted[(sorted.length - 1) >> 1] ?? 0;
}

/**
 * Samples the master pixels within `radius` master pixels of a normalized point: the disc around
 * the point's pixel, cut at the image edges. Transparent pixels count only when the whole patch is
 * transparent. The crop is centered on the point's pixel; where it passes an image edge, it
 * repeats the edge pixels, so the point stays at the crop's center.
 */
export function samplePatch(
  window: MasterWindow,
  point: ImagePoint,
  radius: number,
  stat: SampleStat,
): PatchSample {
  const data = new Uint8ClampedArray(window.data);
  const center = masterPixel(point, window.masterWidth, window.masterHeight);
  // The window holds every master pixel near the point; outside it is outside the image.
  const right = window.left + window.width - 1;
  const bottom = window.top + window.height - 1;
  const offset = (x: number, y: number) =>
    ((y - window.top) * window.width + (x - window.left)) * 4;

  const r = Math.max(0, Math.floor(radius));
  const inside: number[] = [];
  const opaque: number[] = [];
  for (let y = Math.max(window.top, center.y - r); y <= Math.min(bottom, center.y + r); y += 1) {
    for (let x = Math.max(window.left, center.x - r); x <= Math.min(right, center.x + r); x += 1) {
      const dx = x - center.x;
      const dy = y - center.y;
      if (dx * dx + dy * dy > r * r) continue;
      const o = offset(x, y);
      inside.push(o);
      if ((data[o + 3] ?? 0) > 0) opaque.push(o);
    }
  }
  const pixels = opaque.length > 0 ? opaque : inside;

  const convert = rgb8ToWorking("oklab");
  const lab = new Float64Array(3);
  const n = pixels.length;
  const channels = [new Float64Array(n), new Float64Array(n), new Float64Array(n)] as const;
  for (const [j, o] of pixels.entries()) {
    convert(data[o] ?? 0, data[o + 1] ?? 0, data[o + 2] ?? 0, lab, 0);
    channels[0][j] = lab[0] ?? 0;
    channels[1][j] = lab[1] ?? 0;
    channels[2][j] = lab[2] ?? 0;
  }
  const reduce =
    stat === "median"
      ? lowerMedian
      : (values: Float64Array) => values.reduce((sum, v) => sum + v, 0) / values.length;
  const color: Oklab = {
    l: reduce(channels[0]),
    a: reduce(channels[1]),
    b: reduce(channels[2]),
  };

  const half = (CROP_SIZE - 1) / 2;
  const crop = new Uint8ClampedArray(CROP_SIZE * CROP_SIZE * 4);
  for (let cy = 0; cy < CROP_SIZE; cy += 1) {
    const y = Math.min(bottom, Math.max(window.top, center.y + cy - half));
    for (let cx = 0; cx < CROP_SIZE; cx += 1) {
      const x = Math.min(right, Math.max(window.left, center.x + cx - half));
      const o = offset(x, y);
      crop.set(data.subarray(o, o + 4), (cy * CROP_SIZE + cx) * 4);
    }
  }
  return { color, crop };
}
