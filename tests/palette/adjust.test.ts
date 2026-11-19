import { describe, expect, it } from "vitest";
import { type Oklch, oklchToOklab } from "../../src/color/convert";
import { inGamut } from "../../src/color/gamut";
import { applyAdjustments, isIdentity, resetAdjustments } from "../../src/palette/adjust";
import { DEFAULT_ADJUSTMENTS } from "../../src/state/defaults";
import type { Adjustments, Swatch } from "../../src/types";

const sw = (l: number, c: number, h: number, locked = false, id = `s${l}-${c}-${h}`): Swatch => ({
  id,
  color: { l, c, h },
  alpha: 1,
  name: "",
  locked,
  pinned: false,
  origin: "extracted",
  population: 0.1,
  point: null,
  sampleRadius: "auto",
  sampleStat: "mean",
  extracted: null,
});
const adj = (patch: Partial<Adjustments>): Adjustments => ({ ...resetAdjustments(), ...patch });
const run = (s: Swatch[], patch: Partial<Adjustments>): Oklch[] =>
  applyAdjustments(s, adj(patch)).map((x) => x.color);
const first = (s: Swatch[], patch: Partial<Adjustments>): Oklch => run(s, patch)[0] as Oklch;

describe("global adjustments (spec 3.3; plan D1, D2)", () => {
  it("identity parameters return equal colors", () => {
    const s = [sw(0.5, 0.1, 40), sw(0.3, 0.05, 350)];
    expect(applyAdjustments(s, adj({})).map((x) => x.color)).toEqual(s.map((x) => x.color));
    expect(isIdentity(DEFAULT_ADJUSTMENTS)).toBe(true);
    expect(isIdentity(adj({ hue: 1 }))).toBe(false);
  });

  it("Lightness +0.1: L 0.5 → 0.6; clamps at 1", () => {
    expect(first([sw(0.5, 0.1, 40)], { lightness: 0.1 }).l).toBeCloseTo(0.6, 9);
    expect(first([sw(0.95, 0.01, 40)], { lightness: 0.1 }).l).toBe(1);
  });

  it("Chroma 150%: C 0.1 → 0.15", () => {
    expect(first([sw(0.5, 0.1, 40)], { chroma: 1.5 }).c).toBeCloseTo(0.15, 9);
  });

  it("Hue +30: H 350 → 20", () => {
    expect(first([sw(0.5, 0.1, 350)], { hue: 30 }).h).toBeCloseTo(20, 9);
  });

  it("Contrast 120%: L 0.3 → 0.26", () => {
    expect(first([sw(0.3, 0.1, 40)], { contrast: 1.2 }).l).toBeCloseTo(0.26, 9);
  });

  it("Temperature +0.02 adds 0.02 to OKLab b; Tint +0.02 adds 0.02 to a", () => {
    const base = oklchToOklab({ l: 0.6, c: 0.1, h: 100 });
    const warm = oklchToOklab(first([sw(0.6, 0.1, 100)], { temperature: 0.02 }));
    expect(warm.b).toBeCloseTo(base.b + 0.02, 9);
    expect(warm.a).toBeCloseTo(base.a, 9);
    const tint = oklchToOklab(first([sw(0.6, 0.1, 100)], { tint: 0.02 }));
    expect(tint.a).toBeCloseTo(base.a + 0.02, 9);
    expect(tint.b).toBeCloseTo(base.b, 9);
  });

  it("Gamma 2: L 0.5 → 0.25", () => {
    expect(first([sw(0.5, 0.1, 40)], { gamma: 2 }).l).toBeCloseTo(0.25, 9);
  });

  it("Lightness range 0.2 to 0.8: 0.1 → 0.2 and 0.9 → 0.8", () => {
    const out = run([sw(0.1, 0.01, 40), sw(0.9, 0.01, 40)], {
      lightnessRange: { min: 0.2, max: 0.8 },
    });
    expect(out.map((c) => c.l)).toEqual([0.2, 0.8]);
  });

  it("Even out: L [0.2, 0.3, 0.8] → [0.2, 0.5, 0.8], order kept", () => {
    const out = run([sw(0.2, 0.05, 10), sw(0.3, 0.05, 20), sw(0.8, 0.05, 30)], { evenOut: true });
    expect(out.map((c) => c.l)).toEqual([0.2, 0.5, 0.8]);
    expect(out.map((c) => c.h)).toEqual([10, 20, 30]);
    const shuffled = run([sw(0.8, 0.05, 30), sw(0.2, 0.05, 10), sw(0.3, 0.05, 20)], {
      evenOut: true,
    });
    expect(shuffled.map((c) => c.l)).toEqual([0.8, 0.2, 0.5]);
  });

  it("Harmonize anchor 0°, 50%: H 60 → 30. Anchor 10°, 50%: H 350 → 0 (shorter arc)", () => {
    expect(first([sw(0.5, 0.1, 60)], { harmonize: { anchor: 0, amount: 0.5 } }).h).toBeCloseTo(
      30,
      9,
    );
    const h = first([sw(0.5, 0.1, 350)], { harmonize: { anchor: 10, amount: 0.5 } }).h;
    expect(Math.min(h, 360 - h)).toBeCloseTo(0, 9);
  });

  it("Gamut clamp makes oklch(0.7 0.3 150) in gamut with L and H kept", () => {
    const s = [sw(0.7, 0.3, 150)];
    expect(inGamut({ l: 0.7, c: 0.3, h: 150 })).toBe(false);
    const out = first(s, { gamut: "srgb" });
    expect(inGamut(out)).toBe(true);
    expect(out.l).toBe(0.7);
    expect(out.h).toBe(150);
    expect(out.c).toBeLessThan(0.3);
    expect(first(s, { gamut: "off" }).c).toBe(0.3);
  });

  it("locked swatches are unchanged and skipped by Even out (spec 3.3)", () => {
    const locked = sw(0.4, 0.3, 150, true, "locked");
    const out = applyAdjustments(
      [locked, sw(0.2, 0.05, 10), sw(0.9, 0.05, 20)],
      adj({ lightness: 0.1, chroma: 2, gamut: "srgb", evenOut: true }),
    );
    expect(out[0]).toBe(locked);
    expect(out[1]?.color.l).not.toBe(0.2);
  });

  it("pinned swatches are adjusted like any other (spec 3.7, decision 24)", () => {
    const pinned = { ...sw(0.4, 0.1, 150, false, "pinned"), pinned: true };
    const out = applyAdjustments([pinned], adj({ lightness: 0.1 }));
    expect(out[0]?.color.l).toBeCloseTo(0.5, 9);
    expect(out[0]?.pinned).toBe(true);
  });

  it("applies in table order: Lightness before Gamma", () => {
    // (0.5 + 0.1)^2 = 0.36, not 0.5^2 + 0.1
    expect(first([sw(0.5, 0.1, 40)], { lightness: 0.1, gamma: 2 }).l).toBeCloseTo(0.36, 9);
  });

  it("resetAdjustments returns fresh identity parameters", () => {
    const a = resetAdjustments();
    expect(a).toEqual(DEFAULT_ADJUSTMENTS);
    expect(a).not.toBe(DEFAULT_ADJUSTMENTS);
    expect(a.lightnessRange).not.toBe(DEFAULT_ADJUSTMENTS.lightnessRange);
  });
});
