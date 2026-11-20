/**
 * The Preview chevron row (spec 4.4, 6.2; plan D22, D24): aspect ratio, compare, the text check,
 * Vision and the surround. M4-T2 places the row with its content stub; M4-T13 builds the content,
 * the header count and reset-all, and owns this file.
 */
import { ChevronRow } from "./ChevronRow";
import { COMING_SOON } from "./comingSoon";

export function PreviewPanel() {
  return <p class="hint">{COMING_SOON}</p>;
}

export function PreviewRow() {
  return (
    <ChevronRow id="preview" label="Preview">
      <PreviewPanel />
    </ChevronRow>
  );
}
