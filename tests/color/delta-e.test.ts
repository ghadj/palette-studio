import { describe, expect, it } from "vitest";
import { deltaEOK } from "../../src/color/delta-e";

describe("ΔE OK (spec 2.3)", () => {
  it("ΔE OK of (0.50, 0, 0) and (0.52, 0, 0) is 0.02; zero for identical colors; symmetric", () => {
    const a = { l: 0.5, a: 0, b: 0 };
    const b = { l: 0.52, a: 0, b: 0 };
    expect(deltaEOK(a, b)).toBeCloseTo(0.02, 12);
    expect(deltaEOK(a, a)).toBe(0);
    const c = { l: 0.6, a: 0.1, b: -0.05 };
    const d = { l: 0.4, a: -0.02, b: 0.07 };
    expect(deltaEOK(c, d)).toBe(deltaEOK(d, c));
    expect(deltaEOK(c, d)).toBeCloseTo(Math.hypot(0.2, 0.12, 0.12), 12);
  });
});
