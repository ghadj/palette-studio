import { describe, expect, it } from "vitest";
import {
  clampColors,
  DEFAULT_SETTINGS,
  MAX_COLORS,
  MIN_COLORS,
  SCHEMA_VERSION,
  SPEC_DEFAULT_SETTINGS,
} from "../../src/state/defaults";

describe("palette size (decision 13: 2 to 12, departing from spec 2.4's 32)", () => {
  it("runs from 2 to 12", () => {
    expect([MIN_COLORS, MAX_COLORS]).toEqual([2, 12]);
    expect(DEFAULT_SETTINGS.colors).toBe(6);
  });

  it("clamps and rounds any value into range", () => {
    expect(clampColors(32)).toBe(12);
    expect(clampColors(13)).toBe(12);
    expect(clampColors(12)).toBe(12);
    expect(clampColors(1)).toBe(2);
    expect(clampColors(-5)).toBe(2);
    expect(clampColors(6.4)).toBe(6);
    expect(clampColors(Number.NaN)).toBe(6);
    expect(clampColors(Number.POSITIVE_INFINITY)).toBe(6);
  });
});

describe("extraction defaults (spec 2.4; M2 decision 3)", () => {
  it("SPEC_DEFAULT_SETTINGS holds every 2.4 default", () => {
    expect(SPEC_DEFAULT_SETTINGS).toEqual({
      algorithm: "balanced",
      colors: 6,
      workingSpace: "oklab",
      sampleSize: 256,
      resampling: "smooth",
      alphaCutoff: 128,
      ignoreDark: { on: false, threshold: 0.2 },
      ignoreLight: { on: false, threshold: 0.95 },
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
    // There is no region of interest (M2 decision 15).
    expect(Object.keys(SPEC_DEFAULT_SETTINGS).some((k) => /region|roi/i.test(k))).toBe(false);
  });

  it("DEFAULT_SETTINGS.algorithm is 'balanced'", () => {
    expect(DEFAULT_SETTINGS.algorithm).toBe("balanced");
    expect(DEFAULT_SETTINGS).toEqual(SPEC_DEFAULT_SETTINGS);
  });

  it("the schema version stays 1, because no project file exists before M5", () => {
    expect(SCHEMA_VERSION).toBe(1);
  });
});
