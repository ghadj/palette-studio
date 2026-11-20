/**
 * What the gradient preview draws (plan M4-T2; spec 4.4, 4.5). Interim: the CSS is `previewCss`'s
 * plain gradient, there are no baked stops, and `colorAt` is an sRGB lerp. M4-T10 replaces the
 * computed `render` and `colorAt` with the real native and baked paths, keeping their shape.
 */
import { computed } from "@preact/signals";
import { type Oklch, oklabToOklch, oklabToRgb, oklchToOklab, rgbToOklab } from "../color/convert";
import type { BakedStop } from "../gradient/bake";
import { previewCss } from "../gradient/css";
import { resolvedStops } from "./gradient-stops";
import { gradient, gradientPreview } from "./signals";

export interface GradientRender {
  /** The CSS for the main preview; null with no stops. */
  css: string | null;
  /** The CSS for the compare preview in its own space (plan D22); null when compare is off. */
  compareCss: string | null;
  /** Baked stops when the preview can't use native CSS (plan D10); null for native. */
  baked: BakedStop[] | null;
  /** True when interpolation left sRGB, so the Gamut row shows (plan D12). */
  outOfGamut: boolean;
  mode: "native" | "baked";
}

export const render = computed<GradientRender>(() => {
  const stops = resolvedStops.value;
  const g = gradient.value;
  const css = stops.length > 0 ? previewCss(stops, g) : null;
  return {
    css,
    compareCss: gradientPreview.value.compare && css ? css : null,
    baked: null,
    outOfGamut: false,
    mode: "native",
  };
});

/**
 * The gradient's color at `position` (0 to 1) along the resolved stops: what a stop added there
 * takes, so the gradient doesn't change (plan D4). Interim: an sRGB lerp.
 */
export function colorAt(position: number): Oklch {
  const stops = resolvedStops.peek();
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last) return { l: 0.5, c: 0, h: 0 };
  if (position <= first.position) return first.color;
  if (position >= last.position) return last.color;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    if (!a || !b || position > b.position) continue;
    const span = b.position - a.position;
    const t = span > 0 ? (position - a.position) / span : 0;
    const ra = oklabToRgb(oklchToOklab(a.color));
    const rb = oklabToRgb(oklchToOklab(b.color));
    return oklabToOklch(
      rgbToOklab({
        r: ra.r + (rb.r - ra.r) * t,
        g: ra.g + (rb.g - ra.g) * t,
        b: ra.b + (rb.b - ra.b) * t,
      }),
    );
  }
  return last.color;
}
