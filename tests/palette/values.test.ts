/**
 * Close in value (spec 3.8, plan D19): swatch pairs whose OKLab L differs by less than the
 * threshold. Reference values from `docs/design/mockup-state.md` ("Expected image views").
 */
import { describe, expect, it } from "vitest";
import { hexToOklch } from "../../src/color/convert";
import {
  CLOSE_IN_VALUE_MAX,
  CLOSE_IN_VALUE_MIN,
  clampCloseInValue,
  closeInValue,
} from "../../src/palette/values";

const MOCKUP = ["#E8693A", "#1DB07A", "#14386B", "#D4527F", "#1E8A2E", "#5039B0"];
const fixture = MOCKUP.map((hex) => ({ color: hexToOklch(hex) }));
const withL = (...ls: number[]) => ls.map((l) => ({ color: { l, c: 0, h: 0 } }));

describe("close in value (spec 3.8)", () => {
  it("the fixture at 0.03 flags exactly swatches 1 and 2 (ΔL 0.004)", () => {
    const pairs = closeInValue(fixture, 0.03);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ first: 0, second: 1 });
    expect(pairs[0]?.deltaL).toBeCloseTo(0.004, 3);
  });

  it("1 and 4 (ΔL 0.046) aren't flagged", () => {
    const pairs = closeInValue(fixture, 0.03);
    expect(pairs.some((p) => p.first === 0 && p.second === 3)).toBe(false);
    // The doc's 0.046 is the difference of its 3-decimal L values (0.668 − 0.622).
    const deltaL = Math.abs((fixture[0]?.color.l ?? 0) - (fixture[3]?.color.l ?? 0));
    expect(Math.abs(deltaL - 0.046)).toBeLessThan(0.001);
    // At 0.05 they are.
    expect(closeInValue(fixture, 0.05).some((p) => p.first === 0 && p.second === 3)).toBe(true);
  });

  it("the threshold clamps to 0.01 to 0.10", () => {
    expect(CLOSE_IN_VALUE_MIN).toBe(0.01);
    expect(CLOSE_IN_VALUE_MAX).toBe(0.1);
    expect(clampCloseInValue(0)).toBe(0.01);
    expect(clampCloseInValue(0.5)).toBe(0.1);
    expect(clampCloseInValue(0.03)).toBe(0.03);
    // Below the minimum, 0.01 still applies: ΔL 0.005 is flagged.
    expect(closeInValue(withL(0.5, 0.505), 0)).toHaveLength(1);
    // Above the maximum, 0.10 applies: ΔL 0.09 is flagged, ΔL 0.11 isn't.
    expect(closeInValue(withL(0.5, 0.59), 1)).toHaveLength(1);
    expect(closeInValue(withL(0.5, 0.61), 1)).toHaveLength(0);
  });

  it("the difference must be less than the threshold, and pairs are in palette order", () => {
    expect(closeInValue(withL(0.5, 0.25, 0.52, 0.26), 0.03)).toEqual([
      { first: 0, second: 2, deltaL: expect.closeTo(0.02, 9) },
      { first: 1, second: 3, deltaL: expect.closeTo(0.01, 9) },
    ]);
    // Exactly at the threshold (both exact in binary) is not "less than".
    expect(closeInValue(withL(0.5, 0.5625), 0.0625)).toEqual([]);
  });
});
