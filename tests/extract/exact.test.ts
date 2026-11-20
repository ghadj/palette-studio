import { describe, expect, it } from "vitest";
import { hexToOklab, oklabToHex } from "../../src/color/convert";
import { deltaE } from "../../src/color/delta-e";
import { workingToOklab } from "../../src/color/working-space";
import { exactColors } from "../../src/extract/exact";
import { extractPalette } from "../../src/extract/pipeline";
import { SPEC_DEFAULT_SETTINGS } from "../../src/state/defaults";
import type { ExtractionSettings, WorkingSpace } from "../../src/types";
import { pixels, row } from "./helpers";

const hexes = (out: ReturnType<typeof exactColors>, space: WorkingSpace = "oklab") =>
  out.map((c) => oklabToHex(workingToOklab(space, c.color[0], c.color[1], c.color[2])));
const settings = (patch: Partial<ExtractionSettings>): ExtractionSettings => ({
  ...SPEC_DEFAULT_SETTINGS,
  algorithm: "exact",
  ...patch,
});

describe("Exact colors (spec 2.2; M2 decision 12)", () => {
  it("three flat colors plus one stray pixel, N=3, give the three exact hexes", () => {
    const data = pixels([
      ["#E8693A", 50],
      ["#14386B", 40],
      ["#1DB07A", 30],
      ["#FF00FF", 1],
    ]);
    const out = exactColors(data, { n: 3 });
    expect(hexes(out)).toEqual(["#E8693A", "#14386B", "#1DB07A"]);
  });

  it("anti-aliased edge colors lose to the flat colors", () => {
    // Two flat colors with a few blended pixels between them, as a smooth edge leaves.
    const data = pixels([
      ["#14386B", 60],
      ["#E8693A", 40],
      ["#5E5153", 3],
      ["#3B4560", 2],
      ["#A05E46", 2],
    ]);
    expect(hexes(exactColors(data, { n: 2 }))).toEqual(["#14386B", "#E8693A"]);
  });

  it("never averages: every output is an input color", () => {
    const inputs = ["#E8693A", "#E96A3B", "#EA6B3C", "#14386B", "#15396C", "#1DB07A", "#808080"];
    const data = pixels(inputs.map((hex, i) => [hex, 10 + i] as [string, number]));
    for (const space of ["oklab", "cielab", "linear-srgb", "srgb"] as WorkingSpace[]) {
      for (const n of [1, 2, 3, 5, 7, 12]) {
        for (const hex of hexes(exactColors(data, { n, space }), space)) {
          expect(inputs, `${space} N=${n}`).toContain(hex);
        }
      }
    }
    // Through the pipeline too, with merging off.
    const out = extractPalette(row(data), settings({ colors: 4, mergeThreshold: 0 }));
    for (const c of out) expect(inputs).toContain(oklabToHex(c.lab));
  });

  it("ties go to the lower packed RGB", () => {
    const data = pixels([
      ["#FFFFFF", 5],
      ["#000001", 5],
      ["#000000", 5],
    ]);
    expect(hexes(exactColors(data, { n: 2 }))).toEqual(["#000000", "#000001"]);
  });

  it("leftover pixels raise the population of their nearest chosen color", () => {
    const data = pixels([
      ["#E8693A", 50],
      ["#14386B", 40],
      // Near the orange, so its 10 pixels join it.
      ["#E96A3B", 10],
    ]);
    const out = exactColors(data, { n: 2 });
    expect(hexes(out)).toEqual(["#E8693A", "#14386B"]);
    expect(out.map((c) => c.population)).toEqual([0.6, 0.4]);
  });

  it("stable on single-color, two-color and transparent inputs (spec 8)", () => {
    for (const workingSpace of ["oklab", "cielab", "linear-srgb", "srgb"] as const) {
      const s = settings({ workingSpace });
      const one = extractPalette(row(pixels([["#14386B", 100]])), s);
      expect(one.map((c) => oklabToHex(c.lab))).toEqual(["#14386B"]);
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
      expect(two.map((c) => oklabToHex(c.lab))).toEqual(["#1DB07A", "#5039B0"]);
      expect(two.map((c) => c.population)).toEqual([0.75, 0.25]);
      expect(extractPalette(row(pixels([["#FFFFFF", 50, 0]])), s)).toEqual([]);
    }
  });
});

