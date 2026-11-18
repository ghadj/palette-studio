import { describe, expect, it } from "vitest";
import { oklabToHex } from "../../src/color/convert";
import { extractPalette } from "../../src/extract/pipeline";
import { DEFAULT_SETTINGS } from "../../src/state/defaults";
import type { Algorithm, ExtractionSettings, WorkingSpace } from "../../src/types";
import { TWELVE_COLORS } from "../../tools/fixture-colors";
import { image, pixels, row } from "./helpers";

const ALGORITHMS: Algorithm[] = ["kmeans", "median-cut", "wu", "balanced", "exact", "even-spread"];
const SPACES: WorkingSpace[] = ["oklab", "cielab", "linear-srgb", "srgb"];
const settings = (patch: Partial<ExtractionSettings>): ExtractionSettings => ({
  ...DEFAULT_SETTINGS,
  ...patch,
});

describe("extraction pipeline (spec 2.1, 8)", () => {
  it("every available algorithm × 4 working spaces are stable on single-color, two-color and transparent inputs", () => {
    const single = row(pixels([["#14386B", 100]]));
    const two = row(
      pixels([
        ["#1DB07A", 75],
        ["#5039B0", 25],
      ]),
    );
    const clear = row(pixels([["#FFFFFF", 50, 0]]));
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
    const image = row(pixels(runs));
    for (const algorithm of ALGORITHMS) {
      const s = settings({ algorithm, colors: 8, seed: 5 });
      const a = extractPalette(image, s);
      expect(a.length).toBeGreaterThan(1);
      expect(extractPalette(image, s)).toEqual(a);
    }
    // k-means depends on the seed; with these inputs a different seed gives a different palette.
    const k1 = extractPalette(image, settings({ algorithm: "kmeans", colors: 8, seed: 1 }));
    const k2 = extractPalette(image, settings({ algorithm: "kmeans", colors: 8, seed: 2 }));
    expect(k1).not.toEqual(k2);
  });

  it("asks for no more colors than set and merges near-duplicates", () => {
    const image = row(
      pixels([
        ["#808080", 10],
        ["#888888", 10],
        ["#FF0000", 10],
      ]),
    );
    const out = extractPalette(image, settings({ colors: 3, algorithm: "median-cut" }));
    expect(out).toHaveLength(2);
  });

  it("never returns more than 12 colors, whatever the settings say (decision 13)", () => {
    const runs: Array<[string, number]> = [];
    for (let i = 0; i < 24; i += 1) {
      const n = (i * 0x9e3779b1) >>> 0;
      runs.push([`#${(n >>> 8).toString(16).padStart(6, "0").slice(-6)}`, 5]);
    }
    for (const algorithm of ALGORITHMS) {
      const out = extractPalette(
        row(pixels(runs)),
        settings({ algorithm, colors: 32, mergeThreshold: 0 }),
      );
      expect(out.length, algorithm).toBe(12);
    }
  });

  it("refuses an unknown algorithm", () => {
    // Every spec 2.4 algorithm is built by M2-T6; octree comes later (spec 2.2).
    expect(() =>
      extractPalette(
        row(pixels([["#000000", 1]])),
        settings({ algorithm: "octree" as unknown as Algorithm }),
      ),
    ).toThrow(/not available/);
  });

  it("swatch roles carry their role names; other algorithms leave names unset", () => {
    const img = row(
      pixels([
        ["#FF0000", 15],
        ["#D1A9A9", 5],
      ]),
    );
    // Ranked like every other algorithm: by population while Sort is Population.
    const roles = extractPalette(img, settings({ algorithm: "swatch-roles" }));
    expect(roles.map((c) => [c.name, oklabToHex(c.lab)])).toEqual([
      ["Vibrant", "#FF0000"],
      ["Light muted", "#D1A9A9"],
    ]);
    for (const algorithm of ALGORITHMS) {
      for (const c of extractPalette(img, settings({ algorithm }))) expect(c.name).toBeUndefined();
    }
  });

  it("M1 settings give the same hexes as before for two-color, single-color and twelve-colors pixels", () => {
    // Pinned from the M1 pipeline (commit d98ec55) before M2 changed it. Same images as the
    // fixtures: two-color.png 40 × 40 (75/25), single-color.png 16 × 16, twelve-colors.png 120 × 20.
    const inputs = {
      two: image(40, 40, (x) => (x < 30 ? "#1DB07A" : "#5039B0")),
      single: image(16, 16, () => "#14386B"),
      twelve: image(120, 20, (x) => TWELVE_COLORS[Math.floor(x / 10)] ?? "#000000"),
    };
    const expected: Record<string, Record<keyof typeof inputs, Array<[string, number]>>> = {
      kmeans: {
        two: [
          ["#1DB07A", 0.75],
          ["#5039B0", 0.25],
        ],
        single: [["#14386B", 1]],
        twelve: [
          ["#B9F086", 0.25],
          ["#EE5582", 0.25],
          ["#6B7559", 0.166667],
          ["#7349C6", 0.166667],
          ["#3CB44B", 0.083333],
          ["#000075", 0.083333],
        ],
      },
      "median-cut": {
        two: [
          ["#1DB07A", 0.75],
          ["#5039B0", 0.25],
        ],
        single: [["#14386B", 1]],
        twelve: [
          ["#72DF87", 0.25],
          ["#4C36AA", 0.25],
          ["#F1699D", 0.166667],
          ["#6B7559", 0.166667],
          ["#FFE119", 0.083333],
          ["#E6194B", 0.083333],
        ],
      },
    };
    for (const algorithm of ["kmeans", "median-cut"] as const) {
      for (const name of ["two", "single", "twelve"] as const) {
        const out = extractPalette(inputs[name], settings({ algorithm }));
        expect(
          out.map((c) => [oklabToHex(c.lab), Number(c.population.toFixed(6))]),
          `${algorithm} ${name}`,
        ).toEqual(expected[algorithm]?.[name]);
      }
    }
  });
});
