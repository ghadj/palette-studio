/** Messages between the UI thread and the image worker (spec 7.1 "Workers", 7.4). */

export type ToWorker =
  | { type: "hello" }
  /** Make the working master from a decoded image and send back a display copy. */
  | { type: "prepare"; jobId: number; bitmap: ImageBitmap };

export type FromWorker =
  /** `offscreen` is false when the worker can't draw (no OffscreenCanvas 2D): use the fallback. */
  | { type: "hello"; offscreen: boolean }
  | {
      type: "prepared";
      jobId: number;
      display: ImageBitmap;
      masterWidth: number;
      masterHeight: number;
    }
  | { type: "error"; jobId: number; message: string };
