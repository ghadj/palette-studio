import { describe, expect, it } from "vitest";
import { applyPreset, matchPreset, PRESET_IDS, type PresetId } from "../../src/extract/presets";
import { SPEC_DEFAULT_SETTINGS } from "../../src/state/defaults";
import { buildMockupState } from "../../src/state/mockup";
import type { ExtractionSettings } from "../../src/types";

// Presets (spec 2.5; M2 decision 11).

const base = (): ExtractionSettings => ({
  ...SPEC_DEFAULT_SETTINGS,
  ignoreDark: { ...SPEC_DEFAULT_SETTINGS.ignoreDark },
  ignoreLight: { ...SPEC_DEFAULT_SETTINGS.ignoreLight },
});

/** Settings far from every preset, so each test shows what a preset sets and what it keeps. */
const custom = (): ExtractionSettings => ({
  ...base(),
  algorithm: "wu",
  colors: 9,
  workingSpace: "cielab",
  sampleSize: 128,
  resampling: "nearest",
  alphaCutoff: 40,
  ignoreDark: { on: true, threshold: 0.3 },
  ignoreLight: { on: true, threshold: 0.9 },
  ignoreBackground: "auto",
  minChroma: 0.04,
  vividness: 0.35,
  mergeThreshold: 0.1,
  distanceMetric: "ciede2000",
  spatialWeighting: "center",
  keepOutlier: true,
  histogramBits: 6,
  iterations: 40,
  restarts: 5,
  seed: 77,
  sort: "hue",
});

/** The preset fields every preset sets or resets (decision 11). */
const presetFields = (s: ExtractionSettings) => ({
  algorithm: s.algorithm,
  vividness: s.vividness,
  ignoreDark: s.ignoreDark.on,
  ignoreLight: s.ignoreLight.on,
  mergeThreshold: s.mergeThreshold,
  resampling: s.resampling,
  keepOutlier: s.keepOutlier,
});

const RESET = {
  vividness: 0,
  ignoreDark: false,
  ignoreLight: false,
  mergeThreshold: 0.03,
  resampling: "smooth",
  keepOutlier: false,
};

describe("the six presets of spec 2.5", () => {
  it("Dominant: median-cut, 6 colors, merge 0.03", () => {
    const s = applyPreset(custom(), "dominant");
    expect(s.colors).toBe(6);
    expect(presetFields(s)).toEqual({ ...RESET, algorithm: "median-cut", mergeThreshold: 0.03 });
  });

  it("Balanced: balanced, 6 colors", () => {
    const s = applyPreset(custom(), "balanced");
    expect(s.colors).toBe(6);
    expect(presetFields(s)).toEqual({ ...RESET, algorithm: "balanced" });
  });

  it("Vibrant: k-means, vividness 0.6, ignore dark and light on", () => {
    const s = applyPreset(base(), "vibrant");
    expect(presetFields(s)).toEqual({
      ...RESET,
      algorithm: "kmeans",
      vividness: 0.6,
      ignoreDark: true,
      ignoreLight: true,
    });
  });

  it("Flat art: exact, nearest, merge 0", () => {
    const s = applyPreset(custom(), "flat-art");
    expect(presetFields(s)).toEqual({
      ...RESET,
      algorithm: "exact",
      resampling: "nearest",
      mergeThreshold: 0,
    });
  });

  it("Accents: even spread, keep outlier on", () => {
    const s = applyPreset(custom(), "accents");
    expect(presetFields(s)).toEqual({ ...RESET, algorithm: "even-spread", keepOutlier: true });
  });

  it("Swatch roles: swatch-roles", () => {
    const s = applyPreset(custom(), "swatch-roles");
    expect(presetFields(s)).toEqual({ ...RESET, algorithm: "swatch-roles" });
  });

  it("lists the six presets in spec 2.5 order", () => {
    expect(PRESET_IDS).toEqual([
      "dominant",
      "balanced",
      "vibrant",
      "flat-art",
      "accents",
      "swatch-roles",
    ]);
  });
});