describe("Exact colors, Keep one outlier edge cases (M2 decision 8b)", () => {
  const near = (out: ReturnType<typeof exactColors>, hex: string) => hexes(out).includes(hex);

  it("no remaining color reaches 0.1%, so N - 1 colors come back", () => {
    // Two big colors, then five colors of one pixel each (0.05% of 2005): none qualifies.
    const data = pixels([
      ["#14386B", 1000],
      ["#E8693A", 1000],
      ["#FF00AA", 1],
      ["#1DB07A", 1],
      ["#5039B0", 1],
      ["#010203", 1],
      ["#F0F0F0", 1],
    ]);
    const direct = exactColors(data, { n: 2, outlier: "ok" });
    expect(hexes(direct)).toEqual(["#14386B", "#E8693A"]);
    const out = extractPalette(
      row(data),
      settings({ colors: 3, keepOutlier: true, mergeThreshold: 0 }),
    );
    expect(out).toHaveLength(2);
  });

  it("the CIEDE2000 metric picks the farthest qualifying color by CIEDE2000", () => {
    const kept = ["#14386B", "#E8693A"];
    const candidates = ["#FF00AA", "#1DB07A", "#5039B0", "#9A9A9A"];
    const data = pixels([
      [kept[0] as string, 1000],
      [kept[1] as string, 900],
      ...candidates.map((hex) => [hex, 20] as [string, number]),
    ]);
    const farthest = (metric: "ok" | "ciede2000") =>
      candidates.reduce((a, b) => {
        const d = (hex: string) =>
          Math.min(...kept.map((k) => deltaE(metric, hexToOklab(hex), hexToOklab(k))));
        return d(b) > d(a) ? b : a;
      });
    const out = exactColors(data, { n: 2, outlier: "ciede2000" });
    expect(out).toHaveLength(3);
    expect(near(out, farthest("ciede2000"))).toBe(true);
    const ok = exactColors(data, { n: 2, outlier: "ok" });
    expect(near(ok, farthest("ok"))).toBe(true);
  });

  it("spatial weights decide which colors reach 0.1%", () => {
    // #FF00AA is the farthest color, but its 200 pixels weigh 0.001 each (0.2 of about 1805):
    // under 0.1%, so the nearer #1A3C70 (5 pixels at weight 1) is the outlier.
    const runs: Array<[string, number]> = [
      ["#14386B", 1000],
      ["#E8693A", 800],
      ["#FF00AA", 200],
      ["#1A3C70", 5],
    ];
    const data = pixels(runs);
    const weights = new Float32Array(data.length / 4).fill(1);
    weights.fill(0.001, 1800, 2000);
    const out = exactColors(data, { n: 2, weights, outlier: "ok" });
    expect(out).toHaveLength(3);
    expect(near(out, "#1A3C70")).toBe(true);
    expect(near(out, "#FF00AA")).toBe(false);
    // Without the weights both qualify, and the farther of the two wins.
    const dist = (hex: string) =>
      Math.min(...["#14386B", "#E8693A"].map((k) => deltaE("ok", hexToOklab(hex), hexToOklab(k))));
    const far = dist("#FF00AA") > dist("#1A3C70") ? "#FF00AA" : "#1A3C70";
    expect(far).toBe("#FF00AA");
    expect(near(exactColors(data, { n: 2, outlier: "ok" }), far)).toBe(true);
  });

  it("fewer distinct colors than N returns them all, with no outlier added", () => {
    const data = pixels([
      ["#14386B", 60],
      ["#E8693A", 40],
    ]);
    for (const outlier of [undefined, "ok", "ciede2000"] as const) {
      const out = exactColors(data, outlier ? { n: 5, outlier } : { n: 5 });
      expect(hexes(out)).toEqual(["#14386B", "#E8693A"]);
    }
    const piped = extractPalette(
      row(data),
      settings({ colors: 5, keepOutlier: true, mergeThreshold: 0 }),
    );
    expect(piped).toHaveLength(2);
  });
});
