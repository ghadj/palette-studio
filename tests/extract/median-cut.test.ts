import { describe, expect, it } from "vitest";
import { hexToOklab } from "../../src/color/convert";
import type { Histogram } from "../../src/extract/histogram";
import { buildHistogram } from "../../src/extract/histogram";
import { medianCut } from "../../src/extract/median-cut";
import { pixels } from "./helpers";

const hist = (points: Array<[number, number, number, number]>): Histogram => ({
  size: points.length,
  counts: Float64Array.from(points.map((p) => p[3])),
  means: Float64Array.from(points.flatMap((p) => [p[0], p[1], p[2]])),
  total: points.reduce((n, p) => n + p[3], 0),
});

describe("median cut (spec 2.2, 7.6)", () => {
  it("single-color image with N=6 returns one swatch with that color and population 1", () => {
    const result = medianCut(buildHistogram(pixels([["#14386B", 64]])), 6);
    expect(result).toHaveLength(1);
    const ref = hexToOklab("#14386B");
    expect(result[0]?.color[0]).toBeCloseTo(ref.l, 12);
    expect(result[0]?.color[1]).toBeCloseTo(ref.a, 12);
    expect(result[0]?.color[2]).toBeCloseTo(ref.b, 12);
    expect(result[0]?.population).toBe(1);
  });

  it("two-color 75/25 image with N=2 returns both exact colors with populations 0.75 and 0.25", () => {
    const result = medianCut(
      buildHistogram(
        pixels([
          ["#1DB07A", 300],
          ["#5039B0", 100],
        ]),
      ),
      2,
    );
    expect(result).toHaveLength(2);
    const byPop = [...result].sort((a, b) => b.population - a.population);
    expect(byPop.map((c) => c.population)).toEqual([0.75, 0.25]);
    for (const [cluster, hex] of [
      [byPop[0], "#1DB07A"],
      [byPop[1], "#5039B0"],
    ] as const) {
      const ref = hexToOklab(hex);
      expect(cluster?.color[0]).toBeCloseTo(ref.l, 12);
      expect(cluster?.color[1]).toBeCloseTo(ref.a, 12);
      expect(cluster?.color[2]).toBeCloseTo(ref.b, 12);
    }
  });

  it("fully transparent image returns an empty palette without throwing", () => {
    expect(medianCut(buildHistogram(pixels([["#000000", 10, 0]])), 6)).toEqual([]);
  });

  it("a constructed 4-bin case splits on the widest channel at the population median", () => {
    // Channel 0 spans 0.6, channel 1 spans 0.2, channel 2 spans 0.1: split on channel 0.
    // Weights along channel 0 are 1, 1, 1, 5: the median falls in the heavy bin, so the cut puts
    // the three light bins on one side and the heavy one on the other.
    const h = hist([
      [0.7, 0.0, 0.0, 5],
      [0.1, 0.2, 0.1, 1],
      [0.3, 0.1, 0.0, 1],
      [0.5, 0.0, 0.05, 1],
    ]);
    const two = medianCut(h, 2);
    expect(two).toHaveLength(2);
    const heavy = two.find((c) => c.population === 5 / 8);
    const light = two.find((c) => c.population === 3 / 8);
    expect(heavy?.color).toEqual([0.7, 0, 0]);
    expect(light?.color[0]).toBeCloseTo(0.3, 12);
    expect(light?.color[1]).toBeCloseTo(0.1, 12);
    expect(light?.color[2]).toBeCloseTo(0.05, 12);

    // Equal weights: the median sits in the middle of the sorted bins (2 + 2).
    const even = hist([
      [0.0, 0.1, 0.0, 1],
      [0.0, 0.9, 0.0, 1],
      [0.05, 0.3, 0.0, 1],
      [0.05, 0.7, 0.0, 1],
    ]);
    const split = medianCut(even, 2)
      .map((c) => c.color[1])
      .sort();
    expect(split[0]).toBeCloseTo(0.2, 12);
    expect(split[1]).toBeCloseTo(0.8, 12);
  });

  it("same input twice gives identical output", () => {
    const values: Array<[string, number]> = [];
    for (let i = 0; i < 60; i += 1) {
      const hex = `#${((i * 2654435761) >>> 8).toString(16).padStart(6, "0").slice(-6)}`;
      values.push([hex, 1 + (i % 7)]);
    }
    const h = buildHistogram(pixels(values));
    expect(medianCut(h, 8)).toEqual(medianCut(h, 8));
    expect(medianCut(h, 8)).toHaveLength(8);
    const sum = medianCut(h, 8).reduce((n, c) => n + c.population, 0);
    expect(sum).toBeCloseTo(1, 12);
  });
});
