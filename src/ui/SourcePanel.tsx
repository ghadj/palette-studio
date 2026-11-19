/**
 * The Source column (ui-contract "Column 1: SOURCE" and phone "Source tab"): image well, view bar,
 * and the setting rows. Below 1024 px the swatch strip sits under the view bar, as in mockup 09,
 * and pins under the header while the setting rows scroll (M2 decision 19; ui-contract D4). It shows
 * only the swatches there; the "+" tile and close pairs are on the Palette tab (M3 decision 32).
 */
import { outputPalette, progressVisible, viewSettings } from "../state/signals";
import type { ImageViewMode } from "../types";
import { CopyButtons } from "./CopyButtons";
import { comingSoon } from "./comingSoon";
import { EyedropperHint } from "./EyedropperLayer";
import { ImageMessageBanner, ImageWell } from "./ImageWell";
import { PaletteViewRows, PaletteViewSummary } from "./PaletteViewRows";
import { SettingsControls } from "./SettingsControls";
import { StripDock } from "./StripDock";
import { EmptyRolesNote } from "./SwatchStrip";
import { ValuesViewRows, ValuesViewSummary } from "./ValuesViewRows";

/** View bar (spec 3.8): Image, Palette and Values switch the view; the grid arrives in M5. */
function ViewBar() {
  const mode = viewSettings.value.mode;
  const segment = (value: ImageViewMode, label: string) => (
    <button
      type="button"
      class="segment"
      aria-pressed={mode === value}
      onClick={() => {
        if (viewSettings.peek().mode !== value) {
          viewSettings.value = { ...viewSettings.peek(), mode: value };
        }
      }}
    >
      {label}
    </button>
  );
  return (
    <div class="view-bar" data-testid="view-bar">
      <fieldset class="segmented">
        <legend class="visually-hidden">Image view</legend>
        {segment("image", "Image")}
        {segment("palette", "Palette")}
        {segment("values", "Values")}
      </fieldset>
      <button
        type="button"
        class="chip"
        aria-pressed="false"
        data-coming-soon=""
        onClick={comingSoon}
      >
        Grid
      </button>
    </div>
  );
}

/** The rows under the image follow the view (spec 3.8; ui-contract "Image views"). */
function ViewRows() {
  const mode = viewSettings.value.mode;
  if (mode === "palette") return <PaletteViewRows />;
  if (mode === "values") return <ValuesViewRows />;
  return <SettingsControls />;
}

/** The share bar and legend, or the band strip: they sit right under the view bar. */
function ViewSummary() {
  const mode = viewSettings.value.mode;
  if (mode === "palette") return <PaletteViewSummary />;
  if (mode === "values") return <ValuesViewSummary />;
  return null;
}

export function SourcePanel({ variant }: { variant: "desktop" | "phone" }) {
  return (
    <div class="panel" data-panel="source">
      {variant !== "phone" && <h2 class="section-label">Source</h2>}
      <ImageWell />
      {progressVisible.value && (
        <div class="progress" role="progressbar" aria-label="Working on the palette">
          <span class="progress__bar" />
        </div>
      )}
      <ImageMessageBanner />
      <ViewBar />
      <ViewSummary />
      <EyedropperHint />
      {variant !== "desktop" && outputPalette.value.length > 0 && <StripDock host="source" />}
      {variant !== "desktop" && <EmptyRolesNote />}
      {variant === "phone" && outputPalette.value.length > 0 && <CopyButtons />}
      <ViewRows />
    </div>
  );
}
