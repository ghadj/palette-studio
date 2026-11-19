/**
 * The eyedropper's pure parts (spec 3.2 "Eyedropper", 3.7; M3 decisions 5c and D11): mapping a
 * position in the image well to a point on the image, and the two palette changes a pick makes.
 * A picked swatch is pinned, like a dragged marker.
 */
import { type Oklab, oklabToOklch } from "../color/convert";
import { addSwatch, createSwatch } from "../palette/model";
import type { ImagePoint, Swatch } from "../types";
import { eyedropperMode, viewSettings } from "./signals";

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

/** Adds a picked, locked swatch with its point at the end; unchanged at 12. */
export function addPicked(palette: Swatch[], color: Oklab, point: ImagePoint): Swatch[] {
  return addSwatch(palette, createSwatch(color, { origin: "picked", pinned: true, point }));
}

/** Retargets a swatch to a picked color and point, and locks it. `extracted` is kept for reset. */
export function replaceWithPick(
  palette: Swatch[],
  id: string,
  color: Oklab,
  point: ImagePoint,
): Swatch[] {
  if (!palette.some((s) => s.id === id)) return palette;
  return palette.map((s) =>
    s.id === id
      ? { ...s, color: oklabToOklch(color), point, origin: "picked" as const, pinned: true }
      : s,
  );
}

/** Starts the eyedropper in Add mode, from the "+" tile's "Pick from image" (decision 5b). */
export function startEyedropper(): void {
  if (viewSettings.peek().mode !== "image") {
    viewSettings.value = { ...viewSettings.peek(), mode: "image" };
  }
  eyedropperMode.value = "add";
}
