/**
 * The phone and tablet "Export palette" button (M3 decision 53). It sits in the pinned strip dock,
 * right-aligned on the legend line, so it is always in reach, and opens the export drawer: a bottom
 * sheet that stops below the strip (decisions 35, 46). The drawer holds the palette-wide Copy HEX
 * and Copy CSS, and is where M5's formats go. From 1024 px the "Palette export" bar does this job.
 */
import { Download } from "lucide-preact";
import { useState } from "preact/hooks";
import { outputPalette } from "../state/signals";
import { BottomSheet } from "./BottomSheet";
import { CopyButtons } from "./CopyButtons";

const BUTTON_ID = "export-palette-button";

export function ExportPaletteButton() {
  const [open, setOpen] = useState(false);
  const empty = outputPalette.value.length === 0;
  return (
    <>
      <button
        type="button"
        id={BUTTON_ID}
        class="strip-export"
        data-testid="export-palette"
        aria-label="Export palette"
        aria-haspopup="dialog"
        disabled={empty}
        onClick={() => setOpen(true)}
      >
        <Download size={16} strokeWidth={1.5} aria-hidden="true" />
        <span aria-hidden="true">Export</span>
      </button>
      {open && (
        <BottomSheet
          title="Export palette"
          onClose={() => setOpen(false)}
          openerId={BUTTON_ID}
          testId="sheet-export"
        >
          <CopyButtons />
        </BottomSheet>
      )}
    </>
  );
}
