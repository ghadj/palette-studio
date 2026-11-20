import { describe, expect, it } from "vitest";
import { hexToOklab, oklabToHex } from "../../src/color/convert";
import { filterPixels, type PixelFilters } from "../../src/extract/filters";
import { extractPalette } from "../../src/extract/pipeline";
import { DEFAULT_SETTINGS } from "../../src/state/defaults";
import type { ExtractionSettings, WorkingSpace } from "../../src/types";
import { pixels, row } from "./helpers";

const OFF: PixelFilters = {
  alphaCutoff: 0,
  ignoreDark: { on: false, threshold: 0.2 },
  ignoreLight: { on: false, threshold: 0.95 },
  minChroma: 0,
};
const filters = (patch: Partial<PixelFilters>): PixelFilters => ({ ...OFF, ...patch });

/** Keeps per input pixel, one pixel per hex. */
function keeps(hexes: Array<string | [string, number]>, f: PixelFilters): boolean[] {
  const data = pixels(hexes.map((h) => (typeof h === "string" ? [h, 1] : [h[0], 1, h[1]])));
  const { mask } = filterPixels(data, f);
  return [...mask].map((m) => m === 1);
}

const L = (hex: string) => hexToOklab(hex).l;
const C = (hex: string) => Math.hypot(hexToOklab(hex).a, hexToOklab(hex).b);

describe("pixel filters (spec 2.1 step 3, 2.4; M2 decision 3)", () => {
  it("ignore dark drops #000000 (L 0) and #111111 (L 0.178), keeps #333333 (L 0.321)", () => {
    expect(L("#000000")).toBeCloseTo(0, 3);
    expect(L("#111111")).toBeCloseTo(0.178, 3);
    expect(L("#333333")).toBeCloseTo(0.321, 3);
    const f = filters({ ignoreDark: { on: true, threshold: 0.2 } });
    expect(keeps(["#000000", "#111111", "#333333"], f)).toEqual([false, false, true]);
    // Off, the same threshold drops nothing.
    expect(keeps(["#000000", "#111111", "#333333"], OFF)).toEqual([true, true, true]);
  });

  it("ignore light drops #FFFFFF (L 1.000) and #F5F5F5 (L 0.970), keeps #E0E0E0 (L 0.907)", () => {
    expect(L("#FFFFFF")).toBeCloseTo(1, 3);
    expect(L("#F5F5F5")).toBeCloseTo(0.97, 3);
    expect(L("#E0E0E0")).toBeCloseTo(0.907, 3);
    const f = filters({ ignoreLight: { on: true, threshold: 0.95 } });
    expect(keeps(["#FFFFFF", "#F5F5F5", "#E0E0E0"], f)).toEqual([false, false, true]);
    expect(keeps(["#FFFFFF", "#F5F5F5", "#E0E0E0"], OFF)).toEqual([true, true, true]);
  });

  it("the thresholds are adjustable: ignore dark at 0.35 also drops #333333", () => {
    const f = filters({ ignoreDark: { on: true, threshold: 0.35 } });
    expect(keeps(["#333333", "#808080"], f)).toEqual([false, true]);
    const g = filters({ ignoreLight: { on: true, threshold: 0.9 } });
    expect(keeps(["#E0E0E0", "#808080"], g)).toEqual([false, true]);
  });

  it("min chroma 0.05 drops #808080 (C 0) and keeps #FF0000 (C 0.258)", () => {
    expect(C("#808080")).toBeCloseTo(0, 6);
    expect(C("#FF0000")).toBeCloseTo(0.258, 3);
    expect(keeps(["#808080", "#FF0000"], filters({ minChroma: 0.05 }))).toEqual([false, true]);
    // Minimum chroma 0 (the default) keeps grays.
    expect(keeps(["#808080", "#FF0000"], filters({ minChroma: 0 }))).toEqual([true, true]);
  });

  it("alpha cutoff 200 drops alpha 199 and keeps alpha 200", () => {
    const f = filters({ alphaCutoff: 200 });
    expect(
      keeps(
        [
          ["#E8693A", 199],
          ["#E8693A", 200],
          ["#E8693A", 255],
        ],
        f,
      ),
    ).toEqual([false, true, true]);
  });

  it("counts the kept pixels", () => {
    const data = pixels([
      ["#000000", 3],
      ["#808080", 5],
      ["#FFFFFF", 2, 0],
    ]);
    const out = filterPixels(
      data,
      filters({ alphaCutoff: 128, ignoreDark: { on: true, threshold: 0.2 } }),
    );
    expect(out.kept).toBe(5);
    expect(out.mask).toHaveLength(10);
  });

  it("filters behave the same in all four working spaces", () => {
    // Filters read OKLab L and C whatever the working space, so each space drops the same pixels.
    const image = row(
      pixels([
        ["#000000", 20],
        ["#111111", 20],
        ["#FFFFFF", 20],
        ["#F5F5F5", 20],
        ["#808080", 20],
        ["#E8693A", 30],
        ["#14386B", 10],
      ]),
    );
    const SPACES: WorkingSpace[] = ["oklab", "cielab", "linear-srgb", "srgb"];
    const patch: Partial<ExtractionSettings> = {
      colors: 12,
      mergeThreshold: 0,
      ignoreDark: { on: true, threshold: 0.2 },
      ignoreLight: { on: true, threshold: 0.95 },
      minChroma: 0.05,
    };
    for (const algorithm of ["exact", "median-cut", "balanced"] as const) {
      for (const workingSpace of SPACES) {
        const s = { ...DEFAULT_SETTINGS, ...patch, algorithm, workingSpace };
        const out = extractPalette(image, s);
        expect(
          out.map((c) => [oklabToHex(c.lab), c.population]),
          `${algorithm} ${workingSpace}`,
        ).toEqual([
          ["#E8693A", 0.75],
          ["#14386B", 0.25],
        ]);
      }
    }
  });
});
