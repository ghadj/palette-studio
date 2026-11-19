/**
 * Global adjustments (spec 3.3, 7.5): parameters applied on top of the base swatches, so they stay
 * non-destructive and resettable. Work is in OKLab and OKLCH (spec 2.3). Adjustments run in the
 * table order of 3.3, with Gamut last (plan D2). Locked swatches are never adjusted (spec 3.3)
 * and don't take part in Even out. Pinned swatches are adjusted like any other (spec 3.7, decision 24).
 */
import { type Oklch, oklabToOklch, oklchToOklab } from "../color/convert";
import { clampChroma } from "../color/gamut";
import { DEFAULT_ADJUSTMENTS } from "../state/defaults";
import type { Adjustments, Swatch } from "../types";

/** Fresh identity parameters (a copy, so callers can't mutate the frozen defaults). */
export function resetAdjustments(): Adjustments {
  return {
    ...DEFAULT_ADJUSTMENTS,
    lightnessRange: { ...DEFAULT_ADJUSTMENTS.lightnessRange },
    harmonize: { ...DEFAULT_ADJUSTMENTS.harmonize },
  };
}

/** True when the parameters change no color. */
export function isIdentity(a: Adjustments): boolean {
  const d = DEFAULT_ADJUSTMENTS;
  return (
    a.lightness === d.lightness &&
    a.chroma === d.chroma &&
    a.hue === d.hue &&
    a.contrast === d.contrast &&
    a.temperature === d.temperature &&
    a.tint === d.tint &&
    a.gamma === d.gamma &&
    a.lightnessRange.min === d.lightnessRange.min &&
    a.lightnessRange.max === d.lightnessRange.max &&
    a.evenOut === d.evenOut &&
    a.harmonize.amount === d.harmonize.amount &&
    a.gamut === d.gamut
  );
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const wrapHue = (h: number): number => ((h % 360) + 360) % 360;

/** Signed shortest-arc difference from `from` to `to`, in (−180, 180]. */
function arc(from: number, to: number): number {
  let d = (((to - from) % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

/** Every adjustment except Even out and Gamut, which need the whole palette or a final pass. */
function adjustColor(color: Oklch, a: Adjustments): Oklch {
  let { l, c, h } = color;
  if (a.lightness !== 0) l = clamp01(l + a.lightness);
  if (a.chroma !== 1) c = Math.max(0, c * a.chroma);
  if (a.hue !== 0) h = wrapHue(h + a.hue);
  if (a.contrast !== 1) l = clamp01(0.5 + (l - 0.5) * a.contrast);
  if (a.temperature !== 0 || a.tint !== 0) {
    const lab = oklchToOklab({ l, c, h });
    const shifted = oklabToOklch({ l, a: lab.a + a.tint, b: lab.b + a.temperature });
    c = shifted.c;
    h = shifted.h;
  }
  if (a.gamma !== 1) l = clamp01(l) ** a.gamma;
  const lo = Math.min(a.lightnessRange.min, a.lightnessRange.max);
  const hi = Math.max(a.lightnessRange.min, a.lightnessRange.max);
  if (lo > 0 || hi < 1) l = Math.min(hi, Math.max(lo, l));
  return { l, c, h };
}

/** The adjusted palette shown and exported. Returns `palette` itself when nothing changes. */
export function applyAdjustments(palette: Swatch[], adjustments: Adjustments): Swatch[] {
  if (isIdentity(adjustments)) return palette;
  const colors = palette.map((s) => (s.locked ? s.color : adjustColor(s.color, adjustments)));

  if (adjustments.evenOut) {
    // Equal steps of L between the lowest and highest unlocked L; ties keep palette order.
    const free = palette.map((_, i) => i).filter((i) => !palette[i]?.locked);
    if (free.length > 2) {
      const lightness = (i: number): number => colors[i]?.l ?? 0;
      const ranked = [...free].sort((x, y) => lightness(x) - lightness(y) || x - y);
      const first = lightness(ranked[0] as number);
      const last = lightness(ranked[ranked.length - 1] as number);
      ranked.forEach((index, rank) => {
        const color = colors[index] as Oklch;
        colors[index] = { ...color, l: first + ((last - first) * rank) / (ranked.length - 1) };
      });
    }
  }

  const { anchor, amount } = adjustments.harmonize;
  return palette.map((s, i) => {
    if (s.locked) return s;
    let color = colors[i] as Oklch;
    if (amount !== 0) color = { ...color, h: wrapHue(color.h + amount * arc(color.h, anchor)) };
    if (adjustments.gamut === "srgb") color = clampChroma(color);
    return { ...s, color };
  });
}
