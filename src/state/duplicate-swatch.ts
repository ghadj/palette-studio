/**
 * Duplicate the selected swatch (spec 3.2; M3 decision 39): reachable by the D shortcut only, since
 * the Swatch row's Duplicate button is gone. The copy goes right after its source with the source's
 * population (decision 3f), is selected, and is one undo step. At 12 swatches nothing is added and
 * the limit note is announced through `notify`.
 */
import { canAdd, duplicateSwatch, FULL_MESSAGE } from "../palette/model";
import { commit } from "./history";
import { palette, selectedSwatchId, selectSwatch } from "./signals";

export function duplicateSelected(notify: (message: string) => void): void {
  const list = palette.peek();
  const id = selectedSwatchId.peek();
  const at = list.findIndex((s) => s.id === id);
  if (at < 0) return;
  if (!canAdd(list)) {
    notify(FULL_MESSAGE);
    return;
  }
  const next = duplicateSwatch(list, list[at]?.id ?? "");
  if (next === list) return;
  palette.value = next;
  selectSwatch(next[at + 1]?.id ?? null);
  commit("Duplicate");
}
