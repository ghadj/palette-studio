import { describe, expect, it } from "vitest";
import { hexToOklab, oklabToHex } from "../../src/color/convert";
import { deltaEOK } from "../../src/color/delta-e";
import { workingToOklab } from "../../src/color/working-space";
import { evenSpread } from "../../src/extract/even-spread";
import { buildHistogram } from "../../src/extract/histogram";
import { extractPalette } from "../../src/extract/pipeline";
import { SPEC_DEFAULT_SETTINGS } from "../../src/state/defaults";
import type { ExtractionSettings } from "../../src/types";
import { image, pixels, row } from "./helpers";

const hexes = (out: ReturnType<typeof evenSpread>) =>
  out.map((c) => oklabToHex(workingToOklab("oklab", c.color[0], c.color[1], c.color[2])));
const settings = (patch: Partial<ExtractionSettings>): ExtractionSettings => ({
  ...SPEC_DEFAULT_SETTINGS,
  algorithm: "even-spread",
  ...patch,
});

describe("Even spread (farthest point; spec 2.2)", () => {
  it("bins #808080 ×100, #000000 ×1, #FFFFFF ×1 with N=3 pick in extracted order #808080, #000000, #FFFFFF (OKLab distances 0.60 and 0.40)", () => {
    const gray = hexToOklab("#808080");
    expect(deltaEOK(gray, hexToOklab("#000000"))).toBeCloseTo(0.6, 2);
    expect(deltaEOK(gray, hexToOklab("#FFFFFF"))).toBeCloseTo(0.4, 2);
    const h = buildHistogram(
      pixels([
        ["#FFFFFF", 1],
        ["#808080", 100],
        ["#000000", 1],
      ]),
    );
    const out = evenSpread(h, 3);
    expect(hexes(out)).toEqual(["#808080", "#000000", "#FFFFFF"]);
    expect(out.map((c) => c.population)).toEqual([100 / 102, 1 / 102, 1 / 102]);
  });

  it("populations come from nearest assignment", () => {
    const h = buildHistogram(
      pixels([
        ["#808080", 10],
        ["#7A7A7A", 5],
        ["#000000", 3],
        ["#050505", 2],
      ]),
    );
    const out = evenSpread(h, 2);
    expect(hexes(out)).toEqual(["#808080", "#000000"]);
    expect(out.map((c) => c.population)).toEqual([15 / 20, 5 / 20]);
  });

  it("deterministic", () => {
    const img = image(48, 32, (x, y) => {
      const r = (x * 5).toString(16).padStart(2, "0");
      const g = (y * 7).toString(16).padStart(2, "0");
      return `#${r}${g}80`;
    });
    const a = extractPalette(img, settings({ colors: 8 }));
    expect(a.length).toBeGreaterThan(1);
    expect(extractPalette(img, settings({ colors: 8 }))).toEqual(a);
    expect(extractPalette(img, settings({ colors: 8, seed: 99 }))).toEqual(a);
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
