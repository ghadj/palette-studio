/**
 * The swatch strip (ui-contract column 2 item 1): the swatches in one row, the selection outlined.
 * With more than 6 swatches it breaks into two even rows when one row would make them smaller than
 * 44 px (decision 13). Swatches are user content and are never themed (spec 6.2). Hovering a
 * swatch with a fine pointer, or focusing it from the keyboard, shows its cluster map (spec 2.6).
 */
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { swatchHex, swatchLabel } from "../palette/model";
import { clusterFocus, clusterHover, shareText, shownCluster } from "../state/cluster";
import {
  clusterMap,
  emptyRoles,
  extracting,
  imageLoading,
  outputPalette,
  selectedSwatchId,
  selectSwatch,
} from "../state/signals";
import { stripColumns } from "./stripLayout";

/** Only a fine pointer hovers (spec 6.1 "No hover"); touch uses the Cluster map toggle. */
const hovers = (event: PointerEvent): boolean =>
  event.pointerType === "mouse" && window.matchMedia("(pointer: fine)").matches;

/** Keyboard focus only: a click that focuses a swatch doesn't leave its map showing. */
const keyboardFocus = (el: Element): boolean => {
  try {
    return el.matches(":focus-visible");
  } catch {
    return false;
  }
};

const clear = (target: typeof clusterHover, id: string): void => {
  if (target.peek() === id) target.value = null;
};

export function SwatchStrip() {
  const swatches = outputPalette.value;
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
  // Each swatch's share of the image from the cluster map (spec 2.6), when it matches the palette.
  const map = clusterMap.value;
  const shares = map && map.shares.length === swatches.length ? map.shares : null;
  return (
    <fieldset
      ref={strip}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      class="swatch-strip"
      data-testid="swatch-strip"
      data-busy={extracting.value || imageLoading.value || undefined}
    >
      <legend class="visually-hidden">Palette swatches</legend>
      {swatches.map((swatch, i) => {
        const hex = swatchHex(swatch);
        return (
          <button
            key={swatch.id}
            type="button"
            class="swatch"
            data-swatch=""
            data-user-content=""
            data-share={shares?.[i]}
            aria-label={`${swatchLabel(swatches, swatch.id)}, ${hex}`}
            aria-pressed={swatch.id === selected}
            style={{ backgroundColor: hex }}
            onClick={() => selectSwatch(swatch.id)}
            onPointerEnter={(e) => {
              if (hovers(e)) clusterHover.value = swatch.id;
            }}
            onPointerLeave={() => clear(clusterHover, swatch.id)}
            onFocus={(e) => {
              if (keyboardFocus(e.currentTarget)) clusterFocus.value = swatch.id;
            }}
            onBlur={() => clear(clusterFocus, swatch.id)}
          />
        );
      })}
    </fieldset>
  );
}

/**
 * A muted label naming the selection, such as "Swatch 3" (ui-contract column 2 item 2). While a
 * cluster map shows, it names that swatch with its share: "Swatch 3 · 0.5% of the image" (spec 2.6,
 * M2 decision 13c).
 */
export function SelectionLabel() {
  const shown = shownCluster.value;
  const label = swatchLabel(outputPalette.value, shown?.id ?? selectedSwatchId.value);
  if (!label) return null;
  return (
    <p class="selection-label" data-testid="selection-label">
      {shown ? `${label} · ${shareText(shown.share)} of the image` : label}
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
