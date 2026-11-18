import { describe, expect, it } from "vitest";
import { labToRgb, rgbToOklab } from "../../src/color/convert";
import { deltaE } from "../../src/color/delta-e";
import { postprocess } from "../../src/extract/postprocess";

const c = (l: number, a: number, b: number, population: number) => ({
  lab: { l, a, b },
  population,
});

describe("post-processing (spec 2.1 step 7, 2.4, 7.6)", () => {
  it("two swatches 0.02 apart merge into the population-weighted mean", () => {
    const out = postprocess([c(0.5, 0, 0, 0.3), c(0.52, 0, 0, 0.1), c(0.9, 0.1, 0, 0.6)], {
      mergeThreshold: 0.03,
    });
    expect(out).toHaveLength(2);
    const merged = out.find((x) => x.lab.l < 0.6);
    expect(merged?.lab.l).toBeCloseTo((0.5 * 0.3 + 0.52 * 0.1) / 0.4, 12);
    expect(merged?.population).toBeCloseTo(0.4, 12);
  });

  it("0.04 apart stay separate", () => {
    const out = postprocess([c(0.5, 0, 0, 0.5), c(0.54, 0, 0, 0.5)], { mergeThreshold: 0.03 });
    expect(out).toHaveLength(2);
    // A threshold of 0 never merges.
    expect(
      postprocess([c(0.5, 0, 0, 0.5), c(0.5001, 0, 0, 0.5)], { mergeThreshold: 0 }),
    ).toHaveLength(2);
  });

  it("sorted by population, descending", () => {
    const out = postprocess([c(0.1, 0, 0, 0.2), c(0.5, 0, 0, 0.5), c(0.9, 0, 0, 0.3)], {
      mergeThreshold: 0.03,
    });
    expect(out.map((x) => x.population)).toEqual([0.5, 0.3, 0.2]);
  });

  it("populations sum to 1 within 1e-9", () => {
    const out = postprocess(
      [c(0.1, 0, 0, 1), c(0.11, 0, 0, 2), c(0.5, 0.1, 0, 3), c(0.9, 0, 0.1, 4)],
      { mergeThreshold: 0.03 },
    );
    expect(Math.abs(out.reduce((n, x) => n + x.population, 0) - 1)).toBeLessThan(1e-9);
    expect(postprocess([], { mergeThreshold: 0.03 })).toEqual([]);
  });

  it("merges chains closest pair first", () => {
    // 0.02 apart each: a and b merge first (closest), then their mean is 0.025 from c and merges too.
    const out = postprocess([c(0.5, 0, 0, 1), c(0.515, 0, 0, 1), c(0.535, 0, 0, 1)], {
      mergeThreshold: 0.03,
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.lab.l).toBeCloseTo((0.5 + 0.515 + 0.535) / 3, 12);
  });
});

describe("distance metric in post-processing (spec 2.3, 2.4; decision 7)", () => {
  const fromLab = (l: number, a: number, b: number, population: number) => ({
    lab: rgbToOklab(labToRgb({ l, a, b })),
    population,
  });

  it("metric 'ok' behaves exactly as M1", () => {
    const inputs = [
      [c(0.5, 0, 0, 0.3), c(0.52, 0, 0, 0.1), c(0.9, 0.1, 0, 0.6)],
      [c(0.5, 0, 0, 1), c(0.515, 0, 0, 1), c(0.535, 0, 0, 1)],
      [c(0.1, 0, 0, 1), c(0.11, 0, 0, 2), c(0.5, 0.1, 0, 3), c(0.9, 0, 0.1, 4)],
      [c(0.5, 0, 0, 0.5), c(0.54, 0, 0, 0.5)],
    ];
    for (const colors of inputs) {
      for (const mergeThreshold of [0, 0.03, 0.15]) {
        expect(postprocess(colors, { mergeThreshold, metric: "ok" })).toEqual(
          postprocess(colors, { mergeThreshold }),
        );
      }
    }
    // Pinned M1 result for the first input.
    const out = postprocess(inputs[0] ?? [], { mergeThreshold: 0.03, metric: "ok" });
    expect(out.map((x) => x.population)).toEqual([0.6, 0.4]);
    expect(out[1]?.lab.l).toBeCloseTo((0.5 * 0.3 + 0.52 * 0.1) / 0.4, 12);
  });

  it("metric 'ciede2000' with threshold 3.0 merges a pair at ΔE00 2.5 and keeps a pair at 3.5", () => {
    // At a mean CIELAB L of 50, S_L is 1, so a pure lightness step of d gives ΔE00 = d.
    const near = [fromLab(48.75, 0, 0, 0.5), fromLab(51.25, 0, 0, 0.5)] as const;
    const far = [fromLab(48.25, 0, 0, 0.5), fromLab(51.75, 0, 0, 0.5)] as const;
    expect(deltaE("ciede2000", near[0].lab, near[1].lab)).toBeCloseTo(2.5, 6);
    expect(deltaE("ciede2000", far[0].lab, far[1].lab)).toBeCloseTo(3.5, 6);
    expect(postprocess(near, { mergeThreshold: 3, metric: "ciede2000" })).toHaveLength(1);
    expect(postprocess(far, { mergeThreshold: 3, metric: "ciede2000" })).toHaveLength(2);
    // Read as ΔE OK, a threshold of 3.0 would merge everything; the metric decides the units.
    expect(postprocess(far, { mergeThreshold: 3, metric: "ok" })).toHaveLength(1);
  });
});
