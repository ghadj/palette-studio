/**
 * The rows under the image in the Values view (spec 3.8; ui-contract "Image views" Values view
 * items 3 to 5; plan D19). `ValuesViewSummary` is the band strip, dark to light, with "Dark" and
 * "Light" under its ends. `ValuesViewRows` are Bands, Close in value (a warn dot and the count; it
 * expands to the threshold slider) and each flagged pair with its two swatch chips. The strip's
 * bracket is drawn by `StripMarks`.
 */
import { useId, useState } from "preact/hooks";
import { oklabToHex } from "../color/convert";
import { swatchHex } from "../palette/model";
import { CLOSE_IN_VALUE_MAX, CLOSE_IN_VALUE_MIN, closeInValue } from "../palette/values";
import { valuePairText } from "../palette/view-legend";
import { outputPalette, viewSettings } from "../state/signals";
import type { ViewSettings } from "../types";
import { SettingRow } from "./SettingRow";
import { type Option, Select } from "./SettingsControls";
import { Slider } from "./Slider";

/** Blocks the band strip shows for continuous bands. */
const CONTINUOUS_BLOCKS = 16;

/** The gray at lightness `l`, as a hex. */
const grayAt = (l: number): string => oklabToHex({ l, a: 0, b: 0 });

export function ValuesViewSummary() {
  const bands = viewSettings.value.bands;
  const count = bands === "continuous" ? CONTINUOUS_BLOCKS : bands;
  return (
    <div class="view-summary" data-testid="values-summary">
      <div class="band-strip" data-testid="band-strip">
        <div class="band-strip__blocks" aria-hidden="true">
          {Array.from({ length: count }, (_, i) => (
            <span
              key={i}
              class="band-strip__block"
              data-band={i + 1}
              data-user-content=""
              style={{ backgroundColor: grayAt((i + 0.5) / count) }}
            />
          ))}
        </div>
        <div class="band-strip__ends">
          <span>Dark</span>
          <span>Light</span>
        </div>
      </div>
    </div>
  );
}

const BAND_OPTIONS: ReadonlyArray<Option<string>> = [
  { value: "continuous", label: "Continuous" },
  { value: "3", label: "3" },
  { value: "5", label: "5" },
];

const toBands = (value: string): ViewSettings["bands"] =>
  value === "3" ? 3 : value === "5" ? 5 : "continuous";

const pairCount = (n: number): string => (n === 0 ? "None" : n === 1 ? "1 pair" : `${n} pairs`);

export function ValuesViewRows() {
  const view = viewSettings.value;
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const swatches = outputPalette.value;
  const pairs = closeInValue(swatches, view.closeInValue);
  return (
    <div class="setting-rows" data-testid="values-view-rows">
      <SettingRow label="Bands" htmlFor="view-bands">
        <Select
          id="view-bands"
          value={String(view.bands)}
          options={BAND_OPTIONS}
          onChange={(v) => {
            viewSettings.value = { ...viewSettings.peek(), bands: toBands(v) };
          }}
        />
      </SettingRow>
      <div data-testid="close-in-value-row">
        <SettingRow label="Close in value">
          <button
            type="button"
            class="row-button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen(!open)}
          >
            {pairs.length > 0 && <span class="close-dot" aria-hidden="true" />}
            <span>{pairCount(pairs.length)}</span>
          </button>
        </SettingRow>
        {open && (
          <div id={panelId} class="close-in-value-panel">
            <SettingRow label="Threshold" htmlFor="view-close-in-value">
              <Slider
                id="view-close-in-value"
                label="Close in value"
                value={view.closeInValue}
                min={CLOSE_IN_VALUE_MIN}
                max={CLOSE_IN_VALUE_MAX}
                step={0.01}
                decimals={2}
                onChange={(threshold) => {
                  viewSettings.value = { ...viewSettings.peek(), closeInValue: threshold };
                }}
              />
            </SettingRow>
          </div>
        )}
      </div>
      {pairs.length > 0 && (
        <ul class="value-pairs" data-testid="value-pairs">
          {pairs.map((pair) => (
            <li key={`${pair.first}-${pair.second}`} class="value-pairs__item">
              <span class="value-pairs__chips" aria-hidden="true">
                {[pair.first, pair.second].map((index) => {
                  const swatch = swatches[index];
                  return (
                    <span
                      key={index}
                      class="value-pairs__chip"
                      data-user-content=""
                      style={{ backgroundColor: swatch ? swatchHex(swatch) : "" }}
                    />
                  );
                })}
              </span>
              <span>{valuePairText(pair)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
