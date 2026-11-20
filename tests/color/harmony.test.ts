import { describe, expect, it } from "vitest";
import { inGamut } from "../../src/color/gamut";
import { harmonies } from "../../src/color/harmony";

const source = { l: 0.6, c: 0.1, h: 30 };
const hues = (id: string): number[] => {
  const g = harmonies(source).find((x) => x.id === id);
  if (!g) throw new Error(id);
  return g.colors.map((c) => Math.round(c.h));
};

describe("harmonies (plan D5)", () => {
  it("five groups", () => {
    expect(harmonies(source).map((g) => g.id)).toEqual([
      "complementary",
      "split-complementary",
      "triadic",
      "tetradic",
      "analogous",
    ]);
  });
  it("complementary 210", () => expect(hues("complementary")).toEqual([210]));
  it("split-complementary 180 and 240", () =>
    expect(hues("split-complementary")).toEqual([180, 240]));
  it("triadic 150 and 270", () => expect(hues("triadic")).toEqual([150, 270]));
  it("tetradic 120, 210 and 300", () => expect(hues("tetradic")).toEqual([120, 210, 300]));
  it("analogous 0 and 60", () => expect(hues("analogous")).toEqual([0, 60]));
  it("L and C are kept unless gamut-clamped", () => {
    for (const c of harmonies(source).flatMap((g) => g.colors)) {
      expect(c.l).toBeCloseTo(0.6, 10);
      expect(c.c).toBeLessThanOrEqual(0.1 + 1e-12);
      expect(inGamut(c)).toBe(true);
    }
    const kept = harmonies({ l: 0.6, c: 0.02, h: 30 }).flatMap((g) => g.colors);
    for (const c of kept) expect(c.c).toBeCloseTo(0.02, 10);
    for (const c of harmonies({ l: 0.7, c: 0.3, h: 30 }).flatMap((g) => g.colors)) {
      expect(inGamut(c)).toBe(true);
      expect(c.l).toBeCloseTo(0.7, 10);
    }
  });
});
