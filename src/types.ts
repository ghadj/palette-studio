/**
 * Shared types (spec 7.5). M1 holds only the fields M1 uses; later milestones add adjustments,
 * gradients, export preferences and view settings.
 */
import type { Oklch } from "./color/convert";
import type { DistanceMetric } from "./color/delta-e";

export type { Oklab, Oklch } from "./color/convert";
export type { DistanceMetric } from "./color/delta-e";

/** Extraction algorithms (spec 2.2, 2.4). Octree comes later. */
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
export type SpatialWeighting = "uniform" | "center" | "contrast";
export type IgnoreBackground = "off" | "auto";

/** Ignore dark or light pixels: a toggle and an OKLab L threshold (spec 2.4; M2 decision 3). */
export interface LightnessFilter {
  on: boolean;
  /** OKLab L, 0 to 1. Dark: below this is ignored. Light: above this is ignored. */
  threshold: number;
}

/**
 * Extraction settings (spec 2.4). There is no region of interest: extraction always uses the
 * whole image (M2 decision 15a).
 */
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
  /** Off by default, threshold L 0.2. */
  ignoreDark: LightnessFilter;
  /** Off by default, threshold L 0.95. */
  ignoreLight: LightnessFilter;
  /** Off, or auto-detect from border pixels (M2 decision 4). */
  ignoreBackground: IgnoreBackground;
  /** OKLab C, 0 to 0.2; pixels below it are dropped. */
  minChroma: number;
  /** Population vs. vividness, 0 to 1 (M2 decisions 5c and 6). */
  vividness: number;
  /**
   * Stored in ΔE OK units, 0 to 0.15. Under CIEDE2000 the same value reads ×100, in ΔE00 units
   * (M2 decision 7).
   */
  mergeThreshold: number;
  /** Governs merging and the outlier distance; clustering stays Euclidean (M2 decision 7). */
  distanceMetric: DistanceMetric;
  spatialWeighting: SpatialWeighting;
  /** Reserve a slot for the most distinct small cluster (M2 decision 8). */
  keepOutlier: boolean;
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
