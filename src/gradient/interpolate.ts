/**
 * Interpolation in ten spaces (spec 4.3; plan D8, D11, D12): mixing two stop colors with a hue
 * method and premultiplied alpha. M4-T2 reserves the signature; M4-T3 builds the body and owns this
 * file. Gamut handling is not here: `mix` returns OKLab so that mapping to sRGB happens in one place
 * (M4-T10's bake).
 */
import type { Oklab } from "../color/convert";
import type { HueMethod, InterpolationSpace, Oklch } from "../types";

/** A stop color with its alpha, 0 to 1. */
export interface OklchAlpha {
  color: Oklch;
  alpha: number;
}

/** The mixed color, in OKLab, with its alpha. */
export interface OklabAlpha {
  color: Oklab;
  alpha: number;
}

export interface MixOptions {
  space: InterpolationSpace;
  hue: HueMethod;
  premultiplied: boolean;
}

/** The color a fraction `t` of the way from `a` to `b` (0 to 1). Not built yet (M4-T3). */
export function mix(_a: OklchAlpha, _b: OklchAlpha, _t: number, _options: MixOptions): OklabAlpha {
  throw new Error("not built");
}
