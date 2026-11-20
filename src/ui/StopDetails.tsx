/**
 * The Stop chevron row (spec 4.3 "Stops"; plan M4-T8, D29, D30): the selected stop's color,
 * position, alpha, midpoint, lock and removal. The sheet is titled "Stop N of M" through
 * `ChevronRow`'s `sheetTitle`.
 *
 * - Color: chips that link the stop to a swatch (a radio group), a HEX field that detaches the
 *   stop when a color is typed (committed on Enter or blur), a copy icon beside it (M3 decisions
 *   39 and 50), and, while the stop is detached from a swatch, an unlink icon that is itself the
 *   Relink button.
 * - Position in % or px, with periods as the decimal separator (spec 5).
 * - Alpha and Midpoint have reset icons while they differ from their defaults (M3 decision 58).
 * - Every edit is one undo step and sets Custom (plan Q1a); the actions are in `stop-edit.ts`.
 */

import { signal } from "@preact/signals";
import { Copy, RotateCcw, Trash2, Unlink } from "lucide-preact";
import { useId, useLayoutEffect, useState } from "preact/hooks";
import { hexToOklch, oklchToHex } from "../color/convert";
import { parseHex } from "../color/hex";
import { resolveStops } from "../gradient/model";
import { swatchLabel } from "../palette/model";
import { effectiveStops } from "../state/gradient";
import { begin, end } from "../state/history";
import { gradient, outputPalette, selectedStopId } from "../state/signals";
import {
  canRelink,
  fractionToUnit,
  linkSelectedStop,
  type PositionUnit,
  previewWidth,
  relinkSelectedStop,
  removeSelectedStop,
  selectedStop,
  selectedStopIndex,
  setSelectedAlpha,
  setSelectedColor,
  setSelectedHint,
  setSelectedLocked,
  setSelectedPosition,
  unitToFraction,
} from "../state/stop-edit";
import type { GradientStop } from "../types";
import { ChevronRow } from "./ChevronRow";
import { DecimalField } from "./DecimalField";
import { SettingRow } from "./SettingRow";
import { Slider } from "./Slider";
import { copySelected } from "./SwatchDetails";
import { Toggle } from "./Toggle";

/** The unit the position is shown and typed in; kept while the row is closed and reopened. */
const positionUnit = signal<PositionUnit>("%");

const NO_ALPHA = 100;
const NO_HINT = 50;

/** The stop's color as the strip would show it: from its swatch, after adjustments, or its own. */
function stopColor(stop: GradientStop) {
  const g = gradient.peek();
  const plain = { ...g, geometry: { ...g.geometry, reverse: false, mirror: false } };
  return resolveStops(plain, [stop], outputPalette.value)[0]?.color ?? null;
}

/**
 * A HEX field that edits a draft and commits it on Enter or blur, so typing a color is one undo
 * step. An invalid draft is dropped, and the field shows the stop's color again.
 */
