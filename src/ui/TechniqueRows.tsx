/**
 * The Technique setting row and its parameter rows (ui-contract column 3 item 4; spec 4.2; plan Q1,
 * D13 to D19): the technique, the Colors subset (Q1b), and the rows of the chosen technique only
 * (6.6 rule 2). The stops follow the technique until a hand edit makes them Custom; the ↺ icon
 * rebuilds them (Q1a, D19). Every change is one undo step. Image sample scans through the worker
 * (`state/image-sample.ts`); its thumbnail is `ImageSampleThumb`.
 */
import { ChevronDown, RotateCcw, Shuffle } from "lucide-preact";
import { useEffect, useId, useState } from "preact/hooks";
import { oklchToHex } from "../color/convert";
import { thresholdFor } from "../color/delta-e";
import { constrainedRandom } from "../gradient/order";
import { techniqueSwatches } from "../gradient/sources";
import { swatchLabel } from "../palette/model";
import { effectiveStops, rebuildFromTechnique, selectStop } from "../state/gradient";
import { begin, end } from "../state/history";
import {
  changeTechnique,
  endWhenIdle,
  isMarkerMode,
  startImageSampling,
} from "../state/image-sample";
import {
  displayImage,
  gradient,
  imageSrc,
  masterThread,
  outputPalette,
  selectedStopId,
  selectedSwatchId,
  settings,
} from "../state/signals";
import type { SortBy, Swatch, Technique, TechniqueKind } from "../types";
import { ImageSampleThumb } from "./ImageSampleThumb";
import { SettingRow } from "./SettingRow";
import { Slider } from "./Slider";

/** The names the Technique select shows. Random is "Constrained random" here (spec 4.2). */
const KIND_LABELS: Record<TechniqueKind, string> = {
  "palette-order": "Palette order",
  sorted: "Sorted",
  "smooth-path": "Smooth path",
  "image-sample": "Image sample",
  derived: "Derived",
  random: "Constrained random",
  population: "Population-weighted",
};

const KINDS: readonly TechniqueKind[] = [
  "palette-order",
  "sorted",
  "smooth-path",
  "image-sample",
  "derived",
  "random",
  "population",
];

/** The techniques that take the Colors subset (plan Q1b). */
const PALETTE_BASED: ReadonlySet<TechniqueKind> = new Set([
  "palette-order",
  "sorted",
  "smooth-path",
  "random",
  "population",
]);

const SORT_LABELS: Record<SortBy, string> = {
  lightness: "Lightness",
  hue: "Hue",
  chroma: "Chroma",
};

const DERIVE_LABELS: Record<Technique["derive"]["kind"], string> = {
  analogous: "Analogous",
  complementary: "Complementary",
  monochrome: "Monochrome",
  "warm-cool": "Warm to cool",
};

const SAMPLE_MODE_LABELS: Record<Technique["sample"]["mode"], string> = {
  line: "Line",
  horizontal: "Horizontal",
  vertical: "Vertical",
  radial: "Radial",
  "markers-x": "Markers by x",
  "markers-y": "Markers by y",
};

const MIN_PICKED = 2;
const MAX_SAMPLES = 12;
const MAX_MIN_DELTA_E = 0.3;
const MAX_MIN_CONTRAST = 7;

