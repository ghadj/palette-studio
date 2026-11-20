import type {
  Adjustments,
  ExtractionSettings,
  Gradient,
  GradientPreviewSettings,
  Technique,
  ViewSettings,
} from "../types";

/** Stays 1 until project files exist (M5). */
export const SCHEMA_VERSION = 1;

/** Adjustments that change nothing (spec 3.3; plan D1). */
export const DEFAULT_ADJUSTMENTS: Readonly<Adjustments> = Object.freeze({
  lightness: 0,
  chroma: 1,
  hue: 0,
  contrast: 1,
  temperature: 0,
  tint: 0,
  gamma: 1,
  lightnessRange: Object.freeze({ min: 0, max: 1 }),
  evenOut: false,
  harmonize: Object.freeze({ anchor: 0, amount: 0 }),
  gamut: "off",
});

/** The Image view, 5 bands, Close in value 0.03, colors from the palette, no dither (D18, D19). */
export const DEFAULT_VIEW_SETTINGS: Readonly<ViewSettings> = Object.freeze({
  mode: "image",
  bands: 5,
  closeInValue: 0.03,
  colorsFrom: "palette",
  dither: false,
});

/** The defaults in the spec 2.4 table, with the M2 decision 3 thresholds (L 0.2 and 0.95). */
export const SPEC_DEFAULT_SETTINGS: Readonly<ExtractionSettings> = Object.freeze({
  algorithm: "balanced",
  colors: 6,
  workingSpace: "oklab",
  sampleSize: 256,
  resampling: "smooth",
  alphaCutoff: 128,
  ignoreDark: Object.freeze({ on: false, threshold: 0.2 }),
  ignoreLight: Object.freeze({ on: false, threshold: 0.95 }),
  ignoreBackground: "off",
  minChroma: 0,
  vividness: 0,
  mergeThreshold: 0.03,
  distanceMetric: "ok",
  spatialWeighting: "uniform",
  keepOutlier: false,
  histogramBits: 5,
  iterations: 25,
  restarts: 3,
  seed: 1,
  sort: "population",
});

/**
 * The defaults the app starts with: the spec 2.4 defaults, so Balanced is the default algorithm
 * (M2-T4). The sample size is 256 on phones too (M1 decision 5, departing from spec 6.1's 128 px).
 */
export const DEFAULT_SETTINGS: Readonly<ExtractionSettings> = SPEC_DEFAULT_SETTINGS;

export const MIN_COLORS = 2;
/**
 * Decision 13: palettes have at most 12 colors. This departs on purpose, by the user's choice, from
 * spec 2.4's "2 to 32".
 */
export const MAX_COLORS = 12;

/** Rounds and clamps a color count into 2 to 12; anything not finite becomes the default. */
export function clampColors(value: number): number {
  if (!Number.isFinite(value)) return SPEC_DEFAULT_SETTINGS.colors;
  return Math.min(MAX_COLORS, Math.max(MIN_COLORS, Math.round(value)));
}

/** Smooth path over all colors, with the parameters each technique starts with (plan D14 to D18). */
export const DEFAULT_TECHNIQUE: Readonly<Technique> = Object.freeze({
  kind: "smooth-path",
  colors: Object.freeze({ mode: "all", count: 4, ids: [] as string[] }),
  sortBy: "lightness",
  seed: 1,
  minDeltaE: 0.1,
  minContrast: 1,
  derive: Object.freeze({ from: null, kind: "analogous" }),
  sample: Object.freeze({
    mode: "line",
    count: 5,
    line: Object.freeze({ a: { x: 0.05, y: 0.05 }, b: { x: 0.95, y: 0.95 } }),
    colors: [],
  }),
} as Technique);

/** The gradient a new palette starts with (plan D2, D21): live, Smooth path over all colors. */
export const DEFAULT_GRADIENT: Readonly<Gradient> = Object.freeze({
  type: "linear",
  geometry: Object.freeze({
    angle: 90,
    shape: "ellipse",
    size: "farthest-corner",
    center: { x: 0.5, y: 0.5 },
    from: 0,
    reverse: false,
    mirror: false,
  }),
  space: "oklab",
  hue: "shorter",
  premultiplied: true,
  // The CSS "ease" curve, so Custom starts somewhere useful.
  easing: Object.freeze({ kind: "linear", bezier: [0.25, 0.1, 0.25, 1] }) as Gradient["easing"],
  gamut: "chroma",
  technique: DEFAULT_TECHNIQUE as Technique,
  custom: false,
  stops: [] as Gradient["stops"],
} as Gradient);

/** Free aspect, no compare, no text check, normal vision (plan D22). */
export const DEFAULT_GRADIENT_PREVIEW: Readonly<GradientPreviewSettings> = Object.freeze({
  aspect: "free",
  customSize: Object.freeze({ w: 1200, h: 600 }),
  compare: null,
  overlay: Object.freeze({ on: false, color: "white" }),
  cvd: "normal",
});
