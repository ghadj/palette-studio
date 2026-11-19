/**
 * Patch sampling under a marker (spec 3.7). Reserved by M3-T2; M3-T10 builds it. The worker's
 * `sample` handler calls it with a window of the working master, read in the worker or sent by
 * the main-thread fallback (spec 7.4).
 */
import type { Oklab } from "../color/convert";
import type { ImagePoint, SampleStat } from "../types";
import type { MasterWindow } from "./tiers";

/** The loupe's crop is this many master pixels on each side, centered on the point. */
export const CROP_SIZE = 15;

export interface PatchSample {
  /** The patch's color: the mean in OKLab, or the per-channel median (plan D8). */
  color: Oklab;
  /** RGBA bytes, CROP_SIZE × CROP_SIZE, clamped at the image edges. */
  crop: Uint8ClampedArray<ArrayBuffer>;
}

/** Auto sample radius in master pixels: 0.5% of the shorter side, at least 2 px (spec 3.7). */
export function autoRadius(_width: number, _height: number): number {
  throw new Error("not built: autoRadius (M3-T10)");
}

/** Samples the pixels within `radius` master pixels of a normalized point. */
export function samplePatch(
  _window: MasterWindow,
  _point: ImagePoint,
  _radius: number,
  _stat: SampleStat,
): PatchSample {
  throw new Error("not built: samplePatch (M3-T10)");
}
