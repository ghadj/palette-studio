/**
 * Interpolation in ten spaces (spec 4.3, 7.6 "Bake"; plan D8, D11): mixing two stop colors with a hue
 * method and premultiplied alpha, as CSS Color 4 §12 "Interpolation" does:
 * 1. Convert both colors to the interpolation space (`spaces.ts`). A powerless hue is missing.
 * 2. A missing hue takes the other color's hue (§12.2, "carried forward"); if both are missing, both
 *    are 0.
 * 3. Fix up the hues for the hue method (§12.4): shorter, longer, increasing or decreasing.
 * 4. With premultiplied alpha, multiply every coordinate except the hue by alpha (§12.3), interpolate
 *    linearly, then divide by the interpolated alpha. A result with alpha 0 has no color to recover,
 *    so it falls back to the straight mix.
 *
 * Gamut handling is not here: `mix` returns OKLab, so that mapping to sRGB happens in one place
 * (M4-T10's bake).
 */
import type { Oklab } from "../color/convert";
import type { HueMethod, InterpolationSpace, Oklch } from "../types";
import { fromSpace, hueIndex, toSpace } from "./spaces";

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

const wrap = (h: number): number => ((h % 360) + 360) % 360;

/**
 * The two hues after the fixup for `method` (CSS Color 4 §12.4), both first wrapped to [0, 360).
 * Interpolating the returned pair linearly gives the hue arc the method asks for.
 */
export function fixHues(h1: number, h2: number, method: HueMethod): [number, number] {
  let a = wrap(h1);
  let b = wrap(h2);
  const d = b - a;
  switch (method) {
    case "shorter":
      if (d > 180) a += 360;
      else if (d < -180) b += 360;
      break;
    case "longer":
      if (d > 0 && d < 180) a += 360;
      else if (d > -180 && d <= 0) b += 360;
      break;
    case "increasing":
      if (b < a) b += 360;
      break;
    case "decreasing":
      if (a < b) a += 360;
      break;
  }
  return [a, b];
}

/**
 * A function of `t` (0 to 1) that mixes `a` and `b`. The conversions to the interpolation space happen
 * once, so callers that sample a segment many times (the bake) should prefer it to `mix`.
 */
export function mixer(
  a: OklchAlpha,
  b: OklchAlpha,
  options: MixOptions,
): (t: number) => OklabAlpha {
  const { space, premultiplied } = options;
  const hi = hueIndex(space);
  const ca = toSpace(a.color, space);
  const cb = toSpace(b.color, space);
  const pa = [...ca.coords];
  const pb = [...cb.coords];

  if (hi >= 0) {
    // A missing hue takes the other color's (CSS Color 4 §12.2); two missing hues stay 0.
    if (ca.hueMissing && !cb.hueMissing) pa[hi] = pb[hi] ?? 0;
    if (cb.hueMissing && !ca.hueMissing) pb[hi] = pa[hi] ?? 0;
    const [h1, h2] = fixHues(pa[hi] ?? 0, pb[hi] ?? 0, options.hue);
    pa[hi] = h1;
    pb[hi] = h2;
  }

  // Premultiplied copies of every coordinate but the hue (CSS Color 4 §12.3).
  const ma = pa.map((v, i) => (i === hi ? v : v * a.alpha));
  const mb = pb.map((v, i) => (i === hi ? v : v * b.alpha));

  return (t: number): OklabAlpha => {
    const alpha = a.alpha + (b.alpha - a.alpha) * t;
    const usePremultiplied = premultiplied && alpha > 0;
    const coords = [0, 1, 2].map((i) => {
      if (usePremultiplied && i !== hi) {
        const va = ma[i] ?? 0;
        return (va + ((mb[i] ?? 0) - va) * t) / alpha;
      }
      const va = pa[i] ?? 0;
      return va + ((pb[i] ?? 0) - va) * t;
    }) as [number, number, number];
    return { color: fromSpace(coords, space), alpha };
  };
}

/** The color a fraction `t` of the way from `a` to `b` (0 to 1), in OKLab with its alpha. */
export function mix(a: OklchAlpha, b: OklchAlpha, t: number, options: MixOptions): OklabAlpha {
  return mixer(a, b, options)(t);
}
