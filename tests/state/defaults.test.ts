import { describe, expect, it } from "vitest";
import { clampColors, DEFAULT_SETTINGS, MAX_COLORS, MIN_COLORS } from "../../src/state/defaults";

describe("palette size (decision 13: 2 to 12, departing from spec 2.4's 32)", () => {
  it("runs from 2 to 12", () => {
    expect([MIN_COLORS, MAX_COLORS]).toEqual([2, 12]);
    expect(DEFAULT_SETTINGS.colors).toBe(6);
  });

  it("clamps and rounds any value into range", () => {
    expect(clampColors(32)).toBe(12);
    expect(clampColors(13)).toBe(12);
    expect(clampColors(12)).toBe(12);
    expect(clampColors(1)).toBe(2);
    expect(clampColors(-5)).toBe(2);
    expect(clampColors(6.4)).toBe(6);
    expect(clampColors(Number.NaN)).toBe(6);
    expect(clampColors(Number.POSITIVE_INFINITY)).toBe(6);
  });
});
