/**
 * The swatch strip (ui-contract column 2 item 1): the swatches in one row, the selection outlined.
 * With more than 6 swatches it breaks into two even rows when one row would make them smaller than
 * 44 px (decision 13). Swatches are user content and are never themed (spec 6.2).
 */
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { swatchHex, swatchLabel } from "../palette/model";
import {
  emptyRoles,
  extracting,
  imageLoading,
  palette,
  selectedSwatchId,
  selectSwatch,
} from "../state/signals";
import { stripColumns } from "./stripLayout";

export function SwatchStrip() {
  const swatches = palette.value;
  const selected = selectedSwatchId.value;
  const strip = useRef<HTMLFieldSetElement>(null);
  const [size, setSize] = useState({ width: 0, gap: 0 });
  const shown = swatches.length > 0;
  useLayoutEffect(() => {
    const el = strip.current;
    if (!el) return;
    const measure = () => {
      const gap = Number.parseFloat(getComputedStyle(el).columnGap) || 0;
      setSize({ width: el.clientWidth, gap });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [shown]);
  if (!shown) return null;
  const columns = stripColumns(swatches.length, size.width, size.gap);
  return (
    <fieldset
      ref={strip}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      class="swatch-strip"
      data-testid="swatch-strip"
      data-busy={extracting.value || imageLoading.value || undefined}
    >
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

/**
 * The sentence naming the swatch roles an extraction left empty (M2 decision 10b), such as "No
 * color fits the Dark vibrant or Light vibrant roles." Empty when every role is filled.
 */
export function emptyRolesText(roles: readonly string[]): string {
  if (roles.length === 0) return "";
  const names =
    roles.length === 1
      ? (roles[0] ?? "")
      : `${roles.slice(0, -1).join(", ")} or ${roles[roles.length - 1] ?? ""}`;
  return `No color fits the ${names} role${roles.length === 1 ? "" : "s"}.`;
}

/** A muted note under the strip naming the empty swatch roles; the strip leaves them out. */
export function EmptyRolesNote() {
  const text = emptyRolesText(emptyRoles.value);
  if (!text) return null;
  return (
    <p class="hint" data-testid="empty-roles">
      {text}
    </p>
  );
}
