/**
 * The marker pointer that is down right now (plan M3-T15, D10). The image well's pinch reads it:
 * when a second finger lands during a marker drag, the drag is cancelled and the marker's finger
 * joins the pinch (the well ignores a pointerdown on a marker, so it never saw that finger).
 */
export interface MarkerPress {
  pointerId: number;
  /** The pointer's latest position, in client coordinates. */
  x: number;
  y: number;
  /** Cancels the drag, putting the swatch back (Esc, pointercancel, a second finger). */
  cancel(): void;
}

let current: MarkerPress | null = null;

export const markerPress = {
  get current(): MarkerPress | null {
    return current;
  },
  set(press: MarkerPress | null): void {
    current = press;
  },
};

/**
 * Called by the well on a pointerdown that isn't the marker's own pointer. Cancels the marker drag
 * and returns the marker's pointer, for the pinch to take over; null when no marker is held.
 */
export function takeMarkerPress(
  pointerId: number,
): { pointerId: number; x: number; y: number } | null {
  const press = current;
  if (!press || press.pointerId === pointerId) return null;
  current = null;
  press.cancel();
  return { pointerId: press.pointerId, x: press.x, y: press.y };
}
