/**
 * Removes a swatch (M3 decision 38; spec 3.2): the strip's X button and the Delete or Backspace key
 * on a focused swatch. One undo step; the selection moves to the swatch that took its place, or the
 * new last one (as the Swatch row's Delete did in T4).
 */
import { deleteSwatch } from "../palette/model";
import { commit } from "./history";
import { palette, selectSwatch } from "./signals";

export function removeSwatch(id: string): void {
  const list = palette.peek();
  const at = list.findIndex((s) => s.id === id);
  const next = deleteSwatch(list, id);
  if (at < 0 || next === list) return;
  palette.value = next;
  selectSwatch(next[Math.min(at, next.length - 1)]?.id ?? null);
  commit("Delete");
}
