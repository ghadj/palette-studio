/**
 * The Stop chevron row (plan D29): the selected stop's color, position, alpha, lock and midpoint.
 * M4-T2 places the row with its content stub; M4-T8 builds the content, titles the sheet "Stop N of
 * M" (through `ChevronRow`'s `sheetTitle`) and owns this file.
 */
import { ChevronRow } from "./ChevronRow";
import { COMING_SOON } from "./comingSoon";

export function StopDetails() {
  return <p class="hint">{COMING_SOON}</p>;
}

export function StopRow() {
  return (
    <ChevronRow id="stop" label="Stop">
      <StopDetails />
    </ChevronRow>
  );
}
