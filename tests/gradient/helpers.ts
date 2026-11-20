/** Shared builders for the gradient engine tests (M4-T10). */
import { hexToOklch } from "../../src/color/convert";
import type { ResolvedStop } from "../../src/gradient/model";
import { DEFAULT_GRADIENT } from "../../src/state/defaults";
import type { Gradient } from "../../src/types";

/** A resolved stop from a HEX color, a position (0 to 1) and optional alpha and hint. */
export function rs(hex: string, position: number, extra: Partial<ResolvedStop> = {}): ResolvedStop {
  return {
    id: `${hex}@${position}`,
    position,
    color: hexToOklch(hex),
    alpha: 1,
    hint: 0.5,
    link: "value",
    ...extra,
  };
}

/** The default gradient (plan D2) with a patch; geometry and easing patches merge. */
export function grad(
  patch: Partial<Omit<Gradient, "geometry" | "easing">> & {
    geometry?: Partial<Gradient["geometry"]>;
    easing?: Partial<Gradient["easing"]>;
  } = {},
): Gradient {
  const { geometry, easing, ...rest } = patch;
  return {
    ...DEFAULT_GRADIENT,
    ...rest,
    geometry: { ...DEFAULT_GRADIENT.geometry, ...geometry },
    easing: { ...DEFAULT_GRADIENT.easing, ...easing },
  };
}

/** The mockup fixture's resolved stops (mockup-state "Gradient"). */
export const FIXTURE = (): ResolvedStop[] => [
  rs("#1DB07A", 0),
  rs("#D4527F", 0.5),
  rs("#5039B0", 1),
];

/** Parses `#RRGGBB[AA]` into sRGB 0..1 channels and alpha. */
export function parseHex8(hex: string): { r: number; g: number; b: number; alpha: number } {
  const n = (i: number) => Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  return { r: n(0), g: n(1), b: n(2), alpha: hex.length > 7 ? n(3) : 1 };
}
