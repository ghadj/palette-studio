/**
 * The UI side of the image worker. Where OffscreenCanvas 2D isn't available in workers, the master
 * and the analysis copy are made with canvas drawing on the main thread instead, and only the
 * analysis pixels go to the worker for extraction (spec 7.4). Neither path loops over pixels in
 * JavaScript on the main thread.
 */

import type { Oklab } from "../color/convert";
import {
  type AnyCanvas,
  analysisSize,
  displaySize,
  masterSize,
  readPixels,
  readWindow,
  resample,
  SAMPLE_WINDOW_HALF,
} from "../image/tiers";
import type {
  ExtractionSettings,
  ImagePoint,
  SampleRadius,
  SampleStat,
  ViewSettings,
} from "../types";
import type { ClusterMap } from "./cluster-map";
import type { DrawnViewMode, FromWorker, PixelBuffer, ToWorker } from "./messages";
import type { ExtractionResult } from "./pipeline";

/** An extraction's result with the cluster map for its colors (spec 2.6). */
export interface Extraction extends ExtractionResult {
  map: ClusterMap;
  /** One marker point per color (spec 3.7), once M3-T10 sends them. */
  points?: ImagePoint[];
}

/** RGBA pixels with their size, as the page draws them with putImageData. */
export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
}

/** A sampled patch (spec 3.7): its color, and the loupe's crop. */
export interface SampleResult {
  color: Oklab;
  crop: Pixels;
}

/** What an image view request names (spec 3.8). */
export interface ViewRequest {
  mode: DrawnViewMode;
  /** The palette the view uses, in OKLab and palette order (plan D18). */
  colors: readonly Oklab[];
  bands: ViewSettings["bands"];
  dither: boolean;
}

/** A drawn image view (spec 3.8). */
export interface ViewResult extends Pixels {
  /** Palette view: each color's share, in palette order; else empty. */
  shares: number[];
  /** Values view: each band's share, dark to light; else empty. */
  bandShares: number[];
}

export interface PreparedImage {
  display: ImageBitmap;
  masterWidth: number;
  masterHeight: number;
  /** Where the working master lives. */
  thread: "worker" | "main";
}

/** Test hook: set on window before load to force the main-thread fallback. */
interface FallbackFlag {
  __paletteStudioMainThread?: boolean;
}

const createMainCanvas = (width: number, height: number): AnyCanvas => {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

export interface ImageClientOptions {
  createWorker?: () => Worker;
  /** Forces the main-thread fallback (test hook). */
  forceMainThread?: () => boolean;
}

const defaultWorker = (): Worker =>
  new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });

interface Pending {
  resolve: (message: FromWorker) => void;
  reject: (error: Error) => void;
}

export class WorkerStoppedError extends Error {
  constructor() {
    super("The image worker stopped");
    this.name = "WorkerStoppedError";
  }
}

export class ImageClient {
  private worker: Worker | null = null;
  private offscreen: Promise<boolean> | null = null;
  private nextJob = 1;
  private pending = new Map<number, Pending>();
  /** The working master when the main-thread fallback is in use. */
  private mainMaster: AnyCanvas | null = null;
  /** Re-decodes the current image, so a recreated worker can rebuild its master. */
  private restore: (() => Promise<ImageBitmap>) | null = null;
  /** True when the worker that held the master has stopped. */
  private masterLost = false;
  /** Counts prepared images; the worker caches image views by it (M3-T11). */
  private version = 0;
  /** The image version whose display pixels the fallback has sent to the worker, or 0. */
  private displaySent = 0;
  private readonly createWorker: () => Worker;
  private readonly forceMainThread: () => boolean;

  constructor(options: ImageClientOptions = {}) {
    this.createWorker = options.createWorker ?? defaultWorker;
    this.forceMainThread =
      options.forceMainThread ??
      (() => (globalThis as FallbackFlag).__paletteStudioMainThread === true);
  }

  /** Set after each load: how to decode the current image again. */
  setRestore(restore: (() => Promise<ImageBitmap>) | null): void {
    this.restore = restore;
  }

  /**
   * An uncaught error or a message that can't be read: reject everything pending, drop the
   * worker, and create a new one on the next job (evaluator note 6).
   */
  private stop(worker: Worker): void {
    if (this.worker !== worker) return;
    worker.terminate();
    this.worker = null;
    this.offscreen = null;
    this.masterLost = this.mainMaster === null;
    this.displaySent = 0;
    const pending = [...this.pending.values()];
    this.pending.clear();
    for (const p of pending) p.reject(new WorkerStoppedError());
  }

