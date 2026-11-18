import { describe, expect, it } from "vitest";
import { settingApplies, settingNote } from "../../src/extract/applicability";
import { AVAILABLE_ALGORITHMS } from "../../src/extract/pipeline";

describe("which settings apply to which algorithm (decision 14)", () => {
  it("Iterations apply to Balanced; Seed and Restarts don't (M2 decision 5b)", () => {
    expect(settingApplies("iterations", "balanced")).toBe(true);
    expect(settingApplies("seed", "balanced")).toBe(false);
    expect(settingApplies("restarts", "balanced")).toBe(false);
    expect(settingNote("iterations")).toBe("Used by k-means++ and Balanced only");
    expect(settingNote("restarts")).toBe("Used by k-means++ only");
  });

  it("Seed, iterations and restarts are used by k-means++, and not by median cut or Wu", () => {
    for (const setting of ["seed", "iterations", "restarts"] as const) {
      expect(settingApplies(setting, "kmeans"), setting).toBe(true);
      expect(settingApplies(setting, "median-cut"), setting).toBe(false);
      expect(settingApplies(setting, "wu"), setting).toBe(false);
    }
  });

  it("Working space, Sample size and Resampling apply to every available algorithm; Colors to all but swatch roles", () => {
    for (const setting of ["workingSpace", "sampleSize", "resampling"] as const) {
      for (const algorithm of AVAILABLE_ALGORITHMS)
        expect(settingApplies(setting, algorithm)).toBe(true);
    }
    for (const algorithm of AVAILABLE_ALGORITHMS)
      expect(settingApplies("colors", algorithm)).toBe(algorithm !== "swatch-roles");
  });

  it("every spec 2.4 algorithm is available, swatch roles included (M2-T6)", () => {
    expect(AVAILABLE_ALGORITHMS).toContain("swatch-roles");
  });

  it("gives the note shown beside a setting that only some algorithms use", () => {
    expect(settingNote("seed")).toBe("Used by k-means++ only");
    expect(settingNote("workingSpace")).toBeNull();
  });

  it("a 'not used by' entry disables a setting for that algorithm and gives the note 'Not used by swatch roles'", () => {
    // M2 decision 10c: Colors, merge threshold, keep one outlier and vividness are not used by
    // swatch roles.
    for (const setting of ["colors", "mergeThreshold", "keepOutlier", "vividness"] as const) {
      expect(settingApplies(setting, "swatch-roles"), setting).toBe(false);
      for (const algorithm of AVAILABLE_ALGORITHMS) {
        if (algorithm === "swatch-roles") continue;
        if (setting === "vividness" && algorithm === "exact") continue;
        expect(settingApplies(setting, algorithm), `${setting} ${algorithm}`).toBe(true);
      }
    }
    for (const setting of ["colors", "mergeThreshold", "keepOutlier"] as const)
      expect(settingNote(setting)).toBe("Not used by swatch roles");
  });

  it("vividness is not used by exact colors or swatch roles (M2 decision 6)", () => {
    expect(settingApplies("vividness", "exact")).toBe(false);
    expect(settingApplies("vividness", "swatch-roles")).toBe(false);
    expect(settingNote("vividness")).toBe("Not used by exact colors and swatch roles");
  });
});
