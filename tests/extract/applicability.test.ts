import { describe, expect, it } from "vitest";
import { settingApplies, settingNote } from "../../src/extract/applicability";
import { AVAILABLE_ALGORITHMS } from "../../src/extract/pipeline";

describe("which settings apply to which algorithm (decision 14)", () => {
  it("Seed, iterations and restarts are used by k-means++, and not by median cut or Wu", () => {
    for (const setting of ["seed", "iterations", "restarts"] as const) {
      expect(settingApplies(setting, "kmeans"), setting).toBe(true);
      expect(settingApplies(setting, "median-cut"), setting).toBe(false);
      expect(settingApplies(setting, "wu"), setting).toBe(false);
    }
  });

  it("Colors, Working space, Sample size and Resampling apply to every available algorithm", () => {
    for (const setting of ["colors", "workingSpace", "sampleSize", "resampling"] as const) {
      for (const algorithm of AVAILABLE_ALGORITHMS)
        expect(settingApplies(setting, algorithm)).toBe(true);
    }
  });

  it("gives the note shown beside a setting that only some algorithms use", () => {
    expect(settingNote("seed")).toBe("Used by k-means++ only");
    expect(settingNote("workingSpace")).toBeNull();
  });

  it("a 'not used by' entry disables a setting for that algorithm and gives the note 'Not used by swatch roles'", () => {
    // M2 decision 10c: Colors, merge threshold and keep one outlier are not used by swatch roles.
    for (const setting of ["colors", "mergeThreshold", "keepOutlier"] as const) {
      expect(settingApplies(setting, "swatch-roles"), setting).toBe(false);
      for (const algorithm of AVAILABLE_ALGORITHMS)
        expect(settingApplies(setting, algorithm)).toBe(true);
      expect(settingNote(setting)).toBe("Not used by swatch roles");
    }
  });
});
