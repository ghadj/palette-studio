/**
 * The Ramp panel (spec 3.4; M3 decisions 4a, 4b), opened by the editor's Ramp pill: in place under
 * the editor on desktop, a bottom sheet on phones (spec 6.1). It previews the selected swatch's
 * 11-step ramp (plan D4) and its harmonies (D5). Any tile can be added to the palette as a manual
 * swatch, one undo step each; adding is disabled at 12 colors.
 */
import { type Oklch, oklchToHex, oklchToOklab } from "../color/convert";
import { harmonies } from "../color/harmony";
import { ramp } from "../color/ramps";
import { addSwatch, canAdd, createSwatch, selectedSwatch } from "../palette/model";
import { commit } from "../state/history";
import { outputPalette, palette, selectedSwatchId } from "../state/signals";
import { FULL_MESSAGE } from "./SwatchDetails";

/** The panel's name: the sheet title on phones. */
export const RAMP_TITLE = "Ramp";

function addColor(color: Oklch, label: string): void {
  const base = palette.peek();
  if (!canAdd(base)) return;
  const swatch = createSwatch(oklchToOklab(color), { origin: "manual" });
  palette.value = addSwatch(base, swatch);
  commit(label);
}

interface TileProps {
  color: Oklch;
  caption: string;
  describe: string;
  full: boolean;
  noteId: string;
  source?: boolean;
}

function Tile({ color, caption, describe, full, noteId, source }: TileProps) {
  const hex = oklchToHex(color);
  return (
    <li class="ramp-tile" data-source={source ? "" : undefined}>
      <button
        type="button"
        class="ramp-tile__chip"
        data-user-content
        data-testid="ramp-tile"
        data-hex={hex}
        data-step={caption}
        style={{ backgroundColor: hex }}
        disabled={full}
        aria-describedby={full ? noteId : undefined}
        aria-label={`Add ${hex}, ${describe}, to the palette${source ? " (the selected color)" : ""}`}
        onClick={() => addColor(color, "Add color")}
      />
      <span class="ramp-tile__caption">{caption}</span>
      <span class="ramp-tile__hex">{hex}</span>
    </li>
  );
}

export function RampPanel() {
  const swatch = selectedSwatch(outputPalette.value, selectedSwatchId.value);
  if (!swatch) {
    return (
      <div class="ramp-panel" data-testid="ramp-panel">
        <p class="hint">Select a swatch to see its ramp and harmonies.</p>
      </div>
    );
  }
  const full = !canAdd(palette.value);
  const noteId = "ramp-full";
  const steps = ramp(swatch.color);
  const groups = harmonies(swatch.color);
  return (
    <div class="ramp-panel" data-testid="ramp-panel">
      <div class="ramp-section">
        <h3 class="section-label" id="ramp-heading">
          Ramp
        </h3>
        <ul class="ramp-tiles" data-testid="ramp-tiles">
          {steps.map((s) => (
            <Tile
              key={s.label}
              color={s.color}
              caption={String(s.label)}
              describe={`step ${s.label}`}
              full={full}
              noteId={noteId}
              source={s.isSource}
            />
          ))}
        </ul>
      </div>
      <div class="ramp-section">
        <h3 class="section-label" id="harmony-heading">
          Harmonies
        </h3>
        {groups.map((g) => (
          <div class="ramp-group" key={g.id} data-testid="harmony-group">
            <p class="ramp-group__label">{g.label}</p>
            <ul class="ramp-tiles">
              {g.colors.map((c, i) => (
                <Tile
                  key={`${g.id}-${i}`}
                  color={c}
                  caption={`${Math.round(c.h)}°`}
                  describe={`${g.label} ${Math.round(c.h)} degrees`}
                  full={full}
                  noteId={noteId}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
      {full && (
        <p class="swatch-note" id={noteId}>
          {FULL_MESSAGE}
        </p>
      )}
    </div>
  );
}
