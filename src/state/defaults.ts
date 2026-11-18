import type { ExtractionSettings } from "../types";

export const SCHEMA_VERSION = 1;

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
 * The defaults the app starts with in M1. k-means++ stands in for Balanced until M2 builds it,
 * and the sample size is 256 on phones too (M1 decision 5, departing from spec 6.1's 128 px).
 */
export const DEFAULT_SETTINGS: Readonly<ExtractionSettings> = Object.freeze({
  ...SPEC_DEFAULT_SETTINGS,
  algorithm: "kmeans",
});

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