/** A select with an optional disabled state and disabled options (the shared `Select` has none). */
function TechSelect<T extends string>({
  id,
  value,
  options,
  disabled = false,
  describedBy,
  onChange,
}: {
  id: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; disabled?: boolean }>;
  disabled?: boolean;
  describedBy?: string | undefined;
  onChange: (value: T) => void;
}) {
  return (
    <span class="select">
      <select
        id={id}
        class="select__control"
        value={value}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(event) => {
          const picked = options.find((o) => o.value === event.currentTarget.value);
          if (picked) onChange(picked.value);
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown class="select__chevron" size={16} strokeWidth={1.5} aria-hidden="true" />
    </span>
  );
}

const update = (patch: Partial<Technique>, label: string): void =>
  changeTechnique({ ...gradient.peek().technique, ...patch }, label);

/** A slider whose drag is one undo step, ended once any scan it caused has landed. */
function stepDrag(label: string) {
  return { onDragStart: begin, onDragEnd: () => endWhenIdle(end, label) };
}

// Technique row

function chooseKind(kind: TechniqueKind): void {
  const g = gradient.peek();
  let next: Technique = { ...g.technique, kind };
  if (kind === "derived") {
    // The base is the selected swatch, or the first one (plan D17).
    const swatches = outputPalette.peek();
    const keep = swatches.some((s) => s.id === next.derive.from);
    const selected = swatches.find((s) => s.id === selectedSwatchId.peek());
    const from = keep ? next.derive.from : ((selected ?? swatches[0])?.id ?? null);
    next = { ...next, derive: { ...next.derive, from } };
  }
  changeTechnique(next, "Technique");
}

function TechniqueRow() {
  const g = gradient.value;
  const id = useId();
  const custom = g.custom;
  const kind = g.technique.kind;
  const name = KIND_LABELS[kind];
  const options: Array<{ value: TechniqueKind | "custom"; label: string; disabled?: boolean }> =
    KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] }));
  if (custom) options.unshift({ value: "custom", label: "Custom", disabled: true });
  return (
    <SettingRow
      label="Technique"
      htmlFor={id}
      reset={
        custom ? (
          <button
            type="button"
            class="reset-icon"
            data-testid="technique-rebuild"
            aria-label={`Rebuild from ${name}`}
            onClick={rebuildFromTechnique}
          >
            <RotateCcw aria-hidden="true" size={18} strokeWidth={1.5} />
          </button>
        ) : undefined
      }
    >
      <TechSelect<TechniqueKind | "custom">
        id={id}
        value={custom ? "custom" : kind}
        options={options}
        onChange={(v) => {
          if (v !== "custom") chooseKind(v);
        }}
      />
      {/* The current value as text, for tests and for readers that skip the select. */}
      <span class="visually-hidden" data-testid="technique-value" aria-hidden="true">
        {custom ? "Custom" : name}
      </span>
    </SettingRow>
  );
}

// Colors (plan Q1b)

function SwatchChip({
  swatch,
  label,
  pressed,
  role,
  onClick,
}: {
  swatch: Swatch;
  label: string;
  pressed: boolean;
  role?: "radio";
  onClick: () => void;
}) {
  const state = role === "radio" ? { role, "aria-checked": pressed } : { "aria-pressed": pressed };
  return (
    <button
      type="button"
      class="technique-chip"
      data-user-content=""
      data-testid="technique-chip"
      aria-label={label}
      style={{ background: oklchToHex(swatch.color) }}
      onClick={onClick}
      {...state}
    />
  );
}

function PickedChips({ t }: { t: Technique }) {
  const swatches = outputPalette.value;
  const [refused, setRefused] = useState(false);
  const picked = swatches.filter((s) => t.colors.ids.includes(s.id));
  const toggle = (id: string): void => {
    const on = picked.some((s) => s.id === id);
    if (on && picked.length <= Math.min(MIN_PICKED, swatches.length)) {
      setRefused(true);
      return;
    }
    setRefused(false);
    const ids = on
      ? picked.filter((s) => s.id !== id).map((s) => s.id)
      : [...picked.map((s) => s.id), id];
    // Keep the palette's order, which the stops follow.
    const ordered = swatches.filter((s) => ids.includes(s.id)).map((s) => s.id);
    update({ colors: { ...t.colors, ids: ordered } }, "Colors");
  };
  return (
    <>
      <fieldset class="technique-chips">
        <legend class="visually-hidden">Picked colors</legend>
        {swatches.map((s) => (
          <SwatchChip
            key={s.id}
            swatch={s}
            label={swatchLabel(swatches, s.id)}
            pressed={picked.some((p) => p.id === s.id)}
            onClick={() => toggle(s.id)}
          />
        ))}
      </fieldset>
      <p class="hint technique-note" role="status" aria-live="polite" data-testid="picked-note">
        {refused ? "Keep at least 2 colors." : "Pick at least 2 colors."}
      </p>
    </>
  );
}

