import { describe, expect, it } from "vitest";
import { oklabToHex } from "../../src/color/convert";
import { balanced } from "../../src/extract/balanced";
import { buildHistogram, type Histogram } from "../../src/extract/histogram";
import { mulberry32 } from "../../src/extract/kmeans";
import type { Cluster } from "../../src/extract/median-cut";
import { extractPalette } from "../../src/extract/pipeline";
import { wu } from "../../src/extract/wu";
import { SPEC_DEFAULT_SETTINGS } from "../../src/state/defaults";
import type { ExtractionSettings } from "../../src/types";
import { image, pixels, row } from "./helpers";

const settings = (patch: Partial<ExtractionSettings>): ExtractionSettings => ({
  ...SPEC_DEFAULT_SETTINGS,
  algorithm: "balanced",
  ...patch,
});

/** Weighted sum of squared working-space distances from each bin to its nearest color. */
function sse(h: Histogram, clusters: readonly Cluster[]): number {
  let total = 0;
  for (let i = 0; i < h.size; i += 1) {
    let best = Number.POSITIVE_INFINITY;
    for (const c of clusters) {
      const d =
        ((h.means[i * 3] ?? 0) - c.color[0]) ** 2 +
        ((h.means[i * 3 + 1] ?? 0) - c.color[1]) ** 2 +
        ((h.means[i * 3 + 2] ?? 0) - c.color[2]) ** 2;
      if (d < best) best = d;
    }
    total += (h.counts[i] ?? 0) * best;
  }
  return total;
}

/** 2,000 pixels in 2,000 distinct 5-bit bins, with weights 1 to 10, from mulberry32(7). */
function randomBins(): Histogram {
  const rng = mulberry32(7);
  const used = new Set<number>();
  const data = new Uint8ClampedArray(2000 * 4);
  const weights = new Float64Array(2000);
  let n = 0;
  while (n < 2000) {
    const bin = Math.floor(rng() * 32768);
    if (used.has(bin)) continue;
    used.add(bin);
    const r = ((bin >> 10) << 3) + Math.floor(rng() * 8);
    const g = (((bin >> 5) & 31) << 3) + Math.floor(rng() * 8);
    const b = ((bin & 31) << 3) + Math.floor(rng() * 8);
    data.set([r, g, b, 255], n * 4);
    weights[n] = 1 + Math.floor(rng() * 10);
    n += 1;
  }
  return buildHistogram(data, { weights });
}

describe("Balanced: Wu seed, weighted k-means, scoring (spec 2.2; M2 decision 5)", () => {
  it("deterministic; changing the seed doesn't change the result", () => {
    const img = image(64, 48, (x, y) => {
      const r = (x * 4).toString(16).padStart(2, "0");
      const g = (y * 5).toString(16).padStart(2, "0");
      const b = ((x * y) % 256).toString(16).padStart(2, "0");
      return `#${r}${g}${b}`;
    });
    const a = extractPalette(img, settings({ seed: 1 }));
    expect(a).toHaveLength(6);
    expect(extractPalette(img, settings({ seed: 1 }))).toEqual(a);
    expect(extractPalette(img, settings({ seed: 2 }))).toEqual(a);
    expect(extractPalette(img, settings({ seed: 987654, restarts: 9 }))).toEqual(a);
  });

  it("two-color 75/25 gives both exact colors", () => {
    const out = extractPalette(
      image(40, 40, (x) => (x < 30 ? "#1DB07A" : "#5039B0")),
      settings({}),
    );
    expect(out.map((c) => oklabToHex(c.lab))).toEqual(["#1DB07A", "#5039B0"]);
    expect(out.map((c) => c.population)).toEqual([0.75, 0.25]);
  });

  it("weighted SSE after refinement is never above the Wu seed's SSE on the same histogram (fixed mulberry32 seed 7, 2,000 random bins, N = 2, 6, 12)", () => {
    const h = randomBins();
    expect(h.size).toBe(2000);
    for (const n of [2, 6, 12]) {
      const seed = wu(h, n);
      const refined = balanced(h, { k: n, iterations: 25 });
      expect(refined, `N=${n}`).toHaveLength(n);
      expect(sse(h, refined), `N=${n}`).toBeLessThanOrEqual(sse(h, seed) * (1 + 1e-12));
    }
  });

  it("stable on single-color, two-color and transparent inputs (spec 8)", () => {
    for (const workingSpace of ["oklab", "cielab", "linear-srgb", "srgb"] as const) {
      const s = settings({ workingSpace });
      const one = extractPalette(row(pixels([["#14386B", 100]])), s);
      expect(
        one.map((c) => oklabToHex(c.lab)),
        workingSpace,
      ).toEqual(["#14386B"]);
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
      expect(
        two.map((c) => oklabToHex(c.lab)),
        workingSpace,
      ).toEqual(["#1DB07A", "#5039B0"]);
      expect(extractPalette(row(pixels([["#FFFFFF", 50, 0]])), s)).toEqual([]);
    }
    expect(balanced(buildHistogram(pixels([["#000000", 4, 0]])), { k: 6 })).toEqual([]);
  });
});
