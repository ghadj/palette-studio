/**
 * Easing curves and midpoint hints (spec 4.3; plan D5, D7), to 1e-4.
 *
 * Reference values:
 * - The CSS keyword curves are cubic-bezier(0.42, 0, 1, 1), (0, 0, 0.58, 1) and (0.42, 0, 0.58, 1)
 *   (CSS Easing Functions 1 §2.2). ease-in(0.5) = 0.3153 and ease-out(0.5) = 0.6847 solve the
 *   bezier's x(s) = 0.5 for s, then evaluate y(s).
 * - cubic-bezier(0.25, 0.1, 0.25, 1) is CSS `ease`; ease(0.5) = 0.8024 (the same solve).
 * - smoothstep(t) = 3t² − 2t³, so smoothstep(0.25) = 0.15625.
 * - A color hint (CSS Images 4 §3.5.3 "Color Stop 'Fixup'" and "Coloring the Gradient Line") maps
 *   the fraction p within a segment to p^(ln 0.5 / ln h); with h = 0.25 the exponent is 0.5.
 */
import { describe, expect, it } from "vitest";
import { easingFn, hintWarp } from "../../src/gradient/easing";
import type { Easing, EasingKind } from "../../src/types";

const curve = (kind: EasingKind, bezier: Easing["bezier"] = [0.25, 0.1, 0.25, 1]) =>
  easingFn({ kind, bezier });

/** |got − want| < 1e-4. (`toBeCloseTo(x, 4)` would demand 5e-5, and ease-in(0.5) is 0.315357.) */
const near = (got: number, want: number) => expect(Math.abs(got - want)).toBeLessThan(1e-4);

describe("easingFn (spec 4.3, plan D7)", () => {
  it("ease-in(0.5) = 0.3153; ease-out(0.5) = 0.6847; ease-in-out(0.5) = 0.5", () => {
    near(curve("ease-in")(0.5), 0.3153);
    near(curve("ease-out")(0.5), 0.6847);
    near(curve("ease-in-out")(0.5), 0.5);
  });

  it("cubic-bezier(0.25, 0.1, 0.25, 1)(0.5) = 0.8024", () => {
    near(curve("cubic-bezier", [0.25, 0.1, 0.25, 1])(0.5), 0.8024);
  });

  it("smoothstep(0.25) = 0.15625", () => {
    expect(curve("smoothstep")(0.25)).toBeCloseTo(0.15625, 10);
    expect(curve("smoothstep")(0.5)).toBeCloseTo(0.5, 10);
  });

  it("linear is the identity", () => {
    for (const t of [0, 0.1, 0.37, 0.5, 0.99, 1]) expect(curve("linear")(t)).toBe(t);
  });

  it("endpoints are exact and the keyword curves are monotonic; y outside [0, 1] is allowed", () => {
    const kinds: EasingKind[] = ["linear", "ease-in", "ease-out", "ease-in-out", "smoothstep"];
    for (const kind of kinds) {
      const f = curve(kind);
      expect(f(0), kind).toBe(0);
      expect(f(1), kind).toBe(1);
      let prev = 0;
      for (let i = 1; i <= 1000; i += 1) {
        const y = f(i / 1000);
        expect(y, `${kind} at ${i / 1000}`).toBeGreaterThanOrEqual(prev - 1e-12);
        prev = y;
      }
    }
    // A back-out curve overshoots 1, and a back-in curve dips below 0.
    const overshoot = curve("cubic-bezier", [0.34, 1.56, 0.64, 1]);
    expect(overshoot(0)).toBe(0);
    expect(overshoot(1)).toBe(1);
    expect(Math.max(...Array.from({ length: 101 }, (_, i) => overshoot(i / 100)))).toBeGreaterThan(
      1,
    );
    const undershoot = curve("cubic-bezier", [0.36, -0.6, 0.66, 0]);
    expect(Math.min(...Array.from({ length: 101 }, (_, i) => undershoot(i / 100)))).toBeLessThan(0);
  });

  it("the bezier solver gives y to 1e-6, and to 1e-5 where the curve is flat in x", () => {
    const cases: Easing["bezier"][] = [
      [0, 0, 1, 1],
      [1, 0, 0, 1],
      [0, 1, 1, 0],
      [0.99, 0, 0.01, 1],
      [0.42, 0, 0.58, 1],
      [0.34, 1.56, 0.64, 1],
    ];
    for (const [x1, y1, x2, y2] of cases) {
      const f = curve("cubic-bezier", [x1, y1, x2, y2]);
      const bx = (s: number) => 3 * (1 - s) ** 2 * s * x1 + 3 * (1 - s) * s * s * x2 + s ** 3;
      const dbx = (s: number) =>
        3 * (1 - s) ** 2 * x1 + 6 * (1 - s) * s * (x2 - x1) + 3 * s * s * (1 - x2);
      const by = (s: number) => 3 * (1 - s) ** 2 * s * y1 + 3 * (1 - s) * s * s * y2 + s ** 3;
      // Points on the curve, by its parameter s, so the reference (x(s), y(s)) is exact.
      for (let i = 0; i <= 200; i += 1) {
        const s = i / 200;
        // (1, 0, 0, 1) is flat in x at s = 0.5: x is known only to 2^-52 there, so s is known only to
        // its cube root (about 3e-6), whatever the solver. Elsewhere y must be good to 1e-6.
        const tolerance = dbx(s) > 0.01 ? 1e-6 : 1e-5;
        expect(Math.abs(f(bx(s)) - by(s)), `${[x1, y1, x2, y2]} at s=${s}`).toBeLessThan(tolerance);
      }
    }
  });

  it("clamps t to [0, 1]", () => {
    expect(curve("ease-in")(-0.5)).toBe(0);
    expect(curve("ease-in")(1.5)).toBe(1);
  });
});

describe("hintWarp (spec 4.3, plan D5; CSS Images 4 color hints)", () => {
  it("hintWarp(0.25, 0.25) = 0.5; hintWarp(p, 0.5) = p", () => {
    expect(hintWarp(0.25, 0.25)).toBeCloseTo(0.5, 10);
    for (const p of [0, 0.1, 0.33, 0.5, 0.9, 1]) expect(hintWarp(p, 0.5)).toBe(p);
  });

  it("the hint position maps to 0.5, and the endpoints stay put", () => {
    for (const h of [0.05, 0.3, 0.6, 0.95]) {
      expect(hintWarp(h, h)).toBeCloseTo(0.5, 10);
      expect(hintWarp(0, h)).toBe(0);
      expect(hintWarp(1, h)).toBe(1);
    }
  });

  it("a hint at 0 or 1 makes a hard step, as CSS does", () => {
    expect(hintWarp(0.001, 0)).toBe(1);
    expect(hintWarp(0, 0)).toBe(0);
    expect(hintWarp(0.999, 1)).toBe(0);
    expect(hintWarp(1, 1)).toBe(1);
  });
});
