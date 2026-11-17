/**
 * The UI side of the image worker. Where OffscreenCanvas 2D isn't available in workers, the master
 * and the analysis copy are made with canvas drawing on the main thread instead, and only the
 * analysis pixels go to the worker for extraction (spec 7.4). Neither path loops over pixels in
 * JavaScript on the main thread.
 */
import {
  type AnyCanvas,
  analysisSize,
  displaySize,
  masterSize,
  readPixels,
  resample,
} from "../image/tiers";
import type { ExtractionSettings } from "../types";
import type { FromWorker, PixelBuffer, ToWorker } from "./messages";
import type { ExtractedColor } from "./postprocess";

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

class ImageClient {
  private worker: Worker | null = null;
  private offscreen: Promise<boolean> | null = null;
  private nextJob = 1;
  private pending = new Map<number, (message: FromWorker) => void>();
  /** The working master when the main-thread fallback is in use. */
  private mainMaster: AnyCanvas | null = null;

  private connect(): Promise<boolean> {
    if (this.offscreen) return this.offscreen;
    const forced = (globalThis as FallbackFlag).__paletteStudioMainThread === true;
    this.offscreen = new Promise<boolean>((resolve) => {
      try {
        const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
        this.worker = worker;
        worker.addEventListener("message", (event: MessageEvent<FromWorker>) => {
          const message = event.data;
          if (message.type === "hello") {
            resolve(message.offscreen && !forced);
            return;
          }
          const handler = this.pending.get(message.jobId);
          if (handler) {
            this.pending.delete(message.jobId);
            handler(message);
          }
        });
        worker.addEventListener("error", () => resolve(false));
        this.post({ type: "hello" });
      } catch {
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
    return new Promise<FromWorker>((resolve) => {
      this.pending.set(message.jobId, resolve);
      this.post(message, transfer);
    });
  }

  /** Makes the working master from a decoded image (which is consumed) and returns a display copy. */
  async prepare(bitmap: ImageBitmap): Promise<PreparedImage> {
    if (await this.connect()) {
      const jobId = this.nextJob++;
      const reply = await this.request({ type: "prepare", jobId, bitmap }, [bitmap]);
      if (reply.type === "prepared") {
        return {
          display: reply.display,
          masterWidth: reply.masterWidth,
          masterHeight: reply.masterHeight,
          thread: "worker",
        };
      }
      throw new Error(reply.type === "error" ? reply.message : "Unexpected reply");
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

  /** Runs extraction on the current image's analysis copy (spec 2.1, 2.4). */
  async extract(settings: ExtractionSettings): Promise<ExtractedColor[]> {
    const inWorker = await this.connect();
    let pixels: PixelBuffer | null = null;
    const transfer: Transferable[] = [];
    if (!inWorker) {
      if (!this.mainMaster) throw new Error("No image");
      const size = analysisSize(this.mainMaster.width, this.mainMaster.height, settings.sampleSize);
      const canvas = resample(this.mainMaster, size, settings.resampling, createMainCanvas);
      const data = readPixels(canvas).data;
      canvas.width = 0;
      canvas.height = 0;
      pixels = { width: size.width, height: size.height, data: data.buffer as ArrayBuffer };
      transfer.push(pixels.data);
    }
    const jobId = this.nextJob++;
    const reply = await this.request({ type: "extract", jobId, settings, pixels }, transfer);
    if (reply.type === "extracted") return reply.colors;
    throw new Error(reply.type === "error" ? reply.message : "Unexpected reply");
  }
}

let client: ImageClient | null = null;

export function imageClient(): ImageClient {
  client ??= new ImageClient();
  return client;
}
