import { describe, expect, it } from "vitest";
import { oklabToHex } from "../../src/color/convert";
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