  private connect(): Promise<boolean> {
    if (this.offscreen) return this.offscreen;
    const forced = this.forceMainThread();
    this.offscreen = new Promise<boolean>((resolve, reject) => {
      let greeted = false;
      try {
        const worker = this.createWorker();
        this.worker = worker;
        worker.addEventListener("message", (event: MessageEvent<FromWorker>) => {
          const message = event.data;
          if (message.type === "hello") {
            greeted = true;
            resolve(message.offscreen && !forced);
            return;
          }
          const handler = this.pending.get(message.jobId);
          if (handler) {
            this.pending.delete(message.jobId);
            handler.resolve(message);
          }
        });
        const onFailure = () => {
          this.stop(worker);
          if (!greeted) reject(new WorkerStoppedError());
        };
        worker.addEventListener("error", onFailure);
        worker.addEventListener("messageerror", onFailure);
        this.post({ type: "hello" });
      } catch {
        this.worker = null;
        resolve(false);
      }
    });
    return this.offscreen;
  }

  private post(message: ToWorker, transfer: Transferable[] = []): void {
    if (!this.worker) throw new Error("Workers are not available");
    this.worker.postMessage(message, transfer);
  }

  private request(message: ToWorker & { jobId: number }, transfer: Transferable[] = []) {
    return new Promise<FromWorker>((resolve, reject) => {
      this.pending.set(message.jobId, { resolve, reject });
      try {
        this.post(message, transfer);
      } catch (error) {
        this.pending.delete(message.jobId);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private async prepareInWorker(bitmap: ImageBitmap): Promise<PreparedImage> {
    const jobId = this.nextJob++;
    const reply = await this.request({ type: "prepare", jobId, bitmap }, [bitmap]);
    if (reply.type === "prepared") {
      this.masterLost = false;
      return {
        display: reply.display,
        masterWidth: reply.masterWidth,
        masterHeight: reply.masterHeight,
        thread: "worker",
      };
    }
    throw new Error(reply.type === "error" ? reply.message : "Unexpected reply");
  }

  /** Makes the working master from a decoded image (which is consumed) and returns a display copy. */
  async prepare(bitmap: ImageBitmap): Promise<PreparedImage> {
    this.version += 1;
    if (await this.connect()) {
      if (this.mainMaster) {
        this.mainMaster.width = 0;
        this.mainMaster.height = 0;
        this.mainMaster = null;
      }
      return this.prepareInWorker(bitmap);
    }
    const master = resample(
      bitmap,
      masterSize(bitmap.width, bitmap.height),
      "smooth",
      createMainCanvas,
    );
    bitmap.close();
    if (this.mainMaster) {
      this.mainMaster.width = 0;
      this.mainMaster.height = 0;
    }
    this.mainMaster = master;
    this.masterLost = false;
    const copy = resample(
      master,
      displaySize(master.width, master.height),
      "smooth",
      createMainCanvas,
    );
    const display = await createImageBitmap(copy);
    copy.width = 0;
    copy.height = 0;
    return { display, masterWidth: master.width, masterHeight: master.height, thread: "main" };
  }

  /**
   * The analysis pixels to send with a job: none when the worker holds the master (rebuilt first
   * if a new worker lost it), or the analysis copy made here in the main-thread fallback.
   */
  private async analysisPixels(settings: ExtractionSettings): Promise<PixelBuffer | null> {
    const master = await this.fallbackMaster();
    if (!master) return null;
    const size = analysisSize(master.width, master.height, settings.sampleSize);
    const canvas = resample(master, size, settings.resampling, createMainCanvas);
    const data = readPixels(canvas).data;
    canvas.width = 0;
    canvas.height = 0;
    return { width: size.width, height: size.height, data: data.buffer as ArrayBuffer };
  }

  /**
   * Null when the worker holds the master (rebuilt first if a new worker lost it), or the master
   * here in the main-thread fallback, whose pixels then travel with the job.
   */
  private async fallbackMaster(): Promise<AnyCanvas | null> {
    const inWorker = await this.connect();
    if (inWorker && this.masterLost) {
      // A new worker has no master yet: rebuild it from the original image.
      if (!this.restore) throw new Error("No image");
      const prepared = await this.prepareInWorker(await this.restore());
      prepared.display.close();
    }
    if (inWorker) return null;
    if (!this.mainMaster) throw new Error("No image");
    return this.mainMaster;
  }

  /**
   * Runs extraction on the current image's analysis copy (spec 2.1, 2.4), with the cluster map
   * for the colors it finds (spec 2.6).
   */
  async extract(settings: ExtractionSettings): Promise<Extraction> {
    const pixels = await this.analysisPixels(settings);
    const jobId = this.nextJob++;
    const reply = await this.request(
      { type: "extract", jobId, settings, pixels },
      pixels ? [pixels.data] : [],
    );
    if (reply.type === "extracted") {
      const { colors, reason, map, background, points } = reply;
      const extraction: Extraction = { colors, reason, map };
      if (background) extraction.background = background;
      if (points) extraction.points = points;
      return extraction;
    }
    throw new Error(reply.type === "error" ? reply.message : "Unexpected reply");
  }

  /**
   * Rebuilds the cluster map of the current image for a palette (OKLab, in palette order),
   * without extracting (spec 2.6). The settings give the filters and the working space.
   */
  async assign(colors: readonly Oklab[], settings: ExtractionSettings): Promise<ClusterMap> {
    const pixels = await this.analysisPixels(settings);
    const jobId = this.nextJob++;
    const reply = await this.request(
      { type: "assign", jobId, colors: [...colors], settings, pixels },
      pixels ? [pixels.data] : [],
    );
    if (reply.type === "assigned") return reply.map;
    throw new Error(reply.type === "error" ? reply.message : "Unexpected reply");
  }

  /**
   * The RGBA overlay pixels for one swatch of a cluster map (spec 2.6, decision 13b), built in the
   * worker from a copy of the labels, so the map itself stays usable here. No master is needed.
   */
  async overlay(map: ClusterMap, index: number): Promise<Uint8ClampedArray<ArrayBuffer>> {
    await this.connect();
    const labels = map.labels.slice().buffer as ArrayBuffer;
    const jobId = this.nextJob++;
    const reply = await this.request(
      { type: "overlay", jobId, width: map.width, height: map.height, labels, index },
      [labels],
    );
    if (reply.type === "overlaid") return new Uint8ClampedArray(reply.data);
    throw new Error(reply.type === "error" ? reply.message : "Unexpected reply");
  }

  /**
   * Samples the patch under a marker (spec 3.7, M3-T10): its color and the loupe's crop. The
   * fallback reads the master pixels around the point here and sends them (spec 7.4).
   */
  async sample(point: ImagePoint, radius: SampleRadius, stat: SampleStat): Promise<SampleResult> {
    const master = await this.fallbackMaster();
    const window = master ? readWindow(master, point, SAMPLE_WINDOW_HALF) : null;
    const jobId = this.nextJob++;
    const reply = await this.request(
      { type: "sample", jobId, point: { ...point }, radius, stat, window },
      window ? [window.data] : [],
    );
    if (reply.type === "sampled") {
      const { width, height, data } = reply.crop;
      return { color: reply.color, crop: { width, height, data: new Uint8ClampedArray(data) } };
    }
    throw new Error(reply.type === "error" ? reply.message : "Unexpected reply");
  }

  /**
   * Places markers (spec 3.7, M3-T10) for the swatches at `indexes` of a palette (OKLab, in
   * palette order). Returns one normalized point per index.
   */
  async place(
    colors: readonly Oklab[],
    indexes: readonly number[],
    settings: ExtractionSettings,
  ): Promise<ImagePoint[]> {
    const pixels = await this.analysisPixels(settings);
    const jobId = this.nextJob++;
    const reply = await this.request(
      { type: "place", jobId, colors: [...colors], indexes: [...indexes], settings, pixels },
      pixels ? [pixels.data] : [],
    );
    if (reply.type === "placed") return reply.points;
    throw new Error(reply.type === "error" ? reply.message : "Unexpected reply");
  }

  /**
   * Draws the Palette or Values view (spec 3.8, M3-T11) of the current image at display size.
   * The fallback sends the display-size pixels once per image; the worker keeps them.
   */
  async view(request: ViewRequest): Promise<ViewResult> {
    const master = await this.fallbackMaster();
    const version = this.version;
    let pixels: PixelBuffer | null = null;
    if (master && this.displaySent !== version) {
      const size = displaySize(master.width, master.height);
      const canvas = resample(master, size, "smooth", createMainCanvas);
      const data = readPixels(canvas).data;
      canvas.width = 0;
      canvas.height = 0;
      pixels = { width: size.width, height: size.height, data: data.buffer as ArrayBuffer };
      this.displaySent = version;
    }
    const jobId = this.nextJob++;
    const reply = await this.request(
      {
        type: "view",
        jobId,
        version,
        mode: request.mode,
        colors: [...request.colors],
        bands: request.bands,
        dither: request.dither,
        pixels,
      },
      pixels ? [pixels.data] : [],
    );
    if (reply.type === "viewed") {
      const { width, height, data, shares, bandShares } = reply;
      return { width, height, data: new Uint8ClampedArray(data), shares, bandShares };
    }
    throw new Error(reply.type === "error" ? reply.message : "Unexpected reply");
  }
}

let client: ImageClient | null = null;

export function imageClient(): ImageClient {
  client ??= new ImageClient();
  return client;
}