describe("applying and matching presets (decision 11)", () => {
  it("apply then match returns the same preset, for all six", () => {
    for (const id of PRESET_IDS) {
      expect(matchPreset(applyPreset(base(), id)), id).toBe(id);
      expect(matchPreset(applyPreset(custom(), id)), id).toBe(id);
    }
  });

  it("Vibrant keeps a Colors value of 8 and a Working space of CIELAB", () => {
    const s = applyPreset({ ...base(), colors: 8, workingSpace: "cielab" }, "vibrant");
    expect(s.colors).toBe(8);
    expect(s.workingSpace).toBe("cielab");
    expect(matchPreset(s)).toBe("vibrant");
  });

  it("keeps Working space, Sample size, Seed and every setting that isn't a preset field", () => {
    const before = custom();
    for (const id of PRESET_IDS) {
      const s = applyPreset(before, id);
      expect(s.workingSpace, id).toBe("cielab");
      expect(s.sampleSize, id).toBe(128);
      expect(s.seed, id).toBe(77);
      expect(s.alphaCutoff, id).toBe(40);
      expect(s.minChroma, id).toBe(0.04);
      expect(s.ignoreBackground, id).toBe("auto");
      expect(s.spatialWeighting, id).toBe("center");
      expect(s.distanceMetric, id).toBe("ciede2000");
      expect(s.histogramBits, id).toBe(6);
      expect(s.iterations, id).toBe(40);
      expect(s.restarts, id).toBe(5);
      expect(s.sort, id).toBe("hue");
      // The toggles are preset fields; their thresholds aren't.
      expect(s.ignoreDark.threshold, id).toBe(0.3);
      expect(s.ignoreLight.threshold, id).toBe(0.9);
      // Colors stays, except for Dominant and Balanced.
      expect(s.colors, id).toBe(id === "dominant" || id === "balanced" ? 6 : 9);
    }
  });

  it("doesn't change the settings it is given", () => {
    const before = custom();
    const copy = structuredClone(before);
    for (const id of PRESET_IDS) applyPreset(before, id);
    expect(before).toEqual(copy);
  });

  it("after Vibrant, Accents turns ignore dark and light off again", () => {
    const vibrant = applyPreset(base(), "vibrant");
    expect(vibrant.ignoreDark.on).toBe(true);
    expect(vibrant.ignoreLight.on).toBe(true);
    const accents = applyPreset(vibrant, "accents");
    expect(accents.ignoreDark.on).toBe(false);
    expect(accents.ignoreLight.on).toBe(false);
    expect(accents.vividness).toBe(0);
    expect(matchPreset(accents)).toBe("accents");
  });

  it("changing any field a preset sets afterwards matches 'custom'", () => {
    const changes: Array<[string, (s: ExtractionSettings) => ExtractionSettings]> = [
      ["algorithm", (s) => ({ ...s, algorithm: "wu" })],
      ["vividness", (s) => ({ ...s, vividness: s.vividness === 0 ? 0.25 : 0 })],
      ["ignore dark", (s) => ({ ...s, ignoreDark: { ...s.ignoreDark, on: !s.ignoreDark.on } })],
      ["ignore light", (s) => ({ ...s, ignoreLight: { ...s.ignoreLight, on: !s.ignoreLight.on } })],
      ["merge", (s) => ({ ...s, mergeThreshold: s.mergeThreshold === 0 ? 0.05 : 0 })],
      [
        "resampling",
        (s) => ({ ...s, resampling: s.resampling === "smooth" ? "nearest" : "smooth" }),
      ],
      ["outlier", (s) => ({ ...s, keepOutlier: !s.keepOutlier })],
    ];
    for (const id of PRESET_IDS) {
      const applied = applyPreset(base(), id);
      for (const [name, change] of changes) {
        expect(matchPreset(change(applied)), `${id}, ${name}`).toBe("custom");
      }
    }
    // Dominant and Balanced set Colors too.
    for (const id of ["dominant", "balanced"] as PresetId[]) {
      expect(matchPreset({ ...applyPreset(base(), id), colors: 7 }), id).toBe("custom");
    }
  });

  it("changing a field no preset sets keeps the match, including the ignore background and spatial weighting fields", () => {
    for (const id of PRESET_IDS) {
      const applied = applyPreset(base(), id);
      const changed: ExtractionSettings = {
        ...applied,
        workingSpace: "srgb",
        sampleSize: "full",
        seed: 5,
        alphaCutoff: 10,
        minChroma: 0.1,
        ignoreBackground: "auto",
        spatialWeighting: "contrast",
        distanceMetric: "ciede2000",
        sort: "lightness",
        ignoreDark: { ...applied.ignoreDark, threshold: 0.4 },
        ignoreLight: { ...applied.ignoreLight, threshold: 0.8 },
      };
      expect(matchPreset(changed), id).toBe(id);
    }
  });

  it("matches values the decimal fields commit, such as 0.6 from the vividness slider", () => {
    const s = applyPreset(base(), "vibrant");
    expect(matchPreset({ ...s, vividness: 0.1 + 0.5 })).toBe("vibrant");
  });

  it("the spec defaults match Balanced", () => {
    expect(matchPreset(base())).toBe("balanced");
  });

  it("the mockup fixture's settings match Balanced", () => {
    expect(matchPreset(buildMockupState().project.settings)).toBe("balanced");
  });
});
