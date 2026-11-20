/**
 * Shared types (spec 7.5). Export preferences arrive in later milestones.
 */
import type { Oklch } from "./color/convert";
import type { CvdType } from "./color/cvd";
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

/** How a sample patch is reduced to one color: the mean in OKLab, or the median (plan D8). */
export type SampleStat = "mean" | "median";

/** What extraction gave a swatch, kept so "Reset to extracted" can restore it (spec 3.7). */
export interface ExtractedOrigin {
  color: Oklch;
  point: ImagePoint | null;
}

/** Spec 3.1 and 7.5. */
export interface Swatch {
  id: string;
  color: Oklch;
  /** 0 to 1. */
  alpha: number;
  /** Empty when unnamed; the UI then shows "Swatch N". */
  name: string;
  /** Kept on re-extraction and not adjusted (spec 3.3; the Lock button). */
  locked: boolean;
  /** Kept on re-extraction but still adjusted: set by edits, drags and picks (spec 3.7; decision 24). */
  pinned: boolean;
  origin: SwatchOrigin;
  /** Share of the image, 0 to 1. */
  population: number;
  /** Where the color lives on the image; null for manual swatches. */
  point: ImagePoint | null;
  sampleRadius: SampleRadius;
  /** Mean by default; median for noisy images (spec 3.7, plan D8). */
  sampleStat: SampleStat;
  /** The extracted color and point; null for swatches extraction didn't make (spec 3.7). */
  extracted: ExtractedOrigin | null;
}

/** Gamut mode (spec 3.3 "Gamut", 7.9): "off" shows the indicator only; "srgb" clamps chroma. */
export type GamutMode = "off" | "srgb";

/**
 * Global adjustments (spec 3.3, 7.5), stored as parameters over the base swatches. Ranges and
 * identity values follow plan D1; `evenOut` and `harmonize` are the 3.3 rows that 7.5 doesn't list.
 */
export interface Adjustments {
  /** OKLab L shift, −0.5 to 0.5 (0). */
  lightness: number;
  /** OKLCH C scale, 0 to 2 (1, shown as 100%). */
  chroma: number;
  /** OKLCH hue rotation in degrees, −180 to 180 (0). */
  hue: number;
  /** Lightness expansion about 0.5, 0.5 to 2 (1). */
  contrast: number;
  /** Added to OKLab b, −0.1 to 0.1 (0). */
  temperature: number;
  /** Added to OKLab a, −0.1 to 0.1 (0). */
  tint: number;
  /** L' = L^gamma, 0.5 to 2 (1). */
  gamma: number;
  /** Lightness clamp, 0 to 1. */
  lightnessRange: { min: number; max: number };
  /** Space swatch lightness in equal steps. */
  evenOut: boolean;
  /** Pull hues toward `anchor` (degrees) by `amount` (0 to 1), along the shorter arc. */
  harmonize: { anchor: number; amount: number };
  gamut: GamutMode;
}

/** The image views (spec 3.8). */
export type ImageViewMode = "image" | "palette" | "values";

/** The eyedropper (spec 3.2): off, adding a swatch, or retargeting the selected one (plan 5c). */
export type EyedropperMode = "off" | "add";

/** View settings (spec 3.8, 7.5). The transfer grid joins them in M5. */
export interface ViewSettings {
  mode: ImageViewMode;
  /** Values view bands (plan D19). */
  bands: "continuous" | 3 | 5;
  /** Close-in-value threshold in OKLab L, 0.01 to 0.10 (plan D19). */
  closeInValue: number;
  /** Where the Palette view takes its colors; "paints" needs Part 2 (plan D18). */
  colorsFrom: "palette" | "paints";
  dither: boolean;
}

/** Spec 7.5: name and pixel size. The pixels themselves are never saved. */
export interface ImageMeta {
  name: string;
  width: number;
  height: number;
}

/** Gradient types built in M4 (spec 4.1); mesh, stepped and repeating arrive in M6. */
export type GradientType = "linear" | "radial" | "conic";

/** The interpolation spaces of spec 4.3, by their CSS names. */
export type InterpolationSpace =
  | "srgb"
  | "srgb-linear"
  | "display-p3"
  | "lab"
  | "oklab"
  | "lch"
  | "oklch"
  | "hsl"
  | "hwb"
  | "xyz";

/** How the hue travels between two stops in a polar space (spec 4.3; CSS hue-interpolation-method). */
export type HueMethod = "shorter" | "longer" | "increasing" | "decreasing";

export type EasingKind =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "smoothstep"
  | "cubic-bezier";

/** One easing for the whole gradient (plan D7). Bezier x1 and x2 lie within 0 to 1. */
export interface Easing {
  kind: EasingKind;
  /** The control points x1, y1, x2, y2, used by "cubic-bezier". */
  bezier: [number, number, number, number];
}

