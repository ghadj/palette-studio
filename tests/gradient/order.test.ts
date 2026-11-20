import { describe, expect, it } from "vitest";
import { contrastRatio } from "../../src/color/contrast";
import { hexToOklab, type Oklab, oklchToHex, oklchToOklab } from "../../src/color/convert";
import { deltaEOK } from "../../src/color/delta-e";
import {
  constrainedRandom,
  distanceMatrix,
  distinctSwatches,
  mostDistinct,
  orderedStops,
  populationPositions,
  randomTries,
  smoothPath,
  sortSwatches,
  twoOpt,
} from "../../src/gradient/order";
import { buildStops } from "../../src/gradient/sources";
import { createSwatch } from "../../src/palette/model";
import { DEFAULT_GRADIENT } from "../../src/state/defaults";
import { MOCKUP_GRADIENT_PICKS, MOCKUP_SWATCHES } from "../../src/state/mockup-fixture";
import type { Swatch, Technique } from "../../src/types";

const gray = (l: number): Oklab => ({ l, a: 0, b: 0 });
const grays = (ls: readonly number[]): Oklab[] => ls.map(gray);
const graySwatches = (ls: readonly number[]): Swatch[] =>
  ls.map((l, i) => createSwatch(gray(l), { id: `s${i}` }));
const hueSwatches = (hs: readonly number[]): Swatch[] =>
  hs.map((h, i) => createSwatch(oklchToOklab({ l: 0.65, c: 0.1, h }), { id: `h${i}` }));

const mockupSwatches = (): Swatch[] =>
  MOCKUP_SWATCHES.map((m, i) => createSwatch(hexToOklab(m.hex), { id: `m${i + 1}` }));
const mockupLabs = (): Oklab[] => MOCKUP_SWATCHES.map((m) => hexToOklab(m.hex));

const pathLength = (labs: readonly Oklab[], order: readonly number[]): number => {
  let total = 0;
  for (let i = 1; i < order.length; i++) {
    total += deltaEOK(labs[order[i - 1] as number] as Oklab, labs[order[i] as number] as Oklab);
  }
  return total;
};

/** A plain nearest-neighbor path from every start, the best kept: the baseline 2-opt must beat. */
const nearestNeighborBest = (labs: readonly Oklab[]): number => {
  let best = Infinity;
  for (let start = 0; start < labs.length; start++) {
    const order = [start];
    const left = new Set(labs.map((_, i) => i).filter((i) => i !== start));
    while (left.size > 0) {
      const at = labs[order[order.length - 1] as number] as Oklab;
      let next = -1;
      let nd = Infinity;
      for (const i of left) {
        const d = deltaEOK(at, labs[i] as Oklab);
        if (d < nd) {
          nd = d;
          next = i;
        }
      }
      order.push(next);
      left.delete(next);
    }
    best = Math.min(best, pathLength(labs, order));
  }
  return best;
};

/**
 * Five colors at L 0.5 where the best nearest-neighbor walk (0.2843 ΔE OK) is longer than the
 * 2-opt path (0.2735), found by a search over a coarse grid.
 */
const NN_TRAP: Oklab[] = [
  { l: 0.5, a: 0, b: 0.14 },
  { l: 0.5, a: 0.12, b: 0.08 },
  { l: 0.5, a: 0.1, b: 0.08 },
  { l: 0.5, a: 0.16, b: 0.14 },
  { l: 0.5, a: 0.12, b: 0.04 },
];

const technique = (patch: Partial<Technique>): Technique => ({
  ...DEFAULT_GRADIENT.technique,
  ...patch,
});

