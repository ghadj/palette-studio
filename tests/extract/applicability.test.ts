import { describe, expect, it } from "vitest";
import { onlyForNote, settingApplies } from "../../src/extract/applicability";
import { M1_ALGORITHMS } from "../../src/extract/pipeline";

describe("which settings apply to which algorithm (decision 14)", () => {
  it("Seed, iterations and restarts are used by k-means++ only", () => {
    for (const setting of ["seed", "iterations", "restarts"] as const) {
      expect(settingApplies(setting, "kmeans"), setting).toBe(true);
      expect(settingApplies(setting, "median-cut"), setting).toBe(false);
    }
  });

  it("Colors, Working space, Sample size and Resampling apply to both M1 algorithms", () => {
    for (const setting of ["colors", "workingSpace", "sampleSize", "resampling"] as const) {
      for (const algorithm of M1_ALGORITHMS) expect(settingApplies(setting, algorithm)).toBe(true);
    }
  });

  it("gives the note shown beside a setting that only some algorithms use", () => {
    expect(onlyForNote("seed")).toBe("Used by k-means++ only");
    expect(onlyForNote("colors")).toBeNull();
  });
});
