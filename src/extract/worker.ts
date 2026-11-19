/**
 * The image worker (spec 7.4): makes the working master on an OffscreenCanvas and keeps it, sends
 * back a display copy, and runs extraction on the analysis copy (histogram, quantizer,
 * post-processing) and the cluster map (spec 2.6). Bitmaps and buffers are transferred, not copied.
 *
 * M3-T2 reserves three requests whose handlers call modules later tasks build: `sample` and
 * `place` (spec 3.7; `src/image/sample.ts` and `src/extract/markers.ts`, M3-T10) and `view` (spec
 * 3.8; `src/image/views.ts`, M3-T11). Keep handler bodies thin, so T10 and T11 touch little here.
 */

import type { Oklab } from "../color/convert";
import { autoRadius, CROP_SIZE, samplePatch } from "../image/sample";
import {
  type AnyCanvas,
  analysisSize,
  displaySize,
  type MasterWindow,
  masterSize,
  readPixels,
  readWindow,
  resample,
  SAMPLE_WINDOW_HALF,
} from "../image/tiers";
import { paletteView, valuesView } from "../image/views";
import type {
  ExtractionSettings,
  ImagePoint,
  SampleRadius,
  SampleStat,
  ViewSettings,
} from "../types";
import { assignPixels, overlayPixels } from "./cluster-map";
import { placeMarkers } from "./markers";
import type { DrawnViewMode, FromWorker, PixelBuffer, ToWorker } from "./messages";
import { type AnalysisImage, keepPixels, runExtraction } from "./pipeline";

interface WorkerScope {
  postMessage(message: FromWorker, transfer?: Transferable[]): void;
  addEventListener(type: "message", listener: (event: MessageEvent<ToWorker>) => void): void;
}

const scope = self as unknown as WorkerScope;
const create = (width: number, height: number): AnyCanvas => new OffscreenCanvas(width, height);

let master: AnyCanvas | null = null;
let analysis: { key: string; image: AnalysisImage } | null = null;
/** The master at display size, for the image views (spec 3.8), by image version. */
let viewSource: { version: number; image: AnalysisImage } | null = null;

function canDraw(): boolean {
  try {
    return (
      typeof OffscreenCanvas !== "undefined" && new OffscreenCanvas(1, 1).getContext("2d") !== null
    );
  } catch {
    return false;
  }
}

async function prepare(jobId: number, bitmap: ImageBitmap): Promise<void> {
  const next = resample(bitmap, masterSize(bitmap.width, bitmap.height), "smooth", create);
  bitmap.close();
  if (master) {
    master.width = 0;
    master.height = 0;
  }
  master = next;
  analysis = null;
  viewSource = null;
  const display = resample(master, displaySize(master.width, master.height), "smooth", create);
  const bitmapOut = await createImageBitmap(display);
  display.width = 0;
  display.height = 0;
  scope.postMessage(
    {
      type: "prepared",
      jobId,
      display: bitmapOut,
      masterWidth: master.width,
      masterHeight: master.height,
    },
    [bitmapOut],
  );
}

/** The analysis copy at the sample size (spec 2.4), cached until the size or resampling changes. */
function analysisImage(settings: ExtractionSettings): AnalysisImage {
  if (!master) throw new Error("No image");
  const key = `${master.width}x${master.height}|${settings.sampleSize}|${settings.resampling}`;
  if (analysis?.key !== key) {
    const size = analysisSize(master.width, master.height, settings.sampleSize);
    const canvas = resample(master, size, settings.resampling, create);
    const read = readPixels(canvas);
    analysis = { key, image: { width: read.width, height: read.height, data: read.data } };
    canvas.width = 0;
    canvas.height = 0;
  }
  return analysis.image;
}

/** The pixels the main thread sent (fallback), or the master's analysis copy. */
function pixelsOrAnalysis(settings: ExtractionSettings, pixels: PixelBuffer | null): AnalysisImage {
  return pixels
    ? { width: pixels.width, height: pixels.height, data: new Uint8ClampedArray(pixels.data) }
    : analysisImage(settings);
}

function extract(jobId: number, settings: ExtractionSettings, pixels: PixelBuffer | null): void {
  const start = performance.now();
  const image = pixelsOrAnalysis(settings, pixels);
  const keep = keepPixels(image, settings);
  const result = runExtraction(image, settings, keep);
  const { colors } = result;
  const map = assignPixels(
    image,
    keep.mask,
    colors.map((c) => c.lab),
    settings.workingSpace,
  );
  scope.postMessage({ type: "extracted", jobId, ...result, map, ms: performance.now() - start }, [
    map.labels.buffer,
  ]);
}

