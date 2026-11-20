/**
 * What the gradient preview draws (spec 4.4, 4.5; plan M4-T10, D10, D12).
 *
 * - `render.css`: native CSS with the `in <space>` clause where the browser supports it, else CSS
 *   from the baked stops; also baked when premultiplied alpha is off and a stop has alpha (D10).
 * - `render.barCss`: the same gradient as a left-to-right linear one, for the stop bar (D27).
 * - `render.baked` and `render.outOfGamut`: the gradient is always baked, because the Gamut row
 *   (D12), the vision simulation (M4-T12) and the text check (M4-T13) read the baked stops, whatever
 *   the preview draws.
 *
 * The bake is kept while its inputs are unchanged, so a geometry drag (angle, center) doesn't bake
 * again on every frame (spec 7.7, 60 fps).
 */
import { computed } from "@preact/signals";
import { type Oklch, oklabToOklch, rgbToOklab } from "../color/convert";
import { type BakedStop, type BakeResult, bake, mappedAt } from "../gradient/bake";
import { bakedCss, nativeCss, previewMode } from "../gradient/css";
import type { ResolvedStop } from "../gradient/model";
import type { Gradient } from "../types";
import { resolvedStops } from "./gradient-stops";
import { gradient } from "./signals";

export interface GradientRender {
  /** The CSS for the main preview; null with no stops. */
  css: string | null;
  /** The same gradient, linear at 90°, for the stop bar (plan D27); null with no stops. */
  barCss: string | null;
  /** The baked stops (always computed, see the file comment); null with no stops. */
  baked: BakedStop[] | null;
  /** True when interpolation left sRGB, so the Gamut row shows (plan D12). */
  outOfGamut: boolean;
  mode: "native" | "baked";
}

/** Everything the bake reads, as a string, to tell when a bake can be reused. */
function bakeKey(stops: readonly ResolvedStop[], g: Gradient): string {
  const e = g.easing;
  const head = `${g.space}|${g.hue}|${g.premultiplied}|${g.gamut}|${e.kind}|${e.kind === "cubic-bezier" ? e.bezier.join(",") : ""}`;
  return `${head}|${stops.map((s) => `${s.position},${s.color.l},${s.color.c},${s.color.h},${s.alpha},${s.hint}`).join(";")}`;
}

/** A bake that is reused while its key is unchanged. */
function memoBake(): (stops: readonly ResolvedStop[], g: Gradient) => BakeResult {
  let key = "";
  let result: BakeResult = { stops: [], outOfGamut: false };
  return (stops, g) => {
    const next = bakeKey(stops, g);
    if (next !== key) {
      result = bake(stops, g);
      key = next;
    }
    return result;
  };
}
const bakeMain = memoBake();

/** The bar's gradient: linear, left to right along the stop axis (plan D27). */
const barGradient = (g: Gradient): Gradient => ({
  ...g,
  type: "linear",
  geometry: { ...g.geometry, angle: 90 },
});

const main = computed(() => {
  const stops = resolvedStops.value;
  const g = gradient.value;
  if (stops.length === 0) return null;
  const baked = bakeMain(stops, g);
  const mode = previewMode(stops, g);
  const bar = barGradient(g);
  return {
    css: mode === "native" ? nativeCss(stops, g) : bakedCss(baked.stops, g),
    barCss: mode === "native" ? nativeCss(stops, bar) : bakedCss(baked.stops, bar),
    baked: baked.stops,
    outOfGamut: baked.outOfGamut,
    mode,
  };
});

export const render = computed<GradientRender>(() => {
  const m = main.value;
  if (!m) {
    return {
      css: null,
      barCss: null,
      baked: null,
      outOfGamut: false,
      mode: "native",
    };
  }
  return m;
});

/**
 * The gradient's color at `position` (0 to 1) along the resolved stops, as the preview shows it
 * (interpolated, eased and gamut-mapped): what a stop added there takes, so the gradient doesn't
 * change (plan D4).
 */
export function colorAt(position: number): Oklch {
  const stops = resolvedStops.peek();
  if (stops.length === 0) return { l: 0.5, c: 0, h: 0 };
  return oklabToOklch(rgbToOklab(mappedAt(stops, position, gradient.peek()).rgb));
}
