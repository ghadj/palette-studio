/**
 * Gradient actions (plan M4-T1; spec 4.3, 3.6). Each action that changes the gradient is one undo
 * step; callers that drag wrap the moves in `history.begin` and `history.end`. Selecting a stop is
 * view state and records nothing.
 */
import { materialize } from "../gradient/model";
import type { Gradient, GradientStop, Technique } from "../types";
import { effectiveStops } from "./gradient-stops";
import { commit } from "./history";
import { gradient, selectedStopId } from "./signals";

export { effectiveStops, resolvedStops } from "./gradient-stops";

/**
 * Edits the stops by hand: the stops in effect go to `fn`, and whatever it returns is stored, with
 * Custom set (plan Q1a). Returning the same list changes nothing.
 */
export function editStops(fn: (stops: GradientStop[]) => GradientStop[], label: string): void {
  const current = effectiveStops.peek();
  const next = fn(current);
  if (next === current) return;
  gradient.value = materialize(gradient.peek(), next);
  commit(label);
}

/** Changes gradient settings other than the stops, such as the type or the angle. */
export function setGradient(
  patch: Partial<Omit<Gradient, "stops" | "custom">>,
  label: string,
): void {
  gradient.value = { ...gradient.peek(), ...patch };
  commit(label);
}

/**
 * Chooses a technique and rebuilds the stops from it, which leaves Custom. Locked stops stay at
 * their position and color (plan D6).
 */
export function applyTechnique(technique: Technique, label = "Technique"): void {
  const kept = effectiveStops.peek().filter((s) => s.locked);
  gradient.value = { ...gradient.peek(), technique, custom: false, stops: kept };
  commit(label);
}

/** Rebuilds from the current technique: the ↺ on the Technique row (plan D19). */
export function rebuildFromTechnique(): void {
  applyTechnique(gradient.peek().technique, "Rebuild stops");
}

/** A new image returns a Custom gradient to its technique and drops the old image's locked stops. */
export function resetGradientForNewImage(): void {
  const g = gradient.peek();
  if (!g.custom && g.stops.length === 0) return;
  gradient.value = { ...g, custom: false, stops: [] };
  selectedStopId.value = null;
}

export function selectStop(id: string | null): void {
  selectedStopId.value = id;
}
