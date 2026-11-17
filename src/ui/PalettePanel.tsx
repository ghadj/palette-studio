/**
 * The Palette column (ui-contract "Column 2: PALETTE"; the phone Palette tab stacks the same
 * controls). M1 has the swatch strip and the selection label; the editor arrives in M3.
 */
import { palette } from "../state/signals";
import { CopyButtons } from "./CopyButtons";
import { SelectionLabel, SwatchStrip } from "./SwatchStrip";

export function PalettePanel({ variant }: { variant: "desktop" | "tablet" | "phone" }) {
  const empty = palette.value.length === 0;
  return (
    <div class="panel" data-panel="palette">
      {variant === "desktop" && <h2 class="section-label">Palette</h2>}
      <SwatchStrip />
      <SelectionLabel />
      {variant === "phone" && !empty && <CopyButtons />}
      {empty && <p class="hint">Load an image to extract a palette.</p>}
    </div>
  );
}
