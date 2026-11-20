/**
 * Messages between the UI thread and the image worker (spec 7.1 "Workers", 7.4). M3-T2 reserves
 * `sample`, `place` and `view` and the `extracted` reply's `points`, so M3-T10 and M3-T11 build
 * them without changing this file.
 */
import type { Oklab } from "../color/convert";
import type { MasterWindow } from "../image/tiers";
import type {
  ExtractionSettings,
  ImagePoint,
  ImageViewMode,
  SampleRadius,
  SampleStat,
  ViewSettings,
} from "../types";
import type { ClusterMap } from "./cluster-map";
import type { BackgroundStatus } from "./pipeline";
import type { ExtractedColor } from "./postprocess";

/** RGBA pixels of an analysis copy, sent when the main-thread fallback made it. */
export interface PixelBuffer {
  width: number;
  height: number;
  data: ArrayBuffer;
}

/** The image views the worker draws (spec 3.8); the Image view is the image itself. */
export type DrawnViewMode = Exclude<ImageViewMode, "image">;

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
    }
  /**
   * Build the overlay pixels of one swatch's cluster map (spec 2.6, decision 13b) from a copy of
   * the map's labels, so the UI thread never loops over them (spec 7.4).
   */
  | {
      type: "overlay";
      jobId: number;
      width: number;
      height: number;
      labels: ArrayBuffer;
      index: number;
    }
  /**
   * Sample the patch under a marker (spec 3.7, M3-T10): the color within `radius` of `point`
   * (normalized) on the working master, and the loupe's crop. `window` is null when the worker
   * holds the master; the main-thread fallback sends the master pixels around the point.
   */
  | {
      type: "sample";
      jobId: number;
      point: ImagePoint;
      radius: SampleRadius;
      stat: SampleStat;
      window: MasterWindow | null;
    }
  /**
   * Place markers (spec 3.7, M3-T10) for the swatches at `indexes` of the palette `colors` (OKLab,
   * in palette order). The settings give the analysis copy, the filters and the working space,
   * as for `assign`; `pixels` is the fallback's analysis copy.
   */
  | {
      type: "place";
      jobId: number;
      colors: Oklab[];
      indexes: number[];
      settings: ExtractionSettings;
      pixels: PixelBuffer | null;
    }
  /**
   * Draw an image view (spec 3.8, M3-T11) of the working master at display size, for the palette
   * `colors` (OKLab, in palette order). `version` names the image, for the worker's cache. The
   * fallback sends the display-size pixels once per version and null after that.
   */
  | {
      type: "view";
      jobId: number;
      version: number;
      mode: DrawnViewMode;
      colors: Oklab[];
      bands: ViewSettings["bands"];
      dither: boolean;
      /** The user's alpha cutoff, 0 to 255 (spec 2.4). */
      alphaCutoff: number;
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
      /** One marker point per color, normalized (spec 3.7). M3-T10 fills it in. */
      points?: ImagePoint[];
      ms: number;
    }
  | { type: "assigned"; jobId: number; map: ClusterMap }
  /** RGBA overlay pixels, `width` × `height`; the buffer is transferred. */
  | { type: "overlaid"; jobId: number; width: number; height: number; data: ArrayBuffer }
  /** The patch color in OKLab, and the loupe's crop (15 × 15 RGBA; the buffer is transferred). */
  | { type: "sampled"; jobId: number; color: Oklab; crop: PixelBuffer }
  /** One normalized point per requested index, in the request's order. */
  | { type: "placed"; jobId: number; points: ImagePoint[] }
  /** The view's RGBA pixels, `width` × `height` (the buffer is transferred), and its shares. */
  | {
      type: "viewed";
      jobId: number;
      width: number;
      height: number;
      data: ArrayBuffer;
      shares: number[];
      bandShares: number[];
    }
  | { type: "error"; jobId: number; message: string };
