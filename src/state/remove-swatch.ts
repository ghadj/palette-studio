/**
 * Removes a swatch (M3 decision 38; spec 3.2): the strip's X button and the Delete or Backspace key
 * on a focused swatch. One undo step; the selection moves to the swatch that took its place, or the
 * new last one (as the Swatch row's Delete did in T4).
 */
import { detachRemoved } from "../gradient/model";
import { deleteSwatch } from "../palette/model";
import { commit } from "./history";
import { gradient, outputPalette, palette, selectSwatch } from "./signals";

export function removeSwatch(id: string): void {
  const list = palette.peek();
  const at = list.findIndex((s) => s.id === id);
  const next = deleteSwatch(list, id);
  if (at < 0 || next === list) return;
  // The stops of a removed swatch keep its last output color (spec 4.3), in the same undo step.
  const last = new Map(outputPalette.peek().map((s) => [s.id, s.color]));
  gradient.value = detachRemoved(gradient.peek(), [id], last);
  palette.value = next;
  selectSwatch(next[Math.min(at, next.length - 1)]?.id ?? null);
  commit("Delete");
}
