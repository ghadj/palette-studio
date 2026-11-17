/**
 * The swatch strip (ui-contract column 2 item 1): the swatches in one row, the selection outlined.
 * Swatches are user content and are never themed (spec 6.2).
 */
import { swatchHex, swatchLabel } from "../palette/model";
import { palette, selectedSwatchId, selectSwatch } from "../state/signals";

export function SwatchStrip() {
  const swatches = palette.value;
  const selected = selectedSwatchId.value;
  if (swatches.length === 0) return null;
  return (
    <fieldset class="swatch-strip" data-testid="swatch-strip">
      <legend class="visually-hidden">Palette swatches</legend>
      {swatches.map((swatch) => {
        const hex = swatchHex(swatch);
        return (
          <button
            key={swatch.id}
            type="button"
            class="swatch"
            data-swatch=""
            data-user-content=""
            aria-label={`${swatchLabel(swatches, swatch.id)}, ${hex}`}
            aria-pressed={swatch.id === selected}
            style={{ backgroundColor: hex }}
            onClick={() => selectSwatch(swatch.id)}
          />
        );
      })}
    </fieldset>
  );
}

/** A muted label naming the selection, such as "Swatch 3" (ui-contract column 2 item 2). */
export function SelectionLabel() {
  const label = swatchLabel(palette.value, selectedSwatchId.value);
  if (!label) return null;
  return (
    <p class="selection-label" data-testid="selection-label">
      {label}
    </p>
  );
}
