import { describe, expect, it } from "vitest";
import { LOUPE_SIZE, loupePosition } from "../../src/ui/Loupe";

describe("loupePosition (spec 3.7)", () => {
  const well = { width: 600, height: 400 };

  it("sits above the point on touch", () => {
    const { left, top } = loupePosition({ x: 300, y: 300 }, well, true);
    expect(left).toBe(300 - LOUPE_SIZE / 2);
    expect(top).toBeLessThan(300 - LOUPE_SIZE);
  });

  it("sits beside the pointer with a mouse", () => {
    const { left } = loupePosition({ x: 100, y: 200 }, well, false);
    expect(left).toBeGreaterThan(100);
  });

  it("flips below on touch near the top, and to the left of a mouse near the right edge", () => {
    expect(loupePosition({ x: 300, y: 20 }, well, true).top).toBeGreaterThan(20);
    expect(loupePosition({ x: 590, y: 200 }, well, false).left + LOUPE_SIZE).toBeLessThan(590);
  });

  it("stays inside the well", () => {
    const { left, top } = loupePosition({ x: 0, y: 0 }, { width: 300, height: 200 }, true);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(top).toBeGreaterThanOrEqual(0);
  });
});
