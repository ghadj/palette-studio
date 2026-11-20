/**
 * The Duplicate icon button in the Swatch drawer's title bar, next to Close (M3 decision 48): the
 * touch path to the D shortcut, which is the only other way to duplicate (decision 39). It acts
 * like the shortcut: the copy goes after its source and is selected, one undo step, and at 12 the
 * limit note shows. Only the drawer (below 1024 px) has it.
 */
import { CopyPlus } from "lucide-preact";
import { duplicateSelected } from "../state/duplicate-swatch";
import { showToast } from "./Toast";

export function DuplicateButton() {
  return (
    <button
      type="button"
      class="bottom-sheet__action"
      data-testid="duplicate-swatch"
      aria-label="Duplicate swatch"
      onClick={() => duplicateSelected(showToast)}
    >
      <CopyPlus size={20} strokeWidth={1.5} aria-hidden="true" />
    </button>
  );
}
