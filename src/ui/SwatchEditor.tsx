/**
 * The color editor (ui-contract column 2 items 3 and 4; spec 3.2). M3-T3 builds the L, C and H
 * sliders (item 3) and the HEX field with the out-of-gamut indicator, and makes Lock work (item 4).
 * Until then the row holds the Lock pill, coming later, and the Ramp pill, which opens
 * `RampPanel`: in place on desktop, a bottom sheet on phones (spec 6.1; `rows=ramp` opens it).
 */
import { useId } from "preact/hooks";
import { RowContent, useRowOpen } from "./ChevronRow";
import { comingSoon } from "./comingSoon";
import { useLayout } from "./layout";
import { RAMP_TITLE, RampPanel } from "./RampPanel";

export function SwatchEditor() {
  const [rampOpen, setRampOpen] = useRowOpen("ramp");
  const layout = useLayout();
  const base = useId();
  const rampButton = `${base}-ramp`;
  const rampRegion = `${base}-ramp-region`;
  return (
    <div class="swatch-editor" data-testid="swatch-editor">
      {/* M3-T3: the L, C and H sliders (item 3). */}
      <div class="swatch-editor__row">
        {/* M3-T3: the HEX field and the out-of-gamut indicator, before the pills (item 4). */}
        <button type="button" class="pill-button" data-coming-soon="" onClick={comingSoon}>
          Lock
        </button>
        <button
          id={rampButton}
          type="button"
          class="pill-button"
          aria-expanded={rampOpen}
          aria-controls={layout === "desktop" && rampOpen ? rampRegion : undefined}
          aria-haspopup={layout === "phone" ? "dialog" : undefined}
          onClick={() => setRampOpen(!rampOpen)}
        >
          Ramp
        </button>
      </div>
      <RowContent
        id="ramp"
        title={RAMP_TITLE}
        open={rampOpen}
        onClose={() => setRampOpen(false)}
        regionId={rampRegion}
        labelledBy={rampButton}
      >
        <RampPanel />
      </RowContent>
    </div>
  );
}
