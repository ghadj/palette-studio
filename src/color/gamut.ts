/**
 * Gamut mapping (spec 3.3 "Gamut", 3.5, 7.9). All gamut checks and clamping live here, so a
 * Display-P3 target can be added later. v1 targets sRGB only.
 */
import { type Oklch, oklabToRgb, oklchToOklab } from "./convert";

/** Channel tolerance: rounding in the OKLab round trip stays well below it. */
const EPSILON = 1e-6;
/** The binary search on chroma stops once the bracket is this narrow (plan D3). */
const CHROMA_STEP = 1e-4;

/** True when the color's sRGB channels all lie within 0 to 1. */
export function inGamut(color: Oklch): boolean {
  const { r, g, b } = oklabToRgb(oklchToOklab(color));
  return [r, g, b].every((v) => v >= -EPSILON && v <= 1 + EPSILON);
}

/**
 * Reduces OKLCH chroma until the color fits sRGB, keeping L and H (plan D3): a binary search on C
 * to 1e-4 that returns the in-gamut end of the bracket. A color already in gamut comes back as is.
 * When even C = 0 doesn't fit (L outside 0 to 1), the result is that gray.
 */
export function clampChroma(color: Oklch): Oklch {
  if (inGamut(color)) return color;
  let low = 0;
  let high = color.c;
  if (!inGamut({ ...color, c: low })) return { ...color, c: 0 };
  while (high - low > CHROMA_STEP) {
    const mid = (low + high) / 2;
    if (inGamut({ ...color, c: mid })) low = mid;
    else high = mid;
  }
  return { ...color, c: low };
}
