/**
 * What the image view on screen holds (spec 3.8, M3-T14): the area shares of the Palette view or
 * the band shares of the Values view. `ViewLayer` publishes them when it draws a view, and the
 * rows, the legend and the selection label read them, so no component imports another's internals.
 * View state, never in undo or autosave.
 */
import { signal } from "@preact/signals";
import type { DrawnViewMode } from "../extract/messages";

export interface ViewShares {
  mode: DrawnViewMode;
  /** The palette's hexes the view was drawn with, in palette order. */
  hexes: string[];
  /** Palette view: each color's share, in palette order; else empty. */
  shares: number[];
  /** Values view: each band's share, dark to light; else empty. */
  bandShares: number[];
}

/** The shares of the view last drawn, or null in the Image view or before the first draw. */
export const viewShares = signal<ViewShares | null>(null);
