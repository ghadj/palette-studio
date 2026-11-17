import { describe, expect, it } from "vitest";
import { oklabToHex } from "../../src/color/convert";
import { extractPalette } from "../../src/extract/pipeline";
import { DEFAULT_SETTINGS } from "../../src/state/defaults";
import type { Algorithm, ExtractionSettings, WorkingSpace } from "../../src/types";
import { pixels } from "./helpers";

const ALGORITHMS: Algorithm[] = ["kmeans", "median-cut"];
const SPACES: WorkingSpace[] = ["oklab", "cielab", "linear-srgb", "srgb"];
const settings = (patch: Partial<ExtractionSettings>): ExtractionSettings => ({
  ...DEFAULT_SETTINGS,
  ...patch,
});

describe("extraction pipeline (spec 2.1, 8)", () => {
  it("both algorithms × 4 working spaces are stable on single-color, two-color and transparent inputs", () => {
    const single = pixels([["#14386B", 100]]);
    const two = pixels([
      ["#1DB07A", 75],
      ["#5039B0", 25],
    ]);
    const clear = pixels([["#FFFFFF", 50, 0]]);
    for (const algorithm of ALGORITHMS) {
      for (const workingSpace of SPACES) {
        const s = settings({ algorithm, workingSpace });
        const label = `${algorithm} ${workingSpace}`;
        const one = extractPalette(single, s);
        expect(
          one.map((c) => oklabToHex(c.lab)),
          label,
        ).toEqual(["#14386B"]);
        expect(one[0]?.population, label).toBe(1);
        const both = extractPalette(two, s);
        expect(
          both.map((c) => oklabToHex(c.lab)),
          label,
        ).toEqual(["#1DB07A", "#5039B0"]);
        expect(
          both.map((c) => c.population),
          label,
        ).toEqual([0.75, 0.25]);
        expect(extractPalette(clear, s), label).toEqual([]);
      }
    }
  });

  it("same settings and seed give identical palettes", () => {
    const runs: Array<[string, number]> = [];
    for (let i = 0; i < 400; i += 1) {
      const n = (i * 2654435761) >>> 0;
      runs.push([`#${(n >>> 8).toString(16).padStart(6, "0").slice(-6)}`, 1 + (n % 5)]);
    }
    const image = pixels(runs);
    for (const algorithm of ALGORITHMS) {
      const s = settings({ algorithm, colors: 8, seed: 5 });
      const a = extractPalette(image, s);
      expect(a.length).toBeGreaterThan(1);
      expect(extractPalette(image, s)).toEqual(a);
    }
    // k-means depends on the seed; with these inputs a different seed gives a different palette.
    const k1 = extractPalette(image, settings({ colors: 8, seed: 1 }));
    const k2 = extractPalette(image, settings({ colors: 8, seed: 2 }));
    expect(k1).not.toEqual(k2);
  });

  it("asks for no more colors than set and merges near-duplicates", () => {
    const image = pixels([
      ["#808080", 10],
      ["#888888", 10],
      ["#FF0000", 10],
    ]);
    const out = extractPalette(image, settings({ colors: 3, algorithm: "median-cut" }));
    expect(out).toHaveLength(2);
  });

  it("refuses algorithms that M1 doesn't build", () => {
    expect(() => extractPalette(pixels([["#000000", 1]]), settings({ algorithm: "wu" }))).toThrow(
      /not available/,
    );
  });
});
