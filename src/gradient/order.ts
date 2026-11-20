/**
 * Ordering techniques and the "Most distinct" subset (spec 4.2, 7.6 "Smooth-path ordering"; plan
 * D13 to D16). M4-T1 reserves the two functions `sources.ts` calls, with a fallback that keeps
 * palette order; M4-T4 replaces their bodies, builds `sortSwatches`, `smoothPath`, `mostDistinct`,
 * `constrainedRandom` and `populationPositions` under them, and owns this file. `sources.ts` is
 * shared: keep these two signatures.
 */
import type { GradientStop, Swatch, Technique } from "../types";
import { swatchStops } from "./model";

/**
 * Stops for the Sorted, Smooth path, Constrained random and Population-weighted techniques over
 * `swatches` (the Colors subset, in palette order). Fallback: palette order, evenly spaced.
 */
export function orderedStops(_technique: Technique, swatches: readonly Swatch[]): GradientStop[] {
  return swatchStops(swatches);
}

/**
 * The `count` most distinct swatches (plan D14), in palette order. Fallback: the first `count`.
 */
export function distinctSwatches(swatches: readonly Swatch[], count: number): Swatch[] {
  return swatches.slice(0, Math.max(1, count));
}
