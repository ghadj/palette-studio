/**
 * The image worker (spec 7.4): makes the working master on an OffscreenCanvas and keeps it, sends
 * back a display copy, and runs extraction on the analysis copy (histogram, quantizer,
 * post-processing) and the cluster map (spec 2.6). Bitmaps and buffers are transferred, not copied.
 */

import type { Oklab } from "../color/convert";
import {
  type AnyCanvas,
  analysisSize,
  displaySize,
  masterSize,
  readPixels,
  resample,
} from "../image/tiers";
import type { ExtractionSettings } from "../types";
import { assignPixels } from "./cluster-map";
import type { FromWorker, PixelBuffer, ToWorker } from "./messages";
import { type AnalysisImage, keepPixels, runExtraction } from "./pipeline";

interface WorkerScope {
  postMessage(message: FromWorker, transfer?: Transferable[]): void;
  addEventListener(type: "message", listener: (event: MessageEvent<ToWorker>) => void): void;
}

const scope = self as unknown as WorkerScope;
const create = (width: number, height: number): AnyCanvas => new OffscreenCanvas(width, height);

let master: AnyCanvas | null = null;
let analysis: { key: string; image: AnalysisImage } | null = null;

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
    }
  } catch (error) {
    if ("jobId" in message) {
      scope.postMessage({ type: "error", jobId: message.jobId, message: String(error) });
    }
  }
});
