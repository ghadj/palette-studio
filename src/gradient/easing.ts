/**
 * Easing and midpoint hints (spec 4.3; plan D5, D7). M4-T2 reserves the signatures; M4-T3 builds the
 * bodies and owns this file.
 */
import type { Easing } from "../types";

/** The easing as a function of the fraction `t` within a segment, 0 to 1. Not built yet (M4-T3). */
export function easingFn(_easing: Easing): (t: number) => number {
  throw new Error("not built");
}

/**
 * Warps `p` so that the midpoint `h` (0 to 1; 0.5 is none) sits at 0.5, as a CSS color hint does.
 * Not built yet (M4-T3).
 */
export function hintWarp(_p: number, _h: number): number {
  throw new Error("not built");
}
