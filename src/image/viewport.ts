/**
 * Zoom and pan of the image well (spec 6 "Image view", 6.1 "Gestures"; M2 decision 15). Pure math,
 * no DOM. A view scales the image about the well's top-left corner, then moves it by an offset:
 * a point p of the unzoomed image shows at `p × scale + offset`. Units are the caller's: the image
 * well passes pixels in tests and fractions of the well size in the app, so a view survives a
 * resize. The scale runs from Fit (1) to 8, and the image always covers the well (decision 15c).
 */

export interface View {
  scale: number;
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export const MIN_SCALE = 1;
export const MAX_SCALE = 8;

/** The zoom buttons step through 100%, 200%, 400% and 800% (decision 15c). */
export const ZOOM_STEPS: readonly number[] = [1, 2, 4, 8];

/** Turns −0 into 0, so views compare and serialize cleanly. */
const clean = (n: number): number => n + 0;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export function fitView(): View {
  return { scale: MIN_SCALE, x: 0, y: 0 };
}

export function isFit(view: View): boolean {
  return view.scale <= MIN_SCALE;
}

/** Clamps the scale to 1 to 8 and the offset so the image always covers the well. */
export function clampView(view: View, well: Size): View {
  const scale = clamp(Number.isFinite(view.scale) ? view.scale : MIN_SCALE, MIN_SCALE, MAX_SCALE);
  const x = Number.isFinite(view.x) ? view.x : 0;
  const y = Number.isFinite(view.y) ? view.y : 0;
  return {
    scale,
    x: clean(clamp(x, well.width * (1 - scale), 0)),
    y: clean(clamp(y, well.height * (1 - scale), 0)),
  };
}

/** Zooms by `factor` about `anchor` (a point in the well), so the image point under it stays put. */
export function zoomAt(view: View, factor: number, anchor: Point, well: Size): View {
  const scale = clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);
  const k = scale / view.scale;
  return clampView(
    { scale, x: anchor.x - (anchor.x - view.x) * k, y: anchor.y - (anchor.y - view.y) * k },
    well,
  );
}

/** Zooms to an absolute scale about `anchor`. */
export function zoomTo(view: View, scale: number, anchor: Point, well: Size): View {
  return zoomAt(view, scale / view.scale, anchor, well);
}

/** Moves the image by (dx, dy), clamped. At Fit nothing moves. */
export function panBy(view: View, dx: number, dy: number, well: Size): View {
  return clampView({ scale: view.scale, x: view.x + dx, y: view.y + dy }, well);
}

/** A view at `scale` with the image's center in the well's center. */
export function centered(scale: number, well: Size): View {
  const s = clamp(scale, MIN_SCALE, MAX_SCALE);
  return clampView(
    { scale: s, x: (well.width * (1 - s)) / 2, y: (well.height * (1 - s)) / 2 },
    well,
  );
}

/** The next button step above (direction 1) or below (direction −1) the current scale. */
export function nextZoomStep(scale: number, direction: 1 | -1): number {
  const eps = 1e-6;
  if (direction > 0) return ZOOM_STEPS.find((s) => s > scale + eps) ?? MAX_SCALE;
  for (let i = ZOOM_STEPS.length - 1; i >= 0; i -= 1) {
    const step = ZOOM_STEPS[i] as number;
    if (step < scale - eps) return step;
  }
  return MIN_SCALE;
}
