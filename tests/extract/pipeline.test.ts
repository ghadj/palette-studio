import { describe, expect, it } from "vitest";
import { oklabToHex } from "../../src/color/convert";
import { extractPalette, runExtraction } from "../../src/extract/pipeline";
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

  it("every pixel filtered gives an empty palette with reason 'all-filtered', no throw", () => {
    // M2 decision 18: the app then says "Every pixel is filtered out. Loosen a filter."
    const dark = row(
      pixels([
        ["#000000", 30],
        ["#111111", 10],
      ]),
    );
    for (const algorithm of ALGORITHMS) {
      for (const workingSpace of SPACES) {
        const s = settings({ algorithm, workingSpace, ignoreDark: { on: true, threshold: 0.2 } });
        const label = `${algorithm} ${workingSpace}`;
        expect(runExtraction(dark, s), label).toEqual({ colors: [], reason: "all-filtered" });
        expect(extractPalette(dark, s), label).toEqual([]);
      }
    }
    // Minimum chroma on a gray image, and the alpha cutoff on a half-transparent one.
    const grays = row(pixels([["#808080", 10]]));
    expect(runExtraction(grays, settings({ minChroma: 0.05 }))).toEqual({
      colors: [],
      reason: "all-filtered",
    });
    const faint = row(pixels([["#E8693A", 10, 120]]));
    expect(runExtraction(faint, settings({ alphaCutoff: 128 })).reason).toBe("all-filtered");
    // Loosening the filter brings the palette back, with no reason.
    const loose = runExtraction(dark, settings({ ignoreDark: { on: false, threshold: 0.2 } }));
    expect(loose.reason).toBeNull();
    expect(loose.colors.length).toBeGreaterThan(0);
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

  it("vividness 1 on an all-gray image gives a non-empty palette (decision 6b)", () => {
    // The vividness weight has a floor of 0.05, so grays still count when nothing is vivid.
    const grays = image(30, 10, (x) => (x < 10 ? "#202020" : x < 20 ? "#808080" : "#E0E0E0"));
    for (const algorithm of ["kmeans", "median-cut", "wu", "balanced", "even-spread"] as const) {
      const out = extractPalette(grays, settings({ algorithm, vividness: 1 }));
      expect(out.length, algorithm).toBeGreaterThan(0);
      expect(new Set(out.map((c) => oklabToHex(c.lab))), algorithm).toEqual(
        new Set(["#202020", "#808080", "#E0E0E0"]),
      );
      const total = out.reduce((n, c) => n + c.population, 0);
      expect(Math.abs(total - 1), algorithm).toBeLessThan(1e-9);
    }
  });

  it("passes the Sort setting to post-processing (spec 2.4, decision 16)", () => {
    const three = image(30, 10, (x) => (x < 5 ? "#14386B" : x < 20 ? "#E8693A" : "#1DB07A"));
    const hexes = (sort: ExtractionSettings["sort"]) =>
      extractPalette(three, settings({ algorithm: "median-cut", sort })).map((c) =>
        oklabToHex(c.lab),
      );
    expect(hexes("population")).toEqual(["#E8693A", "#1DB07A", "#14386B"]);
    expect(hexes("lightness")).toEqual(["#14386B", "#E8693A", "#1DB07A"]);
  });
});