describe("Sorted (spec 4.2; plan D13)", () => {
  it("lightness: L [0.7, 0.2, 0.5] → 0.2, 0.5, 0.7", () => {
    const out = sortSwatches(graySwatches([0.7, 0.2, 0.5]), "lightness");
    expect(out.map((s) => s.color.l)).toEqual([0.2, 0.5, 0.7].map((l) => expect.closeTo(l, 9)));
  });

  it("chroma: high to low (M2 decision 16)", () => {
    const sw = [0.05, 0.2, 0.1].map((c, i) =>
      createSwatch(oklchToOklab({ l: 0.6, c, h: 200 }), { id: `c${i}` }),
    );
    expect(sortSwatches(sw, "chroma").map((s) => s.id)).toEqual(["c1", "c2", "c0"]);
  });

  it("hue: [350, 10, 120] → 350, 10, 120 (it starts after the largest gap); [10, 120, 240] → 10, 120, 240", () => {
    const a = sortSwatches(hueSwatches([350, 10, 120]), "hue");
    expect(a.map((s) => s.id)).toEqual(["h0", "h1", "h2"]);
    const b = sortSwatches(hueSwatches([240, 10, 120]), "hue");
    expect(b.map((s) => s.id)).toEqual(["h1", "h2", "h0"]);
  });

  it("keeps palette order between equal keys and leaves the input alone", () => {
    const sw = graySwatches([0.5, 0.2, 0.5]);
    expect(sortSwatches(sw, "lightness").map((s) => s.id)).toEqual(["s1", "s0", "s2"]);
    expect(sw.map((s) => s.id)).toEqual(["s0", "s1", "s2"]);
  });
});

