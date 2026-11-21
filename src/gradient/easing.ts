/**
 * Easing and midpoint hints (spec 4.3; plan D5, D7).
 *
 * - The keyword curves are the CSS ones (CSS Easing Functions 1 §2.2): ease-in is
 *   cubic-bezier(0.42, 0, 1, 1), ease-out (0, 0, 0.58, 1), ease-in-out (0.42, 0, 0.58, 1).
 * - smoothstep is 3t² − 2t³.
 * - A cubic bezier is solved for the curve parameter s with x(s) = t (Newton, then bisection), until s
 *   is known to 1e-10, so y is accurate to well under 1e-6 even where the curve is flat in x. Its x1
 *   and x2 lie within 0 to 1 (D7), which makes x(s) monotonic; values outside are clamped. y1 and y2
 *   are free, so y may leave [0, 1].
 * - A color hint is CSS Images 4's: the fraction p within a segment becomes p^(ln 0.5 / ln h).
 */
import type { Easing } from "../types";

const KEYWORDS = {
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
} as const;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** The CSS cubic-bezier(x1, y1, x2, y2) timing function; t outside [0, 1] is clamped. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const ax1 = clamp01(x1);
  const ax2 = clamp01(x2);
  // Polynomial coefficients: B(s) = ((a·s + b)·s + c)·s, with B(0) = 0 and B(1) = 1.
  const cx = 3 * ax1;
  const bx = 3 * (ax2 - ax1) - cx;
  const axx = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const xAt = (s: number) => ((axx * s + bx) * s + cx) * s;
  const dxAt = (s: number) => (3 * axx * s + 2 * bx) * s + cx;
  const yAt = (s: number) => ((ay * s + by) * s + cy) * s;

  const solve = (t: number): number => {
    // Newton from s = t, accepted only when it lands on x(s) = t to 1e-12.
    let s = t;
    for (let i = 0; i < 8; i += 1) {
      const err = xAt(s) - t;
      if (Math.abs(err) < 1e-12) return s;
      const d = dxAt(s);
      if (Math.abs(d) < 1e-6) break;
      s -= err / d;
      if (s < 0 || s > 1) break;
    }
    // Bisection: x(s) is non-decreasing on [0, 1] because x1 and x2 lie within it.
    let lo = 0;
    let hi = 1;
    while (hi - lo > 1e-10) {
      const mid = (lo + hi) / 2;
      if (xAt(mid) < t) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };

  return (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return yAt(solve(t));
  };
}

const smoothstep = (t: number): number => {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
};

const linear = (t: number): number => clamp01(t);

/** The easing as a function of the fraction `t` within a segment, 0 to 1. f(0) = 0 and f(1) = 1. */
export function easingFn(easing: Easing): (t: number) => number {
  switch (easing.kind) {
    case "linear":
      return linear;
    case "smoothstep":
      return smoothstep;
    case "cubic-bezier": {
      const [x1, y1, x2, y2] = easing.bezier;
      return cubicBezier(x1, y1, x2, y2);
    }
    default: {
      const [x1, y1, x2, y2] = KEYWORDS[easing.kind];
      return cubicBezier(x1, y1, x2, y2);
    }
  }
}

/**
 * Warps `p` so that the midpoint `h` (0 to 1; 0.5 is none) sits at 0.5, as a CSS color hint does
 * (CSS Images 4, "Coloring the Gradient Line"). A hint at 0 or 1 is the limit: a hard step there.
 */
export function hintWarp(p: number, h: number): number {
  const q = clamp01(p);
  if (h === 0.5) return q;
  if (q <= 0) return 0;
  if (q >= 1) return 1;
  if (h <= 0) return 1;
  if (h >= 1) return 0;
  return q ** (Math.log(0.5) / Math.log(h));
}