/** Rebuilds the cluster map for a palette, without extracting (spec 2.6). */
function assign(
  jobId: number,
  colors: Oklab[],
  settings: ExtractionSettings,
  pixels: PixelBuffer | null,
): void {
  const image = pixelsOrAnalysis(settings, pixels);
  const map = assignPixels(image, keepPixels(image, settings).mask, colors, settings.workingSpace);
  scope.postMessage({ type: "assigned", jobId, map }, [map.labels.buffer]);
}

/** The overlay pixels of one swatch's cluster map (spec 2.6, decision 13b). */
function overlay(
  jobId: number,
  width: number,
  height: number,
  labels: ArrayBuffer,
  index: number,
): void {
  const data = overlayPixels(new Uint8Array(labels), index).buffer as ArrayBuffer;
  scope.postMessage({ type: "overlaid", jobId, width, height, data }, [data]);
}

/** Samples the patch under a marker (spec 3.7). The fallback sends the window it read. */
function sample(
  jobId: number,
  point: ImagePoint,
  radius: SampleRadius,
  stat: SampleStat,
  window: MasterWindow | null,
): void {
  if (!window && !master) throw new Error("No image");
  const patch = window ?? readWindow(master as AnyCanvas, point, SAMPLE_WINDOW_HALF);
  const px = radius === "auto" ? autoRadius(patch.masterWidth, patch.masterHeight) : radius;
  const { color, crop } = samplePatch(patch, point, px, stat);
  const data = crop.buffer;
  scope.postMessage(
    { type: "sampled", jobId, color, crop: { width: CROP_SIZE, height: CROP_SIZE, data } },
    [data],
  );
}

/** Places markers for the swatches at `indexes` (spec 3.7), from the palette's cluster map. */
function place(
  jobId: number,
  colors: Oklab[],
  indexes: number[],
  settings: ExtractionSettings,
  pixels: PixelBuffer | null,
): void {
  const image = pixelsOrAnalysis(settings, pixels);
  const map = assignPixels(image, keepPixels(image, settings).mask, colors, settings.workingSpace);
  const all = placeMarkers(map.labels, image.width, image.height, colors, image);
  const points = indexes.map((i) => {
    const point = all[i];
    if (!point) throw new Error(`No point for swatch ${i + 1}`);
    return point;
  });
  scope.postMessage({ type: "placed", jobId, points });
}

/** The master at display size: sent by the fallback, or made here once per image version. */
function viewImage(version: number, pixels: PixelBuffer | null): AnalysisImage {
  if (pixels) {
    const { width, height } = pixels;
    viewSource = { version, image: { width, height, data: new Uint8ClampedArray(pixels.data) } };
  }
  if (viewSource?.version !== version) {
    if (!master) throw new Error("No image");
    const canvas = resample(master, displaySize(master.width, master.height), "smooth", create);
    const read = readPixels(canvas);
    canvas.width = 0;
    canvas.height = 0;
    viewSource = { version, image: { width: read.width, height: read.height, data: read.data } };
  }
  return viewSource.image;
}

/** Draws the Palette or Values view (spec 3.8). M3-T11 adds its cache around this. */
function view(
  jobId: number,
  version: number,
  mode: DrawnViewMode,
  colors: Oklab[],
  bands: ViewSettings["bands"],
  dither: boolean,
  pixels: PixelBuffer | null,
): void {
  const image = viewImage(version, pixels);
  const drawn = mode === "palette" ? paletteView(image, colors, dither) : valuesView(image, bands);
  const { width, height, shares, bandShares } = drawn;
  const data = drawn.data.buffer;
  scope.postMessage({ type: "viewed", jobId, width, height, data, shares, bandShares }, [data]);
}

scope.addEventListener("message", (event) => {
  const message = event.data;
  try {
    switch (message.type) {
      case "hello":
        scope.postMessage({ type: "hello", offscreen: canDraw() });
        return;
      case "prepare":
        prepare(message.jobId, message.bitmap).catch((error: unknown) => {
          scope.postMessage({ type: "error", jobId: message.jobId, message: String(error) });
        });
        return;
      case "extract":
        extract(message.jobId, message.settings, message.pixels);
        return;
      case "assign":
        assign(message.jobId, message.colors, message.settings, message.pixels);
        return;
      case "overlay":
        overlay(message.jobId, message.width, message.height, message.labels, message.index);
        return;
      case "sample":
        sample(message.jobId, message.point, message.radius, message.stat, message.window);
        return;
      case "place":
        place(message.jobId, message.colors, message.indexes, message.settings, message.pixels);
        return;
      case "view": {
        const m = message;
        view(m.jobId, m.version, m.mode, m.colors, m.bands, m.dither, m.pixels);
        return;
      }
    }
  } catch (error) {
    if ("jobId" in message) {
      scope.postMessage({ type: "error", jobId: message.jobId, message: String(error) });
    }
  }
});
