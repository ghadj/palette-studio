import { describe, expect, it } from "vitest";
import { oklabToHex } from "../../src/color/convert";
import { extractPalette } from "../../src/extract/pipeline";
import {
  CENTER_SIGMA,
  CONTRAST_FLOOR,
  centerWeight,
  spatialWeights,
} from "../../src/extract/weighting";
import { DEFAULT_SETTINGS } from "../../src/state/defaults";
import type { ExtractionSettings } from "../../src/types";
import { image } from "./helpers";

const settings = (patch: Partial<ExtractionSettings>): ExtractionSettings => ({
  ...DEFAULT_SETTINGS,
  ...patch,
});

/** A centered #E8693A disk covering 30% of a 100 × 100 image, on #14386B. */
const disk = () => {
  const radius = Math.sqrt(3000 / Math.PI);
  return image(100, 100, (x, y) =>
    Math.hypot(x + 0.5 - 50, y + 0.5 - 50) < radius ? "#E8693A" : "#14386B",
  );
};

describe("spatial weighting (spec 2.4; M2 decision 9)", () => {
  it("uniform gives no weights", () => {
    expect(spatialWeights(disk(), "uniform")).toBeNull();
  });

  it("center weight is 1 at the center and falls monotonically to the corners", () => {
    expect(CENTER_SIGMA).toBe(0.35);
    expect(centerWeight(0, 0)).toBe(1);
    // Along the diagonal from the center to a corner, and along each axis to an edge.
    for (const [du, dv] of [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
      [1, 0],
      [0, 1],
    ] as const) {
      let previous = 1;
      for (let t = 0.05; t <= 0.5 + 1e-9; t += 0.05) {
        const w = centerWeight(du * t, dv * t);
        expect(w).toBeLessThan(previous);
        expect(w).toBeGreaterThan(0);
        previous = w;
      }
    }
    // The distance is normalized so the corner is at 1: exp(−1 / (2 × 0.35²)).
    expect(centerWeight(0.5, 0.5)).toBeCloseTo(Math.exp(-1 / (2 * 0.35 ** 2)), 12);
    // Per pixel: 1 at the center pixel of a 21 × 21 image, smallest at the corners.
    const w = spatialWeights(
      image(21, 21, () => "#808080"),
      "center",
    );
    expect(w).not.toBeNull();
    const at = (x: number, y: number) => w?.[y * 21 + x] ?? Number.NaN;
    expect(at(10, 10)).toBe(1);
    for (let k = 10; k > 0; k -= 1) expect(at(k - 1, k - 1)).toBeLessThan(at(k, k));
    const min = Math.min(...(w ?? []));
    expect(at(0, 0)).toBe(min);
    expect(at(20, 20)).toBeCloseTo(min, 12);
  });

  it("contrast weighting on a flat image equals uniform", () => {
    const flat = image(16, 12, () => "#5039B0");
    const w = spatialWeights(flat, "contrast");
    expect(w).not.toBeNull();
    expect([...(w ?? [])].every((v) => v === CONTRAST_FLOOR)).toBe(true);
    for (const algorithm of ["median-cut", "balanced", "exact"] as const) {
      expect(extractPalette(flat, settings({ algorithm, spatialWeighting: "contrast" }))).toEqual(
        extractPalette(flat, settings({ algorithm, spatialWeighting: "uniform" })),
      );
    }
  });

  it("contrast weighting is 0.25 plus the normalized Sobel magnitude of OKLab L", () => {
    expect(CONTRAST_FLOOR).toBe(0.25);
    // Left half black, right half white: the two columns at the edge get the largest magnitude.
    const edge = image(10, 6, (x) => (x < 5 ? "#000000" : "#FFFFFF"));
    const w = spatialWeights(edge, "contrast");
    const at = (x: number, y: number) => w?.[y * 10 + x] ?? Number.NaN;
    for (let y = 0; y < 6; y += 1) {
      expect(at(4, y)).toBeCloseTo(1.25, 12);
      expect(at(5, y)).toBeCloseTo(1.25, 12);
      expect(at(0, y)).toBe(0.25);
      expect(at(9, y)).toBe(0.25);
    }
    expect(Math.max(...(w ?? []))).toBeCloseTo(1.25, 12);
  });

  it("center-weighted: a centered 30% #E8693A disk on 70% #14386B ranks #E8693A first by population", () => {
    const img = disk();
    const uniform = extractPalette(img, settings({ algorithm: "exact", colors: 2 }));
    expect(uniform.map((c) => oklabToHex(c.lab))).toEqual(["#14386B", "#E8693A"]);
    expect(uniform[0]?.population).toBeCloseTo(0.7, 2);
    for (const algorithm of ["exact", "balanced", "median-cut", "kmeans", "wu"] as const) {
      const center = extractPalette(
        img,
        settings({ algorithm, colors: 2, spatialWeighting: "center" }),
      );
      expect(oklabToHex(center[0]?.lab ?? { l: 0, a: 0, b: 0 }), algorithm).toBe("#E8693A");
      // Populations are weighted shares (decision 9b): they still sum to 1.
      expect(center.reduce((n, c) => n + c.population, 0)).toBeCloseTo(1, 9);
      expect(center[0]?.population ?? 0).toBeGreaterThan(0.5);
    }
  });
});
