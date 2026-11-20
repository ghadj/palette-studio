/**
 * Baked stops (spec 4.5 path 2, 7.6 "Bake"; plan D8): the gradient sampled into plain sRGB stops
 * that look the same in any renderer. M4-T2 reserves the signatures; M4-T10 builds the bodies and
 * owns this file. M5's exporters call `bake` too.
 */
import type { Oklab } from "../color/convert";
import type { Gradient } from "../types";
import type { ResolvedStop } from "./model";

/** A baked stop: a position (0 to 1), an 8-bit `#RRGGBB` and an alpha (0 to 1). */
export interface BakedStop {
  position: number;
  hex: string;
  alpha: number;
}

export interface BakeResult {
  stops: BakedStop[];
  /** True when interpolation left sRGB and a color had to be mapped (plan D12). */
  outOfGamut: boolean;
}

/**
 * The gradient's color at `t` (0 to 1) between its resolved stops, before gamut mapping: hint warp,
 * easing, interpolation. Not built yet (M4-T10).
 */
export function sampleAt(
  _resolved: readonly ResolvedStop[],
  _t: number,
  _gradient: Gradient,
): { color: Oklab; alpha: number } {
  throw new Error("not built");
}

/**
 * Samples the gradient into 16 to 64 stops by adaptive subdivision, with gamut mapping and sRGB
 * conversion. Not built yet (M4-T10).
 */
export function bake(_resolved: readonly ResolvedStop[], _gradient: Gradient): BakeResult {
  throw new Error("not built");
}
