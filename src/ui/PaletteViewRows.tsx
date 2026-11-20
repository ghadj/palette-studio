/**
 * The rows under the image in the Palette view (spec 3.8; ui-contract "Image views" Palette view
 * items 3 to 5; plan D18). `PaletteViewSummary` is the area-share bar, largest first, and the
 * legend under it, with equal small shares merged into one entry. `PaletteViewRows` are Colors
 * from and Dither. The shares come from the worker's reply, through `viewShares`.
 */
import { legendEntries } from "../palette/view-legend";
import { viewSettings } from "../state/signals";
import { viewShares } from "../state/view-result";
import { SettingRow } from "./SettingRow";
import { Select } from "./SettingsControls";
import { Toggle } from "./Toggle";

export function PaletteViewSummary() {
  const result = viewShares.value;
  if (result?.mode !== "palette" || result.shares.length === 0) return null;
  const parts = result.shares
    .map((share, index) => ({ share, index, hex: result.hexes[index] ?? "" }))
    .sort((a, b) => b.share - a.share || a.index - b.index);
  const entries = legendEntries(result.shares, result.hexes);
  return (
    <div class="view-summary" data-testid="palette-summary">
      <div class="share-bar" data-testid="share-bar" aria-hidden="true">
        {parts.map((part) => (
          <span
            key={part.index}
            class="share-bar__part"
            data-share-part=""
            data-user-content=""
            style={{ flexGrow: part.share, backgroundColor: part.hex }}
          />
        ))}
      </div>
      <ul class="legend" data-testid="legend" aria-label="Area share of each color">
        {entries.map((entry) => (
          <li key={entry.hexes.join()} class="legend__entry" data-testid="legend-entry">
            <span class="legend__squares" aria-hidden="true">
              {entry.hexes.map((hex) => (
                <span
                  key={hex}
                  class="legend__square"
                  data-legend-square=""
                  data-user-content=""
                  style={{ backgroundColor: hex }}
                />
              ))}
            </span>
            <span>{entry.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const COLORS_FROM = [
  { value: "palette", label: "Palette" },
  // Paint matching is Part 2 (plan D18), so this stays visible and disabled.
  { value: "paints", label: "Matched paints (needs paint matching)", disabled: true },
];

export function PaletteViewRows() {
  const view = viewSettings.value;
  return (
    <div class="setting-rows" data-testid="palette-view-rows">
      <SettingRow label="Colors from" htmlFor="view-colors-from">
        <Select
          id="view-colors-from"
          value={view.colorsFrom}
          options={COLORS_FROM}
          onChange={(colorsFrom) => {
            if (colorsFrom === "palette") {
              viewSettings.value = { ...viewSettings.peek(), colorsFrom };
            }
          }}
        />
      </SettingRow>
      <SettingRow label="Dither" htmlFor="view-dither">
        <Toggle
          id="view-dither"
          checked={view.dither}
          onChange={(dither) => {
            viewSettings.value = { ...viewSettings.peek(), dither };
          }}
        />
      </SettingRow>
    </div>
  );
}
