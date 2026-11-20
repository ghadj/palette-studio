/**
 * Image tiers (spec 7.4): the decoded image becomes a working master of at most 4096 px on the
 * longest edge; extraction runs on a much smaller analysis copy at the sample size (spec 2.4).
 * The image shown on screen is a display copy of the master, at most 2048 px, which is plenty for
 * the image well and keeps canvas memory low on phones (spec 6.1).
 *
 * Resampling uses canvas drawing only, so it runs in a worker or, as a fallback, on the main thread
 * without any JavaScript loop over pixels (spec 7.4).
 */
import { DEFAULT_SETTINGS } from "../state/defaults";
import type { ImagePoint, Resampling, SampleSize } from "../types";

export const MASTER_MAX = 4096;
export const DISPLAY_MAX = 2048;
/** The cluster map is made at the display copy's resolution, but at most this many px (M3 decision 36). */
export const MAP_MAX = 1024;

export interface Size {
  width: number;
  height: number;
}

/** Scales down to fit `max` on the longest edge; never scales up, never below 1 px. */
export function fitWithin(width: number, height: number, max: number): Size {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export const masterSize = (width: number, height: number): Size =>
  fitWithin(width, height, MASTER_MAX);

export const displaySize = (width: number, height: number): Size =>
  fitWithin(width, height, DISPLAY_MAX);

/** The cluster map's size: the display copy's, capped at MAP_MAX on the longest edge. */
export const mapSize = (width: number, height: number): Size => {
  const display = displaySize(width, height);
  return fitWithin(display.width, display.height, MAP_MAX);
};

/** The analysis copy for a master of this size. "full" uses the master size. */
export function analysisSize(width: number, height: number, sampleSize: SampleSize): Size {
  return sampleSize === "full" ? { width, height } : fitWithin(width, height, sampleSize);
}

/**
 * Default sample size. M1 decision 5: 256 on every device, departing from spec 6.1's 128 px on
 * phones; to be revisited.
 */
export function defaultSampleSize(_device: { phone: boolean }): SampleSize {
  return DEFAULT_SETTINGS.sampleSize;
}

export type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
export type Ctx2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
export type CreateCanvas = (width: number, height: number) => AnyCanvas;
export type Drawable = ImageBitmap | AnyCanvas;

export function context2d(canvas: AnyCanvas, readback = false): Ctx2D {
  const ctx = canvas.getContext(
    "2d",
    readback ? { willReadFrequently: true } : undefined,
  ) as Ctx2D | null;
  if (!ctx) throw new Error("2D canvas is not available");
  return ctx;
}

/**
 * Draws `source` into a new canvas of the given size.
 * - Nearest: one unsmoothed draw, so every output pixel is an input color (pixel and flat art).
 * - Smooth: repeated halving with bilinear filtering (each halving averages 2 × 2 blocks), then one
 *   final smoothed draw, which approximates an area average.
 */
export function resample(
  source: Drawable,
  target: Size,
  mode: Resampling,
  create: CreateCanvas,
): AnyCanvas {
  if (mode === "nearest") {
    const out = create(target.width, target.height);
    const ctx = context2d(out);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0, target.width, target.height);
    return out;
  }
  let current: Drawable = source;
  let width = source.width;
  let height = source.height;
  const intermediates: AnyCanvas[] = [];
  while (width >= target.width * 2 && height >= target.height * 2) {
    const next = create(Math.max(1, Math.round(width / 2)), Math.max(1, Math.round(height / 2)));
    const ctx = context2d(next);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "low";
    ctx.drawImage(current, 0, 0, next.width, next.height);
    intermediates.push(next);
    current = next;
    width = next.width;
    height = next.height;
  }
  const out = create(target.width, target.height);
  const ctx = context2d(out);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(current, 0, 0, target.width, target.height);
  for (const canvas of intermediates) {
    canvas.width = 0;
    canvas.height = 0;
  }
  return out;
}

/** RGBA bytes of a canvas. getImageData returns sRGB, unpremultiplied (spec 7.9). */
export function readPixels(canvas: AnyCanvas): ImageData {
  return context2d(canvas, true).getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Half the side of the master window a sample reads (spec 3.7): enough for the largest sample
 * radius (11 px, or Auto's 0.5% of a 4096 px master, about 20 px) plus half the loupe's 15 px crop.
 */
export const SAMPLE_WINDOW_HALF = 32;

/**
 * A rectangle of working-master pixels around a point (M3-T2): what marker sampling reads (spec
 * 3.7). The worker reads it from its master; the main-thread fallback reads it here and sends it,
 * so both paths hand the same thing to `samplePatch` (spec 7.4).
 */
export interface MasterWindow {
  /** The window's top-left corner, in master pixels. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** The master's size, which maps normalized points to master pixels. */
  masterWidth: number;
  masterHeight: number;
  /** RGBA bytes, `width` × `height`. */
  data: ArrayBuffer;
}

/** The master pixel under a normalized point, clamped to the image. */
export function masterPixel(point: ImagePoint, width: number, height: number): ImagePoint {
  const clamp = (v: number, size: number) => Math.min(size - 1, Math.max(0, Math.floor(v * size)));
  return { x: clamp(point.x, width), y: clamp(point.y, height) };
}

/** Reads the master pixels within `half` px of a point, clamped at the edges. Canvas reads only. */
export function readWindow(master: AnyCanvas, point: ImagePoint, half: number): MasterWindow {
  const { width: masterWidth, height: masterHeight } = master;
  const center = masterPixel(point, masterWidth, masterHeight);
  const left = Math.max(0, center.x - half);
  const top = Math.max(0, center.y - half);
  const width = Math.min(masterWidth, center.x + half + 1) - left;
  const height = Math.min(masterHeight, center.y + half + 1) - top;
  const pixels = context2d(master, true).getImageData(left, top, width, height);
  return {
    left,
    top,
    width,
    height,
    masterWidth,
    masterHeight,
    data: pixels.data.buffer as ArrayBuffer,
  };
}
