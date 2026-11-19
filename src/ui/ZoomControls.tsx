/**
 * Zoom controls in the image well's top-right corner (M2 decision 15b, 15e; M3 decision 26): Zoom out, Zoom in
 * and Fit. The buttons step through 100%, 200%, 400% and 800% about the well's center, and the zoom
 * level is announced through a live region. At the ends of the range a button is aria-disabled, so
 * keyboard focus stays on it.
 */
import { Maximize, ZoomIn, ZoomOut } from "lucide-preact";
import { fitView, MAX_SCALE, MIN_SCALE, nextZoomStep, type View, zoomTo } from "../image/viewport";
import { imageView } from "../state/signals";

/** The well in the units of `imageView`: fractions of its size. */
export const UNIT_WELL = { width: 1, height: 1 } as const;
const CENTER = { x: 0.5, y: 0.5 };

export const zoomLabel = (view: View): string => `${Math.round(view.scale * 100)}%`;

/** One button step in or out, about the center of the well. */
export function zoomStep(direction: 1 | -1): void {
  const view = imageView.peek();
  imageView.value = zoomTo(view, nextZoomStep(view.scale, direction), CENTER, UNIT_WELL);
}

export function zoomFit(): void {
  imageView.value = fitView();
}

export function ZoomControls() {
  const view = imageView.value;
  const atMin = view.scale <= MIN_SCALE;
  const atMax = view.scale >= MAX_SCALE;
  return (
    <fieldset class="zoom-controls" data-testid="zoom-controls">
      <legend class="visually-hidden">Zoom</legend>
      <button
        type="button"
        class="zoom-button"
        aria-label="Zoom out"
        aria-disabled={atMin || undefined}
        onClick={() => !atMin && zoomStep(-1)}
      >
        <ZoomOut size={20} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <button
        type="button"
        class="zoom-button"
        aria-label="Zoom in"
        aria-disabled={atMax || undefined}
        onClick={() => !atMax && zoomStep(1)}
      >
        <ZoomIn size={20} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <button type="button" class="zoom-button" aria-label="Fit" onClick={zoomFit}>
        <Maximize size={20} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <span class="visually-hidden" role="status" aria-live="polite" data-testid="zoom-level">
        {zoomLabel(view)}
      </span>
    </fieldset>
  );
}
