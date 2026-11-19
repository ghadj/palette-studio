/**
 * The eyedropper's pure parts (spec 3.2 "Eyedropper", 3.7; M3 decisions 5c, 38 and D11): mapping a
 * position in the image well to a point on the image, and the palette change a pick makes. A pick
 * always adds a swatch, pinned like a dragged marker; dragging a marker updates a swatch (T15).
 */
import type { Oklab } from "../color/convert";
import { addSwatch, createSwatch } from "../palette/model";
import type { ImagePoint, Swatch } from "../types";

interface WellView {
  x: number;
  y: number;
  scale: number;
}

/**
 * The image point under a well position (px). The view's offsets are fractions of the well, as
 * `MarkerLayer` uses them: `well = view + point × scale`. The result is clamped to the image.
 */
export function pointFromWell(
  at: { x: number; y: number },
  well: { width: number; height: number },
  view: WellView,
): ImagePoint {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return {
    x: clamp((at.x / well.width - view.x) / view.scale),
    y: clamp((at.y / well.height - view.y) / view.scale),
  };
}

/** Adds a picked, pinned swatch with its point at the end; unchanged at 12. */
export function addPicked(palette: Swatch[], color: Oklab, point: ImagePoint): Swatch[] {
  return addSwatch(palette, createSwatch(color, { origin: "picked", pinned: true, point }));
}
