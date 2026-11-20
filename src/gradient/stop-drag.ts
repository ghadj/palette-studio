/** Pure parts of the stop bar's drag (spec 4.3 "Stops"; plan M4-T7). No DOM, no signals. */
import type { GradientStop } from "../types";
import { moveStop } from "./model";

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** The position (0 to 1) of a pointer x along the bar's box, clamped. */
export function positionFromPointer(
  clientX: number,
  rect: { left: number; width: number },
): number {
  return clamp01((clientX - rect.left) / Math.max(1, rect.width));
}

/**
 * The stops with `id` moved to `position`, re-sorted, ids kept. Always called with the list from
 * the start of the drag, so returning to the start position gives that very list back (Esc and
 * `pointercancel` use it).
 */
export function dragStop(start: GradientStop[], id: string, position: number): GradientStop[] {
  return moveStop(start, id, position);
}

/**
 * The stored position for a position on the displayed bar. The bar shows reverse, then mirror
 * (plan D21); this undoes them. In a mirrored bar both copies of a stop map to the same place.
 */
export function toStoredPosition(
  displayed: number,
  geometry: { reverse: boolean; mirror: boolean },
): number {
  let p = clamp01(displayed);
  if (geometry.mirror) p = p <= 0.5 ? p * 2 : (1 - p) * 2;
  return geometry.reverse ? 1 - p : p;
}

/** The midpoint (0.01 to 0.99) for a pointer at `p` in the segment from `a` to `b`. */
export function hintFromPointer(p: number, a: number, b: number): number {
  const span = b - a;
  if (Math.abs(span) < 1e-9) return 0.5;
  return Math.min(0.99, Math.max(0.01, (p - a) / span));
}
