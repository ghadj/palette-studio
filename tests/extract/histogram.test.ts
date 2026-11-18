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

describe("histogram mask, weights and bin indices (M2-T2)", () => {
  it("an all-zero mask gives no bins", () => {
    const data = pixels([
      ["#E8693A", 5],
      ["#14386B", 5],
    ]);
    const h = buildHistogram(data, { mask: new Uint8Array(10) });
    expect(h.size).toBe(0);
    expect(h.total).toBe(0);
    expect(h.bins).toHaveLength(0);
    // A mask with some pixels kept counts only those.
    const half = new Uint8Array(10);
    half.fill(1, 0, 5);
    const kept = buildHistogram(data, { mask: half });
    expect(kept.size).toBe(1);
    expect(kept.total).toBe(5);
  });

  it("weights 2:1 make a 50/50 image count 2:1", () => {
    const data = pixels([
      ["#E8693A", 10],
      ["#14386B", 10],
    ]);
    const weights = new Float32Array(20);
    weights.fill(2, 0, 10);
    weights.fill(1, 10, 20);
    const h = buildHistogram(data, { weights });
    expect(h.size).toBe(2);
    expect(h.total).toBe(30);
    const orange = hexToOklab("#E8693A");
    const i = Math.abs((h.means[0] ?? 0) - orange.l) < 1e-9 ? 0 : 1;
    expect(h.counts[i]).toBe(20);
    expect(h.counts[1 - i]).toBe(10);
    // Means are weighted too, but each bin here holds one color, so they stay exact.
    expect(h.means[i * 3]).toBeCloseTo(orange.l, 12);
  });

  it("bin index of #E8693A at 5 bits is (29 << 10) | (13 << 5) | 7", () => {
    const h = buildHistogram(pixels([["#E8693A", 3]]), { bits: 5 });
    expect(h.bits).toBe(5);
    expect(Array.from(h.bins)).toEqual([(29 << 10) | (13 << 5) | 7]);
    // Entries are in ascending bin order.
    const many = buildHistogram(
      pixels([
        ["#FFFFFF", 1],
        ["#000000", 1],
        ["#E8693A", 1],
      ]),
    );
    expect(Array.from(many.bins)).toEqual([0, (29 << 10) | (13 << 5) | 7, 32767]);
  });
});
