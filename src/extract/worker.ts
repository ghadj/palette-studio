/**
 * The image worker (spec 7.4): downscales the decoded image into the working master on an
 * OffscreenCanvas, keeps the master, and sends back a display copy. Buffers and bitmaps are
 * transferred, not copied.
 */
import { type AnyCanvas, displaySize, masterSize, resample } from "../image/tiers";
import type { FromWorker, ToWorker } from "./messages";

interface WorkerScope {
  postMessage(message: FromWorker, transfer?: Transferable[]): void;
  addEventListener(type: "message", listener: (event: MessageEvent<ToWorker>) => void): void;
}

const scope = self as unknown as WorkerScope;
const create = (width: number, height: number): AnyCanvas => new OffscreenCanvas(width, height);

let master: AnyCanvas | null = null;

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

scope.addEventListener("message", (event) => {
  const message = event.data;
  if (message.type === "hello") {
    scope.postMessage({ type: "hello", offscreen: canDraw() });
    return;
  }
  if (message.type === "prepare") {
    prepare(message.jobId, message.bitmap).catch((error: unknown) => {
      scope.postMessage({ type: "error", jobId: message.jobId, message: String(error) });
    });
  }
});
