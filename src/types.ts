/**
 * Shared types (spec 7.5). M1 holds only the fields M1 uses; later milestones add adjustments,
 * gradients, export preferences and view settings.
 */
import type { Oklch } from "./color/convert";

export type { Oklab, Oklch } from "./color/convert";

/** Extraction algorithms (spec 2.2, 2.4). M1 implements median cut and k-means++. */
export type Algorithm =
  | "median-cut"
  | "wu"
  | "kmeans"
  | "balanced"
  | "exact"
  | "even-spread"
  | "swatch-roles";

export type WorkingSpace = "oklab" | "cielab" | "linear-srgb" | "srgb";
export type SampleSize = 64 | 128 | 256 | 512 | "full";
export type Resampling = "smooth" | "nearest";
export type SortOrder = "population" | "lightness" | "chroma" | "hue" | "extracted";
export type HistogramBits = 4 | 5 | 6;

/** Extraction settings used in M1 (spec 2.4). Filters, ROI and scoring settings arrive in M2. */
export interface ExtractionSettings {
  algorithm: Algorithm;
  /** Number of colors, 2 to 12 (decision 13; spec 2.4 says 32). */
  colors: number;
  workingSpace: WorkingSpace;
  /** Longest edge of the analysis copy. */
  sampleSize: SampleSize;
  resampling: Resampling;
  /** 0 to 255; pixels more transparent than this are ignored. */
  alphaCutoff: number;
  /** ΔE 0 to 0.15. */
  mergeThreshold: number;
  histogramBits: HistogramBits;
  /** K-means iterations, 5 to 100. */
  iterations: number;
  /** K-means restarts, 1 to 10. */
  restarts: number;
  seed: number;
  sort: SortOrder;
}

export type SwatchOrigin = "extracted" | "picked" | "manual";

/** Sample radius in px, or Auto (0.5% of the shorter side, minimum 2 px), spec 3.7. */
export type SampleRadius = "auto" | 1 | 3 | 5 | 11;

/** Normalized image coordinates, 0 to 1 (spec 3.7). */
export interface ImagePoint {
  x: number;
  y: number;
}

/** Spec 3.1 and 7.5. */
export interface Swatch {
  id: string;
  color: Oklch;
  /** 0 to 1. */
  alpha: number;
  /** Empty when unnamed; the UI then shows "Swatch N". */
  name: string;
  locked: boolean;
  origin: SwatchOrigin;
  /** Share of the image, 0 to 1. */
  population: number;
  /** Where the color lives on the image; null for manual swatches. */
  point: ImagePoint | null;
  sampleRadius: SampleRadius;
}

/** Spec 7.5: name and pixel size. The pixels themselves are never saved. */
export interface ImageMeta {
  name: string;
  width: number;
  height: number;
}

/** Spec 7.5, M1 fields. The project's name belongs to its library entry (7.5, 5.5). */
export interface Project {
  schemaVersion: number;
  settings: ExtractionSettings;
  palette: Swatch[];
  image: ImageMeta | null;
}

/** Phone tabs (spec 6.1) and, on tablets, the panel beside the Source column. */
export type Tab = "source" | "palette" | "gradient" | "materials";

/** Desktop views in the header (ui-contract Header item 3). */
export type View = "studio" | "materials";