function HexField({
  id,
  value,
  onCommit,
}: {
  id: string;
  value: string;
  onCommit: (hex: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  // A change from elsewhere, such as an undo or a swatch edit, replaces a draft being left alone.
  useLayoutEffect(() => {
    setDraft((d) => (d !== null && parseHex(d) === value ? null : d));
  }, [value]);
  const finish = () => {
    const hex = draft === null ? null : parseHex(draft);
    if (hex !== null && hex !== value) onCommit(hex);
    setDraft(null);
  };
  return (
    <input
      id={id}
      class="number-field stop-hex-field"
      type="text"
      inputMode="text"
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      spellcheck={false}
      aria-label="HEX"
      value={draft ?? value}
      onInput={(event) => setDraft(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") finish();
        else if (event.key === "Escape") setDraft(null);
      }}
      onBlur={finish}
    />
  );
}

function ResetIcon({
  label,
  onReset,
  testId,
}: {
  label: string;
  onReset: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      class="reset-icon"
      data-testid={testId}
      aria-label={label}
      onClick={onReset}
    >
      <RotateCcw aria-hidden="true" size={18} strokeWidth={1.5} />
    </button>
  );
}

/** The palette's swatches as a radio group: the one the stop is linked to is checked. */
function SwatchChips({ stop }: { stop: GradientStop }) {
  const swatches = outputPalette.value;
  const linked = stop.color.kind === "swatch" ? stop.color.id : null;
  const tabbable = swatches.some((s) => s.id === linked) ? linked : swatches[0]?.id;
  return (
    <div class="stop-chips" role="radiogroup" aria-label="Link to swatch">
      {swatches.map((swatch) => {
        const checked = swatch.id === linked;
        return (
          // biome-ignore lint/a11y/useSemanticElements: a filled swatch chip with roving arrow keys
          <button
            key={swatch.id}
            type="button"
            role="radio"
            class="stop-chip"
            data-user-content=""
            aria-checked={checked}
            aria-label={swatchLabel(swatches, swatch.id)}
            tabIndex={swatch.id === tabbable ? 0 : -1}
            style={{ background: oklchToHex(swatch.color) }}
            onClick={() => linkSelectedStop(swatch.id)}
            onKeyDown={(event) => {
              const step =
                event.key === "ArrowRight" || event.key === "ArrowDown"
                  ? 1
                  : event.key === "ArrowLeft" || event.key === "ArrowUp"
                    ? -1
                    : 0;
              if (step === 0) return;
              event.preventDefault();
              const i = swatches.findIndex((s) => s.id === swatch.id);
              const next = swatches[(i + step + swatches.length) % swatches.length];
              if (!next) return;
              linkSelectedStop(next.id);
              const group = event.currentTarget.parentElement;
              const buttons = group?.querySelectorAll<HTMLElement>("[role=radio]");
              buttons?.[(i + step + swatches.length) % swatches.length]?.focus();
            }}
          />
        );
      })}
    </div>
  );
}

function ColorRow({ stop, ids }: { stop: GradientStop; ids: { hex: string; note: string } }) {
  const color = stopColor(stop);
  const hex = color ? oklchToHex(color) : "";
  const detached = stop.color.kind === "value" && stop.color.from !== null;
  const relinkable = canRelink(stop);
  const from = stop.color.kind === "value" ? stop.color.from : null;
  const note = detached && !relinkable ? "Swatch removed" : null;
  return (
    <SettingRow label="Color" htmlFor={ids.hex} note={note} noteId={ids.note}>
      <span class="copy-group">
        <HexField
          id={ids.hex}
          value={hex}
          onCommit={(typed) => setSelectedColor(hexToOklch(typed))}
        />
        <button
          type="button"
          class="icon-pill copy-icon"
          data-testid="stop-copy"
          aria-label="Copy HEX value"
          disabled={!color}
          onClick={() => color && void copySelected(color, "hex")}
        >
          <Copy aria-hidden="true" size={18} strokeWidth={1.5} />
        </button>
        {detached && (
          <button
            type="button"
            class="icon-pill stop-relink"
            data-testid="stop-relink"
            aria-label={
              relinkable
                ? `Relink to ${swatchLabel(outputPalette.value, from)}`
                : "Relink to swatch"
            }
            aria-disabled={!relinkable}
            aria-describedby={relinkable ? undefined : ids.note}
            onClick={() => {
              if (relinkable) relinkSelectedStop();
            }}
          >
            <Unlink aria-hidden="true" size={18} strokeWidth={1.5} />
          </button>
        )}
      </span>
    </SettingRow>
  );
}

function PositionRow({ stop, id }: { stop: GradientStop; id: string }) {
  const unit = positionUnit.value;
  const width = previewWidth();
  const pxOk = width > 0;
  const shownUnit: PositionUnit = unit === "px" && pxOk ? "px" : "%";
  const max = shownUnit === "px" ? width : 100;
  return (
    <SettingRow label="Position" htmlFor={id}>
      <span class="stop-position">
        <DecimalField
          id={id}
          label="Position"
          value={fractionToUnit(stop.position, shownUnit, width)}
          min={0}
          max={max}
          decimals={1}
          step={shownUnit === "px" ? 1 : 0.1}
          disabled={stop.locked}
          onCommit={(v) => setSelectedPosition(unitToFraction(v, shownUnit, width))}
        />
        <button
          type="button"
          class="text-button stop-unit"
          aria-label={`Position unit: ${shownUnit === "%" ? "percent" : "pixels"}. Switch to ${shownUnit === "%" ? "pixels" : "percent"}`}
          onClick={() => {
            positionUnit.value = shownUnit === "%" ? "px" : "%";
          }}
        >
          {shownUnit}
        </button>
      </span>
    </SettingRow>
  );
}

function StopContent() {
  const stop = selectedStop();
  const base = useId();
  if (!stop) return <p class="hint">Select a stop on the bar to edit it.</p>;
  const stops = effectiveStops.value;
  const index = selectedStopIndex();
  const isLast = index === stops.length - 1;
  const alphaPercent = Math.round(stop.alpha * 100);
  const hintPercent = Math.round(stop.hint * 100);
  const removeBlock = stop.locked
    ? "Unlock the stop to remove it."
    : stops.length <= 2
      ? "A gradient needs at least 2 stops."
      : null;
  const removeNote = `${base}-remove-note`;
  return (
    <div class="stop-details" data-testid="stop-details" data-stop-id={stop.id}>
      <ColorRow stop={stop} ids={{ hex: `${base}-hex`, note: `${base}-color-note` }} />
      <SwatchChips stop={stop} />
      <PositionRow stop={stop} id={`${base}-position`} />
      <SettingRow
        label="Alpha"
        htmlFor={`${base}-alpha`}
        reset={
          alphaPercent === NO_ALPHA ? null : (
            <ResetIcon
              label="Reset alpha"
              testId="stop-reset-alpha"
              onReset={() => setSelectedAlpha(1)}
            />
          )
        }
      >
        <Slider
          id={`${base}-alpha`}
          label="Alpha"
          value={alphaPercent}
          min={0}
          max={100}
          onChange={(v) => setSelectedAlpha(v / 100)}
          onDragStart={begin}
          onDragEnd={() => end()}
        />
      </SettingRow>
      {!isLast && (
        <SettingRow
          label="Midpoint"
          htmlFor={`${base}-hint`}
          reset={
            hintPercent === NO_HINT ? null : (
              <ResetIcon
                label="Reset midpoint"
                testId="stop-reset-hint"
                onReset={() => setSelectedHint(0.5)}
              />
            )
          }
        >
          <Slider
            id={`${base}-hint`}
            label="Midpoint"
            value={hintPercent}
            min={1}
            max={99}
            onChange={(v) => setSelectedHint(v / 100)}
            onDragStart={begin}
            onDragEnd={() => end()}
          />
        </SettingRow>
      )}
      <SettingRow label="Lock" htmlFor={`${base}-lock`}>
        <Toggle id={`${base}-lock`} checked={stop.locked} onChange={setSelectedLocked} />
      </SettingRow>
      <SettingRow
        label="Remove stop"
        note={removeBlock}
        noteId={removeNote}
        disabled={removeBlock !== null}
      >
        <button
          type="button"
          class="icon-pill stop-remove"
          data-testid="stop-remove"
          aria-label="Remove stop"
          aria-disabled={removeBlock !== null}
          aria-describedby={removeBlock ? removeNote : undefined}
          onClick={() => {
            if (removeBlock === null) removeSelectedStop();
          }}
        >
          <Trash2 aria-hidden="true" size={18} strokeWidth={1.5} />
        </button>
      </SettingRow>
    </div>
  );
}

export function StopDetails() {
  return <StopContent />;
}

export function StopRow() {
  const index = selectedStopIndex();
  const count = effectiveStops.value.length;
  void selectedStopId.value;
  return (
    <ChevronRow
      id="stop"
      label="Stop"
      sheetTitle={index >= 0 ? `Stop ${index + 1} of ${count}` : undefined}
    >
      <StopDetails />
    </ChevronRow>
  );
}