function ColorsRows({ t }: { t: Technique }) {
  const id = useId();
  const swatches = outputPalette.value;
  const mode = t.colors.mode;
  return (
    <>
      <SettingRow label="Colors" htmlFor={id}>
        <TechSelect<Technique["colors"]["mode"]>
          id={id}
          value={mode}
          options={[
            { value: "all", label: "All" },
            { value: "distinct", label: "Most distinct" },
            { value: "picked", label: "Picked" },
          ]}
          onChange={(next) => {
            if (next === mode) return;
            // Picking starts from the whole palette, or from what was picked before.
            const known = swatches.filter((s) => t.colors.ids.includes(s.id)).map((s) => s.id);
            const ids = known.length >= MIN_PICKED ? known : swatches.map((s) => s.id);
            update({ colors: { ...t.colors, mode: next, ids } }, "Colors");
          }}
        />
      </SettingRow>
      {mode === "distinct" && (
        <SettingRow label="Count" htmlFor={`${id}-count`}>
          <Slider
            id={`${id}-count`}
            label="Distinct colors"
            value={Math.min(
              Math.max(t.colors.count, MIN_PICKED),
              Math.max(MIN_PICKED, swatches.length),
            )}
            min={MIN_PICKED}
            max={Math.max(MIN_PICKED, swatches.length)}
            onChange={(count) => update({ colors: { ...t.colors, count } }, "Colors")}
            deferred
            {...stepDrag("Colors")}
          />
        </SettingRow>
      )}
      {mode === "picked" && <PickedChips t={t} />}
    </>
  );
}

// Sorted

function SortedRows({ t }: { t: Technique }) {
  const id = useId();
  return (
    <SettingRow label="By" htmlFor={id}>
      <TechSelect<SortBy>
        id={id}
        value={t.sortBy}
        options={(Object.keys(SORT_LABELS) as SortBy[]).map((v) => ({
          value: v,
          label: SORT_LABELS[v],
        }))}
        onChange={(sortBy) => update({ sortBy }, "Sort by")}
      />
    </SettingRow>
  );
}

// Constrained random

function RandomRows({ t }: { t: Technique }) {
  const id = useId();
  const metric = settings.value.distanceMetric;
  const scale = thresholdFor(metric, 1);
  const decimals = scale === 1 ? 2 : 1;
  const swatches = techniqueSwatches(t, outputPalette.value);
  const met = constrainedRandom(
    swatches.map((s) => s.color),
    t.seed,
    t.minDeltaE,
    t.minContrast,
    metric,
  ).met;
  return (
    <>
      <SettingRow label="Min ΔE" htmlFor={`${id}-de`}>
        <Slider
          id={`${id}-de`}
          label="Min ΔE"
          value={Number((t.minDeltaE * scale).toFixed(decimals))}
          min={0}
          max={MAX_MIN_DELTA_E * scale}
          step={0.01 * scale}
          decimals={decimals}
          onChange={(shown) => update({ minDeltaE: Number((shown / scale).toFixed(6)) }, "Min ΔE")}
          deferred
          {...stepDrag("Min ΔE")}
        />
      </SettingRow>
      <SettingRow label="Min contrast" htmlFor={`${id}-contrast`}>
        <Slider
          id={`${id}-contrast`}
          label="Min contrast"
          value={t.minContrast}
          min={1}
          max={MAX_MIN_CONTRAST}
          step={0.1}
          decimals={1}
          onChange={(minContrast) => update({ minContrast }, "Min contrast")}
          deferred
          {...stepDrag("Min contrast")}
        />
      </SettingRow>
      <SettingRow
        label="Shuffle"
        live
        note={met ? null : "Constraints can't all be met."}
        noteId={`${id}-met`}
      >
        <button
          type="button"
          class="icon-pill"
          data-testid="technique-shuffle"
          aria-label="Shuffle order"
          onClick={() => update({ seed: t.seed + 1 }, "Shuffle")}
        >
          <Shuffle aria-hidden="true" size={18} strokeWidth={1.5} />
        </button>
      </SettingRow>
    </>
  );
}