describe("Smooth path (spec 4.2, 7.6; plan D13)", () => {
  it("L [0.9, 0.1, 0.5, 0.3, 0.7] → 0.9, 0.7, 0.5, 0.3, 0.1 (it starts at the end that comes first in palette order)", () => {
    expect(smoothPath(grays([0.9, 0.1, 0.5, 0.3, 0.7]), "ok")).toEqual([0, 4, 2, 3, 1]);
  });

  it("L [0.5, 0.6, 0.35, 0.8, 0.2]: total ΔE 0.6, never more than nearest neighbor's", () => {
    const labs = grays([0.5, 0.6, 0.35, 0.8, 0.2]);
    const order = smoothPath(labs, "ok");
    expect(pathLength(labs, order)).toBeCloseTo(0.6, 9);
    // The ends are swatches 4 (0.8) and 5 (0.2); swatch 4 comes first in palette order.
    expect(order).toEqual([3, 1, 0, 2, 4]);
  });

  it("2-opt uncrosses a crossing path: the square walked A, C, B, D becomes a perimeter walk", () => {
    // The corners of a square of side 0.1 in the a-b plane. A → C → B → D crosses itself
    // (length 0.1 (2√2 + 1) ≈ 0.383); reversing C, B gives the perimeter path, length 0.3.
    const sq: Oklab[] = [
      { l: 0.5, a: 0, b: 0 },
      { l: 0.5, a: 0.1, b: 0 },
      { l: 0.5, a: 0.1, b: 0.1 },
      { l: 0.5, a: 0, b: 0.1 },
    ];
    const dist = distanceMatrix(sq, "ok");
    const crossing = [0, 2, 1, 3];
    expect(pathLength(sq, crossing)).toBeCloseTo(0.1 * (2 * Math.SQRT2 + 1), 12);
    const fixed = twoOpt(crossing, dist);
    expect(pathLength(sq, fixed)).toBeCloseTo(0.3, 12);
    // Every step is one side of the square, so the walk no longer crosses itself.
    for (let k = 1; k < fixed.length; k++) {
      expect(dist[fixed[k - 1] as number]?.[fixed[k] as number]).toBeCloseTo(0.1, 12);
    }
    expect(crossing).toEqual([0, 2, 1, 3]);
  });

  it("2-opt reverses an end run of an open path (only one edge changes)", () => {
    // L 0, 0.3, 0.2, 0.1 in that walk: reversing the last three gives 0, 0.1, 0.2, 0.3.
    const labs = grays([0, 0.1, 0.2, 0.3]);
    const fixed = twoOpt([0, 3, 2, 1], distanceMatrix(labs, "ok"));
    expect(fixed).toEqual([0, 1, 2, 3]);
  });

  it("beats nearest neighbor from every start where greedy goes wrong", () => {
    const labs = NN_TRAP;
    const order = smoothPath(labs, "ok");
    expect(nearestNeighborBest(labs)).toBeCloseTo(0.28432, 4);
    expect(pathLength(labs, order)).toBeCloseTo(0.27345, 4);
  });

  it("the mockup subset of swatches 2, 4 and 6 gives 2, 4, 6", () => {
    const labs = mockupLabs();
    const subset = MOCKUP_GRADIENT_PICKS.map((i) => labs[i] as Oklab);
    // ΔE OK (the fixture's metric): green–pink 0.309, pink–violet 0.279, green–violet 0.363, so
    // the path drops the green–violet edge and starts at green (palette order first).
    expect(smoothPath(subset, "ok")).toEqual([0, 1, 2]);
    // The metric matters: under CIEDE2000 green–pink is the longest edge (72.6 against 56.4 and
    // 32.8), so the path is green, violet, pink.
    expect(smoothPath(subset, "ciede2000")).toEqual([0, 2, 1]);
  });

  it("the fixture's live stops read green, pink, violet", () => {
    const palette = mockupSwatches();
    const ids = MOCKUP_GRADIENT_PICKS.map((i) => (palette[i] as Swatch).id);
    const t = technique({ kind: "smooth-path", colors: { mode: "picked", count: 3, ids } });
    const stops = buildStops(t, palette);
    const hex = stops.map((s) => {
      const c = s.color;
      if (c.kind !== "swatch") throw new Error("not linked");
      return oklchToHex((palette.find((p) => p.id === c.id) as Swatch).color);
    });
    expect(hex).toEqual(["#1DB07A", "#D4527F", "#5039B0"]);
    expect(stops.map((s) => s.position)).toEqual([0, 0.5, 1]);
  });

  it("32 colors take under 5 ms; the same input gives the same output", () => {
    const labs: Oklab[] = [];
    let x = 7;
    for (let i = 0; i < 32; i++) {
      x = (x * 48271) % 2147483647;
      const r = (x % 1000) / 1000;
      x = (x * 48271) % 2147483647;
      const g = (x % 1000) / 1000;
      x = (x * 48271) % 2147483647;
      labs.push({ l: r, a: (g - 0.5) * 0.4, b: ((x % 1000) / 1000 - 0.5) * 0.4 });
    }
    smoothPath(labs, "ok"); // warm up the JIT
    const t0 = performance.now();
    const a = smoothPath(labs, "ok");
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(5);
    expect(smoothPath(labs, "ok")).toEqual(a);
    expect([...a].sort((p, q) => p - q)).toEqual(labs.map((_, i) => i));
    expect(pathLength(labs, a)).toBeLessThanOrEqual(nearestNeighborBest(labs) + 1e-12);
  });

  it("handles 0, 1 and 2 colors", () => {
    expect(smoothPath([], "ok")).toEqual([]);
    expect(smoothPath(grays([0.5]), "ok")).toEqual([0]);
    expect(smoothPath(grays([0.9, 0.1]), "ok")).toEqual([0, 1]);
  });
});

describe("Most distinct (spec 4.2; plan D14)", () => {
  it("L [0.1, 0.2, 0.5, 0.9], n 3 → 0.1, 0.5, 0.9 in palette order; n ≥ length → all", () => {
    const labs = grays([0.1, 0.2, 0.5, 0.9]);
    expect(mostDistinct(labs, 3, "ok")).toEqual([0, 2, 3]);
    expect(mostDistinct(labs, 4, "ok")).toEqual([0, 1, 2, 3]);
    expect(mostDistinct(labs, 9, "ok")).toEqual([0, 1, 2, 3]);
  });

  it("takes the farthest pair first, then the farthest point, output in palette order", () => {
    // Farthest pair: 0.0 and 1.0 (indexes 3 and 1). Then 0.45 (index 0) beats 0.3 and 0.8.
    const labs = grays([0.45, 1, 0.3, 0, 0.8]);
    expect(mostDistinct(labs, 2, "ok")).toEqual([1, 3]);
    expect(mostDistinct(labs, 3, "ok")).toEqual([0, 1, 3]);
  });

  it("distinctSwatches picks swatches in palette order", () => {
    const sw = graySwatches([0.1, 0.2, 0.5, 0.9]);
    expect(distinctSwatches(sw, 3).map((s) => s.id)).toEqual(["s0", "s2", "s3"]);
  });
});

