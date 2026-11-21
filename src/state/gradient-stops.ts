/**
 * The gradient's stops as computed state (plan M4-T1). Kept apart from `gradient.ts`, whose actions
 * write to the undo history, so that `history.ts` can read the stops without a cycle. Import them
 * from `gradient.ts`, which re-exports them.
 */
import { computed } from "@preact/signals";
import { type ResolvedStop, resolveStops } from "../gradient/model";
import { buildStops } from "../gradient/sources";
import type { GradientStop } from "../types";
import { gradient, outputPalette } from "./signals";

/**
 * The stops in effect (plan Q1a): the stored list once a stop was edited by hand (Custom), else
 * the technique's, rebuilt from the output palette with the locked stops kept (plan D6).
 */
export const effectiveStops = computed<GradientStop[]>(() => {
  const g = gradient.value;
  return g.custom ? g.stops : buildStops(g.technique, outputPalette.value, g.stops);
});

/**
 * The stops as rendered, with colors from the output palette, so adjustments and compare-before
 * flow in, and with reverse and mirror applied (plan D21).
 */
export const resolvedStops = computed<ResolvedStop[]>(() =>
  resolveStops(gradient.value, effectiveStops.value, outputPalette.value),
);
