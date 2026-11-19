import { describe, expect, it } from "vitest";
import { hexToOklch, oklchToHex } from "../../src/color/convert";
import { inGamut } from "../../src/color/gamut";
import { RAMP_LABELS, ramp } from "../../src/color/ramps";

const source = hexToOklch("#E8693A");

describe("ramp (plan D4)", () => {
  it("11 steps labelled 50, 100, 200, …, 900, 950", () => {
    expect(RAMP_LABELS).toEqual([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);
    const steps = ramp(source);
    expect(steps).toHaveLength(11);
    expect(steps.map((s) => s.label)).toEqual([...RAMP_LABELS]);
  });

  it("L is 0.97 at 50 and 0.25 at 950, strictly decreasing", () => {
    // A source whose L matches no step exactly, so the target values show through unchanged.
    const steps = ramp({ l: 0.5, c: 0.02, h: 100 });
    const l = steps.map((s) => s.color.l);
    expect(l[0]).toBeCloseTo(0.97, 10);
    expect(l[10]).toBeCloseTo(0.25, 10);
    for (let i = 1; i < l.length; i += 1) expect(l[i]).toBeLessThan(l[i - 1] as number);
  });

  it("#E8693A (L 0.668) sits exactly at step 400 (target L 0.682 is the nearest)", () => {
    const steps = ramp(source);
    const at400 = steps.find((s) => s.label === 400);
    expect(at400?.isSource).toBe(true);
    expect(at400?.color).toEqual(source);
    expect(oklchToHex(at400?.color ?? source)).toBe("#E8693A");
    expect(steps.filter((s) => s.isSource)).toHaveLength(1);
  });

  it("C at 500 equals the source C; C at 50 and 950 is 0.3 × the source C before the gamut clamp", () => {
    const src = { l: 0.2, c: 0.02, h: 200 }; // low chroma: nothing clamps; nearest step is 950
    const steps = ramp(src);
    expect(steps[5]?.color.c).toBeCloseTo(0.02, 10);
    expect(steps[0]?.color.c).toBeCloseTo(0.006, 10);
    expect(steps[9]?.color.c).toBeCloseTo(0.02 * (0.3 + 0.7 * (1 - 0.8 ** 2)), 10);
  });

  it("every step is in gamut", () => {
    for (const s of [source, hexToOklch("#00FF00"), hexToOklch("#0000FF"), hexToOklch("#FF00FF")]) {
      for (const step of ramp(s)) expect(inGamut(step.color)).toBe(true);
    }
  });

  it("H is unchanged", () => {
    for (const step of ramp(source)) expect(step.color.h).toBeCloseTo(source.h, 10);
  });
});