describe("Constrained random (spec 4.2; plan D15)", () => {
  const neighbors = (order: readonly number[]) =>
    order.slice(1).map((j, k) => [order[k] as number, j] as const);

  it("the same seed gives the same order; seeds 1 and 2 differ on the mockup palette", () => {
    const colors = mockupSwatches().map((s) => s.color);
    const a = constrainedRandom(colors, 1, 0.1, 1, "ok");
    expect(constrainedRandom(colors, 1, 0.1, 1, "ok")).toEqual(a);
    const b = constrainedRandom(colors, 2, 0.1, 1, "ok");
    expect(b.order).not.toEqual(a.order);
    for (const r of [a, b]) expect([...r.order].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("min ΔE OK 0.1 on the mockup palette: every neighbor ΔE ≥ 0.1, and met = true", () => {
    const colors = mockupSwatches().map((s) => s.color);
    const labs = mockupLabs();
    for (let seed = 0; seed < 50; seed++) {
      const r = constrainedRandom(colors, seed, 0.1, 1, "ok");
      expect(r.met).toBe(true);
      for (const [i, j] of neighbors(r.order)) {
        expect(deltaEOK(labs[i] as Oklab, labs[j] as Oklab)).toBeGreaterThanOrEqual(0.1);
      }
    }
  });

  it("the threshold is in ΔE OK units and scales to ΔE00 (10 for 0.1)", () => {
    const colors = mockupSwatches().map((s) => s.color);
    for (let seed = 0; seed < 20; seed++) {
      expect(constrainedRandom(colors, seed, 0.1, 1, "ciede2000").met).toBe(true);
      expect(constrainedRandom(colors, seed, 1, 1, "ciede2000").met).toBe(false);
    }
  });

  it("min ΔE 1.0: met = false, and the order has the largest smallest-neighbor ΔE of the 200 tries", () => {
    const colors = mockupSwatches().map((s) => s.color);
    const labs = mockupLabs();
    const minNeighbor = (order: readonly number[]) =>
      Math.min(...neighbors(order).map(([i, j]) => deltaEOK(labs[i] as Oklab, labs[j] as Oklab)));
    for (const seed of [1, 2, 3]) {
      const r = constrainedRandom(colors, seed, 1.0, 1, "ok");
      expect(r.met).toBe(false);
      // Every one of the 200 tries is a permutation of the palette: the best one can be no
      // better than the best possible order, found here by trying them all.
      const all = permutations([0, 1, 2, 3, 4, 5]);
      const bestPossible = Math.max(...all.map(minNeighbor));
      expect(minNeighbor(r.order)).toBeLessThanOrEqual(bestPossible + 1e-12);
      // And no try of the same seed beats it.
      for (const t of randomTries(colors.length, seed)) {
        expect(minNeighbor(t)).toBeLessThanOrEqual(minNeighbor(r.order) + 1e-12);
      }
      expect(randomTries(colors.length, seed)).toContainEqual(r.order);
    }
  });

  it("min contrast 1.5 is respected when possible", () => {
    const colors = mockupSwatches().map((s) => s.color);
    const hex = colors.map(oklchToHex);
    for (let seed = 0; seed < 50; seed++) {
      const r = constrainedRandom(colors, seed, 0, 1.5, "ok");
      expect(r.met).toBe(true);
      for (const [i, j] of neighbors(r.order)) {
        expect(contrastRatio(hex[i] as string, hex[j] as string)).toBeGreaterThanOrEqual(1.5);
      }
    }
  });

  it("both constraints together hold for every seed tested", () => {
    const colors = mockupSwatches().map((s) => s.color);
    const labs = mockupLabs();
    const hex = colors.map(oklchToHex);
    for (let seed = 0; seed < 50; seed++) {
      const r = constrainedRandom(colors, seed, 0.1, 1.5, "ok");
      expect(r.met).toBe(true);
      for (const [i, j] of neighbors(r.order)) {
        expect(deltaEOK(labs[i] as Oklab, labs[j] as Oklab)).toBeGreaterThanOrEqual(0.1);
        expect(contrastRatio(hex[i] as string, hex[j] as string)).toBeGreaterThanOrEqual(1.5);
      }
    }
  });
});

describe("Population-weighted (spec 4.2; plan D16)", () => {
  it("[0.5, 0.25, 0.25] → [0, 0.6, 1]; all zero → [0, 0.5, 1]; a 0 share counts as 2%", () => {
    expect(populationPositions([0.5, 0.25, 0.25])).toEqual(
      [0, 0.6, 1].map((p) => expect.closeTo(p, 9)),
    );
    expect(populationPositions([0, 0, 0])).toEqual([0, 0.5, 1].map((p) => expect.closeTo(p, 9)));
    // Bands 0.98, 0.02 (the floor), 0.02: centers 0.49, 0.99, 1.01 → 0, 0.5 / 0.52, 1.
    expect(populationPositions([0.98, 0, 0.02])).toEqual(
      [0, 0.5 / 0.52, 1].map((p) => expect.closeTo(p, 9)),
    );
  });

  it("positions rise from 0 to 1 and depend only on the shares' proportions", () => {
    const a = populationPositions([0.2, 0.1, 0.3, 0.4]);
    const b = populationPositions([0.02, 0.01, 0.03, 0.04]);
    expect(a[0]).toBe(0);
    expect(a[3]).toBe(1);
    for (let i = 1; i < a.length; i++) expect(a[i] as number).toBeGreaterThan(a[i - 1] as number);
    for (const [i, p] of b.entries()) expect(p).toBeCloseTo(a[i] as number, 12);
  });

  it("orderedStops places palette-order stops at those positions", () => {
    const sw = graySwatches([0.2, 0.5, 0.8]).map((s, i) => ({
      ...s,
      population: [0.5, 0.25, 0.25][i] as number,
    }));
    const stops = orderedStops(technique({ kind: "population" }), sw);
    expect(stops.map((s) => (s.color.kind === "swatch" ? s.color.id : ""))).toEqual([
      "s0",
      "s1",
      "s2",
    ]);
    expect(stops.map((s) => s.position)).toEqual([0, 0.6, 1].map((p) => expect.closeTo(p, 9)));
  });
});

describe("orderedStops dispatch (plan M4-T4)", () => {
  it("Sorted by lightness and Smooth path link the reordered swatches, evenly spaced", () => {
    const sw = graySwatches([0.7, 0.2, 0.5]);
    const ids = (t: Technique) =>
      orderedStops(t, sw).map((s) => (s.color.kind === "swatch" ? s.color.id : ""));
    expect(ids(technique({ kind: "sorted", sortBy: "lightness" }))).toEqual(["s1", "s2", "s0"]);
    expect(ids(technique({ kind: "smooth-path" }))).toEqual(["s0", "s2", "s1"]);
    expect(orderedStops(technique({ kind: "smooth-path" }), sw).map((s) => s.position)).toEqual([
      0, 0.5, 1,
    ]);
  });

  it("Constrained random uses the technique's seed and constraints", () => {
    const sw = mockupSwatches();
    const ids = (seed: number) =>
      orderedStops(technique({ kind: "random", seed, minDeltaE: 0.1, minContrast: 1 }), sw).map(
        (s) => (s.color.kind === "swatch" ? s.color.id : ""),
      );
    const expected = constrainedRandom(
      sw.map((s) => s.color),
      4,
      0.1,
      1,
      "ok",
    ).order.map((i) => (sw[i] as Swatch).id);
    expect(ids(4)).toEqual(expected);
  });
});

function permutations(xs: readonly number[]): number[][] {
  if (xs.length <= 1) return [[...xs]];
  const out: number[][] = [];
  xs.forEach((x, i) => {
    for (const rest of permutations([...xs.slice(0, i), ...xs.slice(i + 1)]))
      out.push([x, ...rest]);
  });
  return out;
}
