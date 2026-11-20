/**
 * CSS for a gradient (spec 4.5). M4-T2 gives `previewCss` an interim body, a plain gradient of the
 * stops as sRGB HEX with no `in <space>` clause, so the app looks right while the engines are built.
 * M4-T10 replaces it, keeping the signature, and builds `nativeCss` (path 1) and `bakedCss`
 * (path 2), which M5's export uses.
 */
import { oklchToHex } from "../color/convert";
import type { Gradient, InterpolationSpace } from "../types";
import type { BakedStop } from "./bake";
import type { ResolvedStop } from "./model";

const byte = (alpha: number): string =>
  Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();

/** `#RRGGBB`, or `#RRGGBBAA` when the stop is not opaque (plan D8). */
export function stopHex(stop: Pick<ResolvedStop, "color" | "alpha">): string {
  const hex = oklchToHex(stop.color);
  return stop.alpha >= 1 ? hex : `${hex}${byte(stop.alpha)}`;
}

const pct = (n: number): string => `${Math.round(n * 1000) / 10}%`;

/** The color stops of a CSS gradient: `#RRGGBB 0%, #RRGGBB 50%, ...`. */
export function stopList(stops: readonly ResolvedStop[]): string {
  return stops.map((s) => `${stopHex(s)} ${pct(s.position)}`).join(", ");
}

/** The CSS the preview shows. Interim: sRGB stops, no midpoints, no easing. */
export function previewCss(stops: readonly ResolvedStop[], gradient: Gradient): string {
  const list = stopList(stops);
  const { geometry } = gradient;
  const at = `${pct(geometry.center.x)} ${pct(geometry.center.y)}`;
  switch (gradient.type) {
    case "linear":
      return `linear-gradient(${geometry.angle}deg, ${list})`;
    case "radial":
      return `radial-gradient(${geometry.shape} ${geometry.size} at ${at}, ${list})`;
    case "conic":
      return `conic-gradient(from ${geometry.from}deg at ${at}, ${list})`;
  }
}

/**
 * The gradient as native CSS with an `in <space>` clause (spec 4.5 path 1); `space` overrides the
 * gradient's own, for compare mode. Not built yet (M4-T10).
 */
export function nativeCss(
  _stops: readonly ResolvedStop[],
  _gradient: Gradient,
  _space?: InterpolationSpace,
): string {
  throw new Error("not built");
}

/** The gradient as plain CSS from baked stops (spec 4.5 path 2). Not built yet (M4-T10). */
export function bakedCss(_baked: readonly BakedStop[], _gradient: Gradient): string {
  throw new Error("not built");
}
