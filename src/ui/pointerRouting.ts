/**
 * Which pointers and keys the image well's own zoom and pan leave to others (plan M3-T2; spec 6.1
 * "Gestures"):
 * - one finger on a marker drags the marker (M3-T15), so pan and pinch ignore it;
 * - while the eyedropper is on, every press samples (M3-T16), so pan and pinch ignore them all;
 * - the zoom controls and the well tools (M3-T12, M3-T16) handle their own pointers;
 * - the arrow keys nudge a focused marker (plan D9) instead of panning.
 */
import type { EyedropperMode } from "../types";

/** Marker hit areas carry this attribute (M3-T12). */
export const MARKER_SELECTOR = "[data-marker]";
/** Controls inside the well that handle their own pointers and keys. */
export const WELL_CONTROLS_SELECTOR = ".zoom-controls, .well-tools";

interface MaybeElement {
  closest?: (selector: string) => unknown;
}

const within = (target: unknown, selector: string): boolean => {
  const el = target as MaybeElement | null;
  return typeof el?.closest === "function" && el.closest(selector) !== null;
};

/** True when the well's pan and pinch should ignore a pointerdown on `target`. */
export function panIgnores(target: unknown, eyedropper: EyedropperMode): boolean {
  if (eyedropper !== "off") return true;
  return within(target, MARKER_SELECTOR) || within(target, WELL_CONTROLS_SELECTOR);
}

/**
 * True when a pointerdown on `target` must never reach pan or pinch, markers aside: the eyedropper
 * is on, or the target is a well control. A second finger on a marker still joins a pinch (D10).
 */
export function panIgnoresExceptMarkers(target: unknown, eyedropper: EyedropperMode): boolean {
  return eyedropper !== "off" || within(target, WELL_CONTROLS_SELECTOR);
}

/** True when the well's arrow keys shouldn't pan, because `target` handles them. */
export function keysIgnored(target: unknown): boolean {
  return within(target, MARKER_SELECTOR) || within(target, WELL_CONTROLS_SELECTOR);
}
