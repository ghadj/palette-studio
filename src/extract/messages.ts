/** Messages between the UI thread and the image worker (spec 7.1 "Workers", 7.4). */
import type { Oklab } from "../color/convert";
import type { ExtractionSettings } from "../types";
import type { ClusterMap } from "./cluster-map";
import type { BackgroundStatus } from "./pipeline";
import type { ExtractedColor } from "./postprocess";

/** RGBA pixels of an analysis copy, sent when the main-thread fallback made it. */
export interface PixelBuffer {
  width: number;
  height: number;
  data: ArrayBuffer;
}

export type ToWorker =
  | { type: "hello" }
  /** Make the working master from a decoded image and send back a display copy. */
  | { type: "prepare"; jobId: number; bitmap: ImageBitmap }
  /** Extract a palette from the master's analysis copy, or from the pixels given (fallback). */
  | { type: "extract"; jobId: number; settings: ExtractionSettings; pixels: PixelBuffer | null }
  /**
   * Rebuild the cluster map for the given palette (OKLab, in palette order) without extracting:
   * the settings give the filters and the working space (spec 2.6).
   */
  | {
      type: "assign";
      jobId: number;
      colors: Oklab[];
      settings: ExtractionSettings;
      pixels: PixelBuffer | null;
    };

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
  | {
      type: "extracted";
      jobId: number;
      colors: ExtractedColor[];
      /** "all-filtered" when the filters dropped every pixel (M2 decision 18). */
      reason: "all-filtered" | null;
      /** Ignore background's outcome (M2 decision 4); absent while it is off. */
      background?: BackgroundStatus;
      /** The cluster map for these colors; its labels' buffer is transferred (spec 2.6). */
      map: ClusterMap;
      ms: number;
    }
  | { type: "assigned"; jobId: number; map: ClusterMap }
  | { type: "error"; jobId: number; message: string };
