/**
 * The Palette column (ui-contract "Column 2: PALETTE"; the phone Palette tab stacks the same
 * controls, spec 6.6 rule 6):
 * 1. the swatch strip, with its marks under it (pinned under the header below 1024 px, M3 decision 33)
 * 2. the selection label
 * 3. and 4. the editor: L, C, H, then HEX with the Lock and Ramp pills
 * 5. chevron rows: Swatch (M3 decision 5a), Adjustments, Contrast and CVD. They expand in place on
 *    desktop and open bottom sheets on phones (spec 6.1).
 *
 * The Cluster map toggle lives in the Swatch row (M2 decisions 13d and 13f): see SwatchDetails.
 *
 * The layout is fixed here (M3-T2); each feature fills its own component file, so later tasks
 * don't edit this one.
 */
import { outputPalette } from "../state/signals";
import { AdjustmentsPanel } from "./AdjustmentsPanel";
import { ChevronRow } from "./ChevronRow";
import { ContrastPanel } from "./ContrastPanel";
import { CopyButtons } from "./CopyButtons";
import { CvdPanel } from "./CvdPanel";
import { DuplicateButton } from "./DuplicateButton";
import { StripDock } from "./StripDock";
import { SwatchDetails } from "./SwatchDetails";
import { SwatchEditor } from "./SwatchEditor";
import { EmptyRolesNote, SelectionLabel, SwatchStrip } from "./SwatchStrip";

export function PalettePanel({ variant }: { variant: "desktop" | "phone" }) {
  const empty = outputPalette.value.length === 0;
  return (
    <div class="panel" data-panel="palette">
      {variant === "desktop" && <h2 class="section-label">Palette</h2>}
      {/* The strip and its marks pin: under the header below 1024 px (M3 decision 33), at the top
          of the column from 1024 px (M3 decision 45). */}
      {!empty ? <StripDock host="palette" /> : <SwatchStrip />}
      <SelectionLabel />
      <EmptyRolesNote />
      {!empty && <SwatchEditor />}
      {!empty && (
        <div class="chevron-rows" data-testid="palette-rows">
          <ChevronRow id="swatch" label="Swatch" sheetAction={<DuplicateButton />}>
            <SwatchDetails />
          </ChevronRow>
          <ChevronRow id="adjustments" label="Adjustments">
            <AdjustmentsPanel />
          </ChevronRow>
          <ChevronRow id="contrast" label="Contrast">
            <ContrastPanel />
          </ChevronRow>
          <ChevronRow id="cvd" label="CVD">
            <CvdPanel />
          </ChevronRow>
        </div>
      )}
      {variant === "phone" && !empty && <CopyButtons />}
      {empty && <p class="hint">Load an image to extract a palette.</p>}
    </div>
  );
}