/** What to do with interpolated colors outside sRGB (plan D12). */
export type GamutHandling = "chroma" | "clamp";

/**
 * A stop's color (spec 4.3): linked to a swatch by id, so palette edits and adjustments flow in
 * (`derive` offsets it, plan D17), or a fixed value. `from` is the swatch a value stop was
 * detached from, which Relink goes back to (plan D30).
 */
export type StopColor =
  | { kind: "swatch"; id: string; derive?: { hueShift: number; lightness?: number } }
  | { kind: "value"; color: Oklch; from: string | null };

/** A gradient stop (spec 4.3, 7.5). */
export interface GradientStop {
  id: string;
  /** 0 to 1 along the stop axis. */
  position: number;
  color: StopColor;
  /** 0 to 1. */
  alpha: number;
  /** Midpoint within the segment to the next stop, 0 to 1; 0.5 is none (plan D5). */
  hint: number;
  /** A locked stop can't be moved or removed and survives a rebuild (plan D6). */
  locked: boolean;
}

/** Geometry for every type (spec 4.3); each type reads the fields it needs (plan D21). */
export interface Geometry {
  /** Linear angle in degrees, 0 at the top and clockwise, as in CSS. */
  angle: number;
  shape: "circle" | "ellipse";
  size: "closest-side" | "closest-corner" | "farthest-side" | "farthest-corner";
  /** Radial and conic center, 0 to 1. */
  center: ImagePoint;
  /** Conic start angle in degrees. */
  from: number;
  reverse: boolean;
  mirror: boolean;
}

export type TechniqueKind =
  | "palette-order"
  | "sorted"
  | "smooth-path"
  | "image-sample"
  | "derived"
  | "random"
  | "population";

export type SortBy = "lightness" | "hue" | "chroma";

/**
 * How stops are made from the palette (spec 4.2): one flat record, so switching techniques keeps
 * each one's parameters (plan T1).
 */
export interface Technique {
  kind: TechniqueKind;
  /** Which swatches the palette-based techniques use (plan Q1b). */
  colors: { mode: "all" | "distinct" | "picked"; count: number; ids: string[] };
  sortBy: SortBy;
  seed: number;
  /** Constrained random: minimum neighbor ΔE OK (plan D15). */
  minDeltaE: number;
  /** Constrained random: minimum neighbor WCAG contrast; 1 is off. */
  minContrast: number;
  derive: {
    from: string | null;
    kind: "analogous" | "complementary" | "monochrome" | "warm-cool";
  };
  sample: {
    mode: "line" | "horizontal" | "vertical" | "radial" | "markers-x" | "markers-y";
    count: number;
    line: { a: ImagePoint; b: ImagePoint };
    /** The sampled colors, kept so the stops don't depend on the image being re-read. */
    colors: Oklch[];
  };
}

/** Spec 7.5 "Gradient". One per project (plan D1). */
export interface Gradient {
  type: GradientType;
  geometry: Geometry;
  space: InterpolationSpace;
  hue: HueMethod;
  premultiplied: boolean;
  easing: Easing;
  gamut: GamutHandling;
  technique: Technique;
  /**
   * False while the stops follow the technique (plan Q1a); true once a stop was edited by hand,
   * when `stops` is the list. While false, `stops` holds only the locked stops a rebuild keeps.
   */
  custom: boolean;
  stops: GradientStop[];
}

export type PreviewAspect = "free" | "1:1" | "16:9" | "9:16" | "4:3" | "banner" | "custom";

/** Gradient preview options (spec 4.4): view state, not saved and not in undo (plan D22). */
export interface GradientPreviewSettings {
  aspect: PreviewAspect;
  /** Pixels, 16 to 8192 per side, for the Custom aspect. */
  customSize: { w: number; h: number };
  /** A second space to show beside the main one, or null. */
  compare: InterpolationSpace | null;
  overlay: { on: boolean; color: "white" | "black" | string };
  cvd: "normal" | CvdType;
}

/** The preview's surround (spec 6.2, plan D23): an app setting, not part of the project. */
export type Surround = "theme" | "mid-gray" | "white" | "black";

/**
 * Spec 7.5. `palette` holds the base swatches; the adjusted palette is computed from them and
 * `adjustments`. The project's name belongs to its library entry (7.5, 5.5).
 */
export interface Project {
  schemaVersion: number;
  settings: ExtractionSettings;
  palette: Swatch[];
  adjustments: Adjustments;
  image: ImageMeta | null;
  view: ViewSettings;
  gradient: Gradient;
}

/** Phone tabs (spec 6.1) and, on tablets, the panel beside the Source column. */
export type Tab = "source" | "palette" | "gradient" | "materials";

/** Desktop views in the header (ui-contract Header item 3). */
export type View = "studio" | "materials";
