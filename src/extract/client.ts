/**
 * The UI side of the image worker. Where OffscreenCanvas 2D isn't available in workers, the same
 * canvas resampling runs on the main thread instead (spec 7.4). Neither path loops over pixels in
 * JavaScript on the main thread.
 */
import { type AnyCanvas, displaySize, masterSize, resample } from "../image/tiers";
import type { FromWorker, ToWorker } from "./messages";

export interface PreparedImage {
  display: ImageBitmap;
  masterWidth: number;
  masterHeight: number;
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
    this.offscreen = new Promise<boolean>((resolve) => {
      if ((globalThis as FallbackFlag).__paletteStudioMainThread) {
        resolve(false);
        return;
      }
      try {
        const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
        this.worker = worker;
        worker.addEventListener("message", (event: MessageEvent<FromWorker>) => {
          const message = event.data;
          if (message.type === "hello") {
            resolve(message.offscreen);
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
    this.worker?.postMessage(message, transfer);
  }

  private request(message: ToWorker & { jobId: number }, transfer: Transferable[]) {
    return new Promise<FromWorker>((resolve) => {
      this.pending.set(message.jobId, resolve);
      this.post(message, transfer);
    });
  }

  /** True when the working master lives in the worker. */
  async usesWorker(): Promise<boolean> {
    return this.connect();
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
    return { display, masterWidth: master.width, masterHeight: master.height };
  }
}

let client: ImageClient | null = null;

export function imageClient(): ImageClient {
  client ??= new ImageClient();
  return client;
}
