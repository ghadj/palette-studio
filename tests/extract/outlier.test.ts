import { describe, expect, it } from "vitest";
import { hexToOklab } from "../../src/color/convert";
import { deltaEOK } from "../../src/color/delta-e";
import { extractPalette } from "../../src/extract/pipeline";
import { SPEC_DEFAULT_SETTINGS } from "../../src/state/defaults";
import type { ExtractionSettings } from "../../src/types";
import { pixels, row } from "./helpers";

const settings = (patch: Partial<ExtractionSettings>): ExtractionSettings => ({
  ...SPEC_DEFAULT_SETTINGS,
  ...patch,
});
const near = (out: ReturnType<typeof extractPalette>, hex: string, within = 0.02) =>
  out.some((c) => deltaEOK(c.lab, hexToOklab(hex)) <= within);

describe("Keep one outlier (spec 2.4; M2 decision 8)", () => {
  const image = row(
    pixels([
      ["#14386B", 500],
      ["#5039B0", 480],
      ["#1DB07A", 20],
    ]),
  );

  it("50% #14386B, 48% #5039B0, 2% #1DB07A with k-means++ N=2: off gives no swatch within ΔE OK 0.02 of #1DB07A, on gives one", () => {
    const off = extractPalette(image, settings({ algorithm: "kmeans", colors: 2 }));
    expect(near(off, "#1DB07A")).toBe(false);
    const on = extractPalette(
      image,
      settings({ algorithm: "kmeans", colors: 2, keepOutlier: true }),
    );
    expect(near(on, "#1DB07A")).toBe(true);
    // The outlier keeps its own share; populations still sum to 1.
    const green = on.find((c) => deltaEOK(c.lab, hexToOklab("#1DB07A")) <= 0.02);
    expect(green?.population).toBeCloseTo(0.02, 9);
    expect(Math.abs(on.reduce((n, c) => n + c.population, 0) - 1)).toBeLessThan(1e-9);
  });

  it("on with N=2 still returns 2 swatches", () => {
    for (const algorithm of [
      "kmeans",
      "median-cut",
      "wu",
      "balanced",
      "exact",
      "even-spread",
    ] as const) {
      const out = extractPalette(image, settings({ algorithm, colors: 2, keepOutlier: true }));
      expect(out, algorithm).toHaveLength(2);
    }
  });

  it("a single-pixel outlier below 0.1% is not kept", () => {
    const img = row(
      pixels([
        ["#14386B", 1000],
        ["#5039B0", 1000],
        ["#1DB07A", 1],
      ]),
    );
    for (const algorithm of ["kmeans", "median-cut", "balanced"] as const) {
      const out = extractPalette(img, settings({ algorithm, colors: 2, keepOutlier: true }));
      expect(near(out, "#1DB07A"), algorithm).toBe(false);
    }
  });

  it("the outlier distance follows the distance metric", () => {
    const out = extractPalette(
      image,
      settings({ algorithm: "kmeans", colors: 2, keepOutlier: true, distanceMetric: "ciede2000" }),
    );
    expect(near(out, "#1DB07A")).toBe(true);
  });

  it("stable on single-color, two-color and transparent inputs (spec 8)", () => {
    const s = settings({ keepOutlier: true });
    const one = extractPalette(row(pixels([["#14386B", 100]])), s);
    expect(one).toHaveLength(1);
    expect(one[0]?.population).toBe(1);
    const two = extractPalette(
      row(
        pixels([
          ["#1DB07A", 75],
          ["#5039B0", 25],
        ]),
      ),
      s,
    );
    expect(two).toHaveLength(2);
    expect(extractPalette(row(pixels([["#FFFFFF", 50, 0]])), s)).toEqual([]);
  });
});
