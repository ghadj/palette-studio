/**
 * The Source column (ui-contract "Column 1: SOURCE" and phone "Source tab"): image well, view bar,
 * and the setting rows. Below 1024 px the swatch strip sits under the view bar, as in mockup 09.
 */
import { palette, progressVisible } from "../state/signals";
import { CopyButtons } from "./CopyButtons";
import { comingSoon } from "./comingSoon";
import { ImageMessageBanner, ImageWell } from "./ImageWell";
import { SettingsControls } from "./SettingsControls";
import { SwatchStrip } from "./SwatchStrip";

/** View bar (spec 3.8): the views and the grid arrive in M3 and M5; Image is the current view. */
function ViewBar() {
  return (
    <div class="view-bar" data-testid="view-bar">
      <fieldset class="segmented">
        <legend class="visually-hidden">Image view</legend>
        <button type="button" class="segment" aria-pressed="true">
          Image
        </button>
        <button type="button" class="segment" aria-pressed="false" onClick={comingSoon}>
          Palette
        </button>
        <button type="button" class="segment" aria-pressed="false" onClick={comingSoon}>
          Values
        </button>
      </fieldset>
      <button type="button" class="chip" aria-pressed="false" onClick={comingSoon}>
        Grid
      </button>
    </div>
  );
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
      {variant !== "desktop" && <SwatchStrip />}
      {variant === "phone" && palette.value.length > 0 && <CopyButtons />}
      <SettingsControls />
    </div>
  );
}