// Derived

function DerivedRows({ t }: { t: Technique }) {
  const id = useId();
  const swatches = outputPalette.value;
  const base = swatches.some((s) => s.id === t.derive.from) ? t.derive.from : swatches[0]?.id;
  return (
    <>
      <SettingRow label="Kind" htmlFor={id}>
        <TechSelect<Technique["derive"]["kind"]>
          id={id}
          value={t.derive.kind}
          options={(Object.keys(DERIVE_LABELS) as Array<Technique["derive"]["kind"]>).map((v) => ({
            value: v,
            label: DERIVE_LABELS[v],
          }))}
          onChange={(kind) => update({ derive: { ...t.derive, kind } }, "Derived kind")}
        />
      </SettingRow>
      <SettingRow label="From">
        <span>{swatchLabel(swatches, base ?? null)}</span>
      </SettingRow>
      <div class="technique-chips" role="radiogroup" aria-label="Derive from swatch">
        {swatches.map((s) => (
          <SwatchChip
            key={s.id}
            swatch={s}
            role="radio"
            label={swatchLabel(swatches, s.id)}
            pressed={s.id === base}
            onClick={() => update({ derive: { ...t.derive, from: s.id } }, "Derive from")}
          />
        ))}
      </div>
    </>
  );
}

// Image sample

function SampleRows({ t }: { t: Technique }) {
  const id = useId();
  const hasImage =
    displayImage.value !== null || masterThread.value !== null || imageSrc.value !== null;
  const { mode, count } = t.sample;
  const note = hasImage ? null : "Needs an image.";
  return (
    <>
      <SettingRow
        label="Mode"
        htmlFor={id}
        note={note}
        noteId={`${id}-note`}
        live
        disabled={!hasImage}
      >
        <TechSelect<Technique["sample"]["mode"]>
          id={id}
          value={mode}
          disabled={!hasImage}
          describedBy={note ? `${id}-note` : undefined}
          options={(Object.keys(SAMPLE_MODE_LABELS) as Array<Technique["sample"]["mode"]>).map(
            (v) => ({ value: v, label: SAMPLE_MODE_LABELS[v] }),
          )}
          onChange={(next) => update({ sample: { ...t.sample, mode: next } }, "Sample mode")}
        />
      </SettingRow>
      {!isMarkerMode(mode) && (
        <SettingRow label="Count" htmlFor={`${id}-count`} disabled={!hasImage}>
          <Slider
            id={`${id}-count`}
            label="Sample count"
            value={count}
            min={2}
            max={MAX_SAMPLES}
            disabled={!hasImage}
            onChange={(next) => update({ sample: { ...t.sample, count: next } }, "Sample count")}
            deferred
            {...stepDrag("Sample count")}
          />
        </SettingRow>
      )}
      {hasImage && <ImageSampleThumb />}
    </>
  );
}

// Default selection (orchestrator follow-up from T8): a gradient always has a stop selected.

function useDefaultStop(): void {
  const stops = effectiveStops.value;
  const selected = selectedStopId.value;
  useEffect(() => {
    const first = stops[0];
    if (first && !stops.some((s) => s.id === selected)) selectStop(first.id);
  }, [stops, selected]);
}

export function TechniqueRows() {
  const t = gradient.value.technique;
  useEffect(() => startImageSampling(), []);
  useDefaultStop();
  return (
    <>
      <TechniqueRow />
      {PALETTE_BASED.has(t.kind) && <ColorsRows t={t} />}
      {t.kind === "sorted" && <SortedRows t={t} />}
      {t.kind === "random" && <RandomRows t={t} />}
      {t.kind === "derived" && <DerivedRows t={t} />}
      {t.kind === "image-sample" && <SampleRows t={t} />}
    </>
  );
}
