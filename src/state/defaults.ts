import type { ExtractionSettings } from "../types";

export const SCHEMA_VERSION = 1;

/** The defaults in the spec 2.4 table. */
export const SPEC_DEFAULT_SETTINGS: Readonly<ExtractionSettings> = Object.freeze({
  algorithm: "balanced",
  colors: 6,
  workingSpace: "oklab",
  sampleSize: 256,
  resampling: "smooth",
  alphaCutoff: 128,
  mergeThreshold: 0.03,
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
export const MAX_COLORS = 32;
