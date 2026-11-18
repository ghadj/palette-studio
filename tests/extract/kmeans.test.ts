import { describe, expect, it } from "vitest";
import { hexToOklab } from "../../src/color/convert";
import { buildHistogram, type Histogram } from "../../src/extract/histogram";
import { initCentroids, kmeans, mulberry32 } from "../../src/extract/kmeans";
import { pixels } from "./helpers";

const hist = (points: Array<[number, number, number, number]>): Histogram => ({
  size: points.length,
  counts: Float64Array.from(points.map((p) => p[3])),
  means: Float64Array.from(points.flatMap((p) => [p[0], p[1], p[2]])),
  total: points.reduce((n, p) => n + p[3], 0),
  // Synthetic points have no sRGB bin; median cut and k-means don't read bin indices.
  bits: 5,
  bins: Uint32Array.from(points, (_, i) => i),
});

/** A deterministic cloud of points around three centers, with varied weights. */
function threeClusters(): { h: Histogram; centers: number[][] } {
  const rng = mulberry32(42);
  const centers = [
    [0.2, 0.1, -0.1],
    [0.8, -0.1, 0.05],
    [0.5, 0.15, 0.15],
  ];
  const points: Array<[number, number, number, number]> = [];
  for (const c of centers) {
    for (let i = 0; i < 40; i += 1) {
      points.push([
        (c[0] ?? 0) + (rng() - 0.5) * 0.04,
        (c[1] ?? 0) + (rng() - 0.5) * 0.04,
        (c[2] ?? 0) + (rng() - 0.5) * 0.04,
        1 + Math.floor(rng() * 9),
      ]);
    }
  }
  return { h: hist(points), centers };
}

function weightedMean(h: Histogram, indices: number[]): number[] {
  let w = 0;
  const s = [0, 0, 0];
  for (const i of indices) {
    const n = h.counts[i] ?? 0;
    w += n;
    for (let c = 0; c < 3; c += 1) s[c] = (s[c] ?? 0) + n * (h.means[i * 3 + c] ?? 0);
  }
  return s.map((v) => v / w);
}

describe("weighted k-means++ (spec 2.2, 2.4, 7.6, 8)", () => {
  it("same seed gives identical output", () => {
    const { h } = threeClusters();
    const a = kmeans(h, { k: 5, seed: 7 });
    const b = kmeans(h, { k: 5, seed: 7 });
    expect(a).toEqual(b);
  });

  it("a different seed can change initial centroids", () => {
    const { h } = threeClusters();
    const one = initCentroids(h, 3, mulberry32(1));
    const two = initCentroids(h, 3, mulberry32(2));
    expect(one).not.toEqual(two);
    expect(initCentroids(h, 3, mulberry32(1))).toEqual(one);
  });

  it("three separated weighted clusters converge to their weighted means within 1e-4", () => {
    const { h } = threeClusters();
    const result = kmeans(h, { k: 3, seed: 1 });
    expect(result.clusters).toHaveLength(3);
    expect(result.converged).toBe(true);
    for (let group = 0; group < 3; group += 1) {
      const indices = Array.from({ length: 40 }, (_, i) => group * 40 + i);
      const expected = weightedMean(h, indices);
      const found = result.clusters.find(
        (c) =>
          Math.hypot(
            c.color[0] - (expected[0] ?? 0),
            c.color[1] - (expected[1] ?? 0),
            c.color[2] - (expected[2] ?? 0),
          ) < 1e-4,
      );
      expect(found, `group ${group}`).toBeDefined();
      const weight = indices.reduce((n, i) => n + (h.counts[i] ?? 0), 0);
      expect(found?.population).toBeCloseTo(weight / h.total, 12);
    }
  });

  it("single-color, two-color and fully transparent inputs are stable", () => {
    const single = kmeans(buildHistogram(pixels([["#14386B", 20]])), { k: 6 });
    expect(single.clusters).toHaveLength(1);
    expect(single.clusters[0]?.population).toBe(1);
    expect(single.clusters[0]?.color[0]).toBeCloseTo(hexToOklab("#14386B").l, 12);

    const two = kmeans(
      buildHistogram(
        pixels([
          ["#1DB07A", 30],
          ["#5039B0", 10],
        ]),
      ),
      { k: 6 },
    );
    const pops = two.clusters.map((c) => c.population).sort();
    expect(pops).toEqual([0.25, 0.75]);
    for (const hex of ["#1DB07A", "#5039B0"]) {
      const ref = hexToOklab(hex);
      expect(
        two.clusters.some(
          (c) =>
            Math.abs(c.color[0] - ref.l) < 1e-12 &&
            Math.abs(c.color[1] - ref.a) < 1e-12 &&
            Math.abs(c.color[2] - ref.b) < 1e-12,
        ),
        hex,
      ).toBe(true);
    }

    const empty = kmeans(buildHistogram(pixels([["#000000", 10, 0]])), { k: 6 });
    expect(empty.clusters).toEqual([]);
    expect(empty.error).toBe(0);
  });

  it("N larger than the distinct colors returns at most the distinct count, with no empty cluster", () => {
    const h = buildHistogram(
      pixels([
        ["#FF0000", 5],
        ["#00FF00", 3],
        ["#0000FF", 2],
      ]),
    );
    const result = kmeans(h, { k: 12, seed: 3 });
    expect(result.clusters.length).toBeLessThanOrEqual(3);
    expect(result.clusters).toHaveLength(3);
    for (const c of result.clusters) expect(c.population).toBeGreaterThan(0);
    expect(result.clusters.reduce((n, c) => n + c.population, 0)).toBeCloseTo(1, 12);
  });

  it("stops at the iteration cap when the shift never drops below 1e-4", () => {
    const { h } = threeClusters();
    const capped = kmeans(h, { k: 7, seed: 5, iterations: 1, restarts: 1 });
    expect(capped.iterations).toBe(1);
    expect(capped.converged).toBe(false);
    const free = kmeans(h, { k: 7, seed: 5, iterations: 100, restarts: 1 });
    expect(free.converged).toBe(true);
    expect(free.iterations).toBeLessThan(100);
  });

  it("of 3 restarts the lowest-error result is kept", () => {
    const { h } = threeClusters();
    const result = kmeans(h, { k: 6, seed: 11, restarts: 3 });
    expect(result.restartErrors).toHaveLength(3);
    expect(result.error).toBe(Math.min(...result.restartErrors));
    // Recompute the kept result's error from its clusters to check it is the reported one.
    let error = 0;
    for (let i = 0; i < h.size; i += 1) {
      let best = Number.POSITIVE_INFINITY;
      for (const c of result.clusters) {
        const d =
          ((h.means[i * 3] ?? 0) - c.color[0]) ** 2 +
          ((h.means[i * 3 + 1] ?? 0) - c.color[1]) ** 2 +
          ((h.means[i * 3 + 2] ?? 0) - c.color[2]) ** 2;
        best = Math.min(best, d);
      }
      error += (h.counts[i] ?? 0) * best;
    }
    expect(result.error).toBeCloseTo(error, 9);
  });

  it("mulberry32 is deterministic and in [0, 1)", () => {
    const a = mulberry32(1);
    const b = mulberry32(1);
    for (let i = 0; i < 1000; i += 1) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});
