import { describe, expect, it } from "vitest";
import { ANGLE_PRESETS, angleFromVector, normalizeAngle } from "../../src/gradient/geometry";

describe("angleFromVector (0 up, clockwise, as in CSS)", () => {
  it("(0, -1) -> 0; (1, 0) -> 90; (0, 1) -> 180; (-1, 0) -> 270", () => {
    expect(angleFromVector(0, -1)).toBeCloseTo(0, 9);
    expect(angleFromVector(1, 0)).toBeCloseTo(90, 9);
    expect(angleFromVector(0, 1)).toBeCloseTo(180, 9);
    expect(angleFromVector(-1, 0)).toBeCloseTo(270, 9);
  });
  it("(1, -1) -> 45", () => {
    expect(angleFromVector(1, -1)).toBeCloseTo(45, 9);
  });
});

describe("normalizeAngle", () => {
  it("normalizeAngle(-30) = 330; normalizeAngle(725) = 5", () => {
    expect(normalizeAngle(-30)).toBe(330);
    expect(normalizeAngle(725)).toBe(5);
    expect(normalizeAngle(360)).toBe(0);
  });
});

describe("ANGLE_PRESETS", () => {
  it("is every 45 degrees", () => {
    expect(ANGLE_PRESETS).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
  });
});
