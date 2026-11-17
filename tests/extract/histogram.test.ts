import { describe, expect, it } from "vitest";
import { hexToOklab } from "../../src/color/convert";
import { buildHistogram } from "../../src/extract/histogram";
import { pixels } from "./helpers";

describe("weighted histogram (spec 2.2, 7.6)", () => {
  it("a 5-bit histogram never exceeds 32,768 bins", () => {
    // Every 8-bit color in steps of 3 per channel: 86^3 = 636,056 colors.
    const values: number[] = [];
    for (let r = 0; r < 256; r += 3)
      for (let g = 0; g < 256; g += 3) for (let b = 0; b < 256; b += 3) values.push(r, g, b, 255);
    const h = buildHistogram(new Uint8ClampedArray(values), { space: "srgb" });
    expect(h.size).toBe(32768);
    expect(h.total).toBe(values.length / 4);
    expect(buildHistogram(new Uint8ClampedArray(values), { space: "srgb", bits: 4 }).size).toBe(
      4096,
    );
  });

  it("a 75/25 two-color image gives 2 bins with counts 3:1 and the exact OKLab means", () => {
    const h = buildHistogram(
      pixels([
        ["#1DB07A", 3],
        ["#5039B0", 1],
      ]),
      { space: "oklab" },
    );
    expect(h.size).toBe(2);
    expect(h.total).toBe(4);
    const bins = [0, 1].map((i) => ({
      count: h.counts[i],
      l: h.means[i * 3],
      a: h.means[i * 3 + 1],
      b: h.means[i * 3 + 2],
    }));
    const major = bins.find((b) => b.count === 3);
    const minor = bins.find((b) => b.count === 1);
    for (const [bin, hex] of [
      [major, "#1DB07A"],
      [minor, "#5039B0"],
    ] as const) {
      const ref = hexToOklab(hex);
      expect(bin?.l).toBeCloseTo(ref.l, 12);
      expect(bin?.a).toBeCloseTo(ref.a, 12);
      expect(bin?.b).toBeCloseTo(ref.b, 12);
    }
  });

  it("pixels with alpha below 128 are ignored", () => {
    const h = buildHistogram(
      pixels([
        ["#FF0000", 2, 127],
        ["#00FF00", 1, 128],
        ["#0000FF", 1, 255],
      ]),
    );
    expect(h.total).toBe(2);
    expect(h.size).toBe(2);
  });

  it("a fully transparent image gives no bins", () => {
    const h = buildHistogram(pixels([["#123456", 50, 0]]));
    expect(h.size).toBe(0);
    expect(h.total).toBe(0);
  });

  it("the bin mean is the mean of the pixels' working-space colors", () => {
    // Two colors in the same 5-bit bin.
    const h = buildHistogram(
      pixels([
        ["#808080", 1],
        ["#838383", 3],
      ]),
      { space: "srgb" },
    );
    expect(h.size).toBe(1);
    expect(h.means[0]).toBeCloseTo((0x80 + 3 * 0x83) / 4 / 255, 12);
  });
});
