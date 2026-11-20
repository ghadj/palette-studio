import { describe, expect, it } from "vitest";
import { hexToOklab } from "../../src/color/convert";
import { assignPixels, FILTERED } from "../../src/extract/assign";
import { filterPixels } from "../../src/extract/filters";
import { DEFAULT_SETTINGS } from "../../src/state/defaults";
import type { WorkingSpace } from "../../src/types";
import { image, pixels, row } from "./helpers";

const SPACES: readonly WorkingSpace[] = ["oklab", "cielab", "linear-srgb", "srgb"];
const keepAll = (count: number) => new Uint8Array(count).fill(1);

describe("pixel assignment (marker placement, spec 3.7; M2 decision 13a)", () => {
  it("a two-color image with palette [A, B] labels every pixel exactly", () => {
    // Left half #E8693A, right half #14386B.
    const img = image(10, 4, (x) => (x < 5 ? "#E8693A" : "#14386B"));
    for (const space of SPACES) {
      const map = assignPixels(
        img,
        keepAll(40),
        [hexToOklab("#E8693A"), hexToOklab("#14386B")],
        space,
      );
      expect(map.width).toBe(10);
      expect(map.height).toBe(4);
      expect(map.labels).toBeInstanceOf(Uint8Array);
      expect(map.labels).toHaveLength(40);
      for (let y = 0; y < 4; y += 1) {
        for (let x = 0; x < 10; x += 1) {
          expect(map.labels[y * 10 + x], `${space} (${x}, ${y})`).toBe(x < 5 ? 0 : 1);
        }
      }
      // Swapping the palette order swaps the labels.
      const swapped = assignPixels(
        img,
        keepAll(40),
        [hexToOklab("#14386B"), hexToOklab("#E8693A")],
        space,
      );
      expect(swapped.labels[0]).toBe(1);
      expect(swapped.labels[9]).toBe(0);
    }
  });

  it("filtered pixels are 255", () => {
    // Two opaque pixels, two below the alpha cutoff, one too dark.
    const data = pixels([
      ["#E8693A", 1],
      ["#E8693A", 2, 0],
      ["#14386B", 1],
      ["#000000", 1],
    ]);
    const { mask } = filterPixels(data, {
      ...DEFAULT_SETTINGS,
      ignoreDark: { on: true, threshold: 0.2 },
    });
    const map = assignPixels(
      row(data),
      mask,
      [hexToOklab("#E8693A"), hexToOklab("#14386B")],
      "oklab",
    );
    expect(FILTERED).toBe(255);
    expect([...map.labels]).toEqual([0, 255, 255, 1, 255]);
  });

  it("uses the working space of the settings", () => {
    // #707070 against [black, white]: OKLab L is about 0.55, so it is nearer white in OKLab; in
    // sRGB (0.44), linear sRGB (0.16) and CIELAB (L* 47) it is nearer black.
    const img = row(pixels([["#707070", 1]]));
    const palette = [hexToOklab("#000000"), hexToOklab("#FFFFFF")];
    const label = (space: WorkingSpace) => assignPixels(img, keepAll(1), palette, space).labels[0];
    expect(label("oklab")).toBe(1);
    expect(label("srgb")).toBe(0);
    expect(label("linear-srgb")).toBe(0);
    expect(label("cielab")).toBe(0);
  });
});
