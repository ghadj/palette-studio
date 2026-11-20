/**
 * Stop sources (spec 4.2; plan M4-T1): turns a technique and the palette into stops. Palette order
 * and the Colors subset (All and Picked) are built here; the other techniques dispatch to
 * `order.ts`, `derive.ts` and `image-sample.ts`.
 */
import type { GradientStop, Swatch, Technique } from "../types";
import { derivedStops } from "./derive";
import { sampledStops } from "./image-sample";
import { MAX_STOPS, swatchStops } from "./model";
import { mostDistinct, orderedStops } from "./order";

/** Generated stops this close to a locked stop are dropped (plan D6). */
export const LOCK_CLEARANCE = 0.01;

/** The swatches the palette-based techniques use (plan Q1b), in palette order. */
export function techniqueSwatches(technique: Technique, palette: readonly Swatch[]): Swatch[] {
  const { mode, count, ids } = technique.colors;
  if (mode === "distinct") return mostDistinct(palette, count);
  if (mode === "picked") {
    const picked = palette.filter((s) => ids.includes(s.id));
    // Nothing picked, or the picks are gone: the whole palette.
    return picked.length > 0 ? picked : [...palette];
  }
  return [...palette];
}

function generate(technique: Technique, palette: readonly Swatch[]): GradientStop[] {
  const swatches = techniqueSwatches(technique, palette);
  switch (technique.kind) {
    case "palette-order":
      return swatchStops(swatches);
    case "derived":
      return derivedStops(technique, palette);
    case "image-sample":
      return sampledStops(technique, palette);
    case "sorted":
    case "smooth-path":
    case "random":
    case "population":
      return orderedStops(technique, swatches);
  }
}

/**
 * The stops of a technique over the (output) palette. Locked stops are kept at their position and
 * color, and generated stops within 1% of one are dropped (plan D6). At most 32 stops.
 */
export function buildStops(
  technique: Technique,
  outputPalette: readonly Swatch[],
  lockedStops: readonly GradientStop[] = [],
): GradientStop[] {
  const generated = generate(technique, outputPalette);
  if (lockedStops.length === 0) return generated.slice(0, MAX_STOPS);
  const kept = generated.filter(
    (g) => !lockedStops.some((l) => Math.abs(l.position - g.position) < LOCK_CLEARANCE),
  );
  const merged = [...kept, ...lockedStops].sort((a, b) => a.position - b.position);
  return merged.slice(0, MAX_STOPS);
}
