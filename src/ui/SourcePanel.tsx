/**
 * The Source column (ui-contract "Column 1: SOURCE" and phone "Source tab"): image well, view bar,
 * and the setting rows. On tablets and phones the swatch strip sits under the view bar (decision 4).
 */
import { settings } from "../state/signals";
import type { Algorithm, WorkingSpace } from "../types";
import { comingSoon } from "./comingSoon";
import { ImageMessageBanner, ImageWell } from "./ImageWell";
import { SettingRow } from "./SettingRow";
import { SwatchStrip } from "./SwatchStrip";

export const ALGORITHM_LABELS: Record<Algorithm, string> = {
  "median-cut": "Median cut",
  wu: "Wu",
  kmeans: "K-means++",
  balanced: "Balanced",
  exact: "Exact colors",
  "even-spread": "Even spread",
  "swatch-roles": "Swatch roles",
};

export const WORKING_SPACE_LABELS: Record<WorkingSpace, string> = {
  oklab: "OKLab",
  cielab: "CIELAB",
  "linear-srgb": "Linear sRGB",
  srgb: "sRGB",
};

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

export function SourcePanel({ variant }: { variant: "desktop" | "tablet" | "phone" }) {
  const s = settings.value;
  return (
    <div class="panel" data-panel="source">
      {variant !== "phone" && <h2 class="section-label">Source</h2>}
      <ImageWell />
      <ImageMessageBanner />
      <ViewBar />
      {variant !== "desktop" && <SwatchStrip />}
      <div class="setting-rows" data-testid="setting-rows">
        <SettingRow label="Algorithm">{ALGORITHM_LABELS[s.algorithm]}</SettingRow>
        <SettingRow label="Colors">{s.colors}</SettingRow>
        <SettingRow label="Working space">{WORKING_SPACE_LABELS[s.workingSpace]}</SettingRow>
      </div>
    </div>
  );
}
