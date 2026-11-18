/**
 * The extraction settings under the image (spec 2.4; M1 decision 5): Algorithm, Colors (slider and
 * number field) and Working space, then the collapsed Filters row (M2-T8) and the collapsed
 * Advanced row (spec 6.6 rule 2) with Sample size, Resampling, Seed with Randomize, Iterations,
 * Restarts, Histogram bits, Merge threshold, Distance metric, Population vs. vividness, Keep one
 * outlier and Sort (M2-T7). Every change re-extracts live (spec 1, 7.4).
 */
import { ChevronDown, ChevronRight } from "lucide-preact";
import { useState } from "preact/hooks";
import { type SettingKey, settingApplies, settingNote } from "../extract/applicability";
import { AVAILABLE_ALGORITHMS } from "../extract/pipeline";
import { clampColors, MAX_COLORS, MIN_COLORS } from "../state/defaults";
import { initialOpenRows, settings } from "../state/signals";
import type {
  Algorithm,
  DistanceMetric,
  ExtractionSettings,
  HistogramBits,
  Resampling,
  SampleSize,
  SortOrder,
  WorkingSpace,
} from "../types";
import { DecimalField } from "./DecimalField";
import { SettingRow } from "./SettingRow";
import { Toggle } from "./Toggle";

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

const SAMPLE_SIZES: SampleSize[] = [64, 128, 256, 512, "full"];
const RESAMPLING_LABELS: Record<Resampling, string> = { smooth: "Smooth", nearest: "Nearest" };
const HISTOGRAM_BITS: HistogramBits[] = [4, 5, 6];
const METRIC_LABELS: Record<DistanceMetric, string> = { ok: "ΔE OK", ciede2000: "CIEDE2000" };
const SORT_LABELS: Record<SortOrder, string> = {
  population: "Population",
  lightness: "Lightness",
  chroma: "Chroma",
  hue: "Hue",
  extracted: "As extracted",
};

/**
 * Merge threshold (spec 2.4): stored in ΔE OK units, 0 to 0.15. Under CIEDE2000 it reads ×100 in
 * ΔE00 units, 0 to 15, so the default 0.03 shows as 3.0 (M2 decision 7).
 */
const MERGE_MAX = 0.15;
const mergeScale = (metric: DistanceMetric): number => (metric === "ciede2000" ? 100 : 1);

function update<K extends keyof ExtractionSettings>(key: K, value: ExtractionSettings[K]): void {
  if (settings.peek()[key] === value) return;
  settings.value = { ...settings.peek(), [key]: value };
}

interface Option<T> {
  value: T;
  label: string;
  disabled?: boolean;
}

function Select<T extends string | number>({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: T;
  options: ReadonlyArray<Option<T>>;
  onChange: (value: T) => void;
}) {
  return (
    <span class="select">
      <select
        id={id}
        class="select__control"
        value={String(value)}
        onChange={(event) => {
          const raw = event.currentTarget.value;
          const option = options.find((o) => String(o.value) === raw);
          if (option) onChange(option.value);
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown class="select__chevron" size={16} strokeWidth={1.5} aria-hidden="true" />
    </span>
  );
}

/** A number field that accepts typing freely and commits valid integers in range. */
function NumberField({
  id,
  value,
  min,
  max,
  label,
  disabled = false,
  describedBy,
  onCommit,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  label?: string;
  disabled?: boolean;
  describedBy?: string | undefined;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const parse = (raw: string): number | null => {
    const n = Number(raw.trim());
    return raw.trim() !== "" && Number.isInteger(n) && n >= min && n <= max ? n : null;
  };
  const onInput = (event: Event) => {
    const raw = (event.currentTarget as HTMLInputElement).value;
    setText(raw);
    const n = parse(raw);
    if (n !== null) onCommit(n);
  };
  return (
    <input
      id={id}
      class="number-field"
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={1}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      value={text ?? String(value)}
      onInput={onInput}
      onChange={(event) => {
        // On commit (blur or Enter), clamp out-of-range numbers instead of dropping them.
        const n = Number((event.currentTarget as HTMLInputElement).value.trim());
        if (Number.isFinite(n) && (event.currentTarget as HTMLInputElement).value.trim() !== "") {
          onCommit(Math.min(max, Math.max(min, Math.round(n))));
        }
        setText(null);
      }}
      onBlur={() => setText(null)}
    />
  );
}

/**
 * Whether a setting applies to the algorithm, for a row's controls (M1 decision 14). Its "Used by …"
 * or "Not used by …" note shows only while the controls are disabled (M2 decision 14b).
 */
function applicability(key: SettingKey, algorithm: Algorithm, noteId: string) {
  const enabled = settingApplies(key, algorithm);
  const note = enabled ? null : settingNote(key);
  return { enabled, note, noteId, describedBy: note ? noteId : undefined };
}

export function SettingsControls() {
  const s = settings.value;
  // Decision 14: settings that don't apply to the algorithm are disabled, not hidden, and keep their values.
  const seedApplies = settingApplies("seed", s.algorithm);
  // The note shows only while Seed is disabled (M2 decision 14b).
  const seedNote = seedApplies ? null : settingNote("seed");
  // Swatch roles ignore Colors (M2 decision 10c). The note shows only while it doesn't apply, so
  // the always-visible rows keep the mockup layout.
  const colorsApplies = settingApplies("colors", s.algorithm);
  const colorsNote = colorsApplies ? null : settingNote("colors");
  const algorithms: Array<Option<Algorithm>> = AVAILABLE_ALGORITHMS.map((a) => ({
    value: a,
    label: ALGORITHM_LABELS[a],
  }));
  // An algorithm that isn't built yet stays visible, but not selectable, if the settings name it.
  if (!algorithms.some((a) => a.value === s.algorithm)) {
    algorithms.unshift({
      value: s.algorithm,
      label: ALGORITHM_LABELS[s.algorithm],
      disabled: true,
    });
  }
  return (
    <div class="setting-rows" data-testid="setting-rows">
      <SettingRow label="Algorithm" htmlFor="setting-algorithm">
        <Select
          id="setting-algorithm"
          value={s.algorithm}
          options={algorithms}
          onChange={(v) => update("algorithm", v)}
        />
      </SettingRow>
      <SettingRow
        label="Colors"
        htmlFor="setting-colors"
        note={colorsNote}
        noteId="setting-colors-note"
      >
        <span class="slider-group">
          <input
            class="slider"
            type="range"
            min={MIN_COLORS}
            max={MAX_COLORS}
            step={1}
            value={s.colors}
            aria-label="Colors slider"
            disabled={!colorsApplies}
            aria-describedby={colorsNote ? "setting-colors-note" : undefined}
            onInput={(event) => update("colors", clampColors(Number(event.currentTarget.value)))}
          />
          <NumberField
            id="setting-colors"
            value={s.colors}
            min={MIN_COLORS}
            max={MAX_COLORS}
            disabled={!colorsApplies}
            describedBy={colorsNote ? "setting-colors-note" : undefined}
            onCommit={(v) => update("colors", clampColors(v))}
          />
        </span>
      </SettingRow>
      <SettingRow label="Working space" htmlFor="setting-space">
        <Select
          id="setting-space"
          value={s.workingSpace}
          options={(Object.keys(WORKING_SPACE_LABELS) as WorkingSpace[]).map((w) => ({
            value: w,
            label: WORKING_SPACE_LABELS[w],
          }))}
          onChange={(v) => update("workingSpace", v)}
        />
      </SettingRow>
      <FiltersRow s={s} />
      <details class="chevron-row" open={initialOpenRows.peek().includes("advanced")}>
        <summary class="chevron-row__summary">
          <span>Advanced</span>
          <ChevronRight
            class="chevron-row__chevron"
            size={16}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </summary>
        <SettingRow label="Sample size" htmlFor="setting-sample-size">
          <Select
            id="setting-sample-size"
            value={s.sampleSize}
            options={SAMPLE_SIZES.map((v) => ({
              value: v,
              label: v === "full" ? "Full" : `${v} px`,
            }))}
            onChange={(v) => update("sampleSize", v)}
          />
        </SettingRow>
        <SettingRow label="Resampling" htmlFor="setting-resampling">
          <Select
            id="setting-resampling"
            value={s.resampling}
            options={(Object.keys(RESAMPLING_LABELS) as Resampling[]).map((r) => ({
              value: r,
              label: RESAMPLING_LABELS[r],
            }))}
            onChange={(v) => update("resampling", v)}
          />
        </SettingRow>
        <SettingRow label="Seed" htmlFor="setting-seed" note={seedNote} noteId="setting-seed-note">
          <span class="slider-group">
            <NumberField
              id="setting-seed"
              value={s.seed}
              min={0}
              max={2147483647}
              disabled={!seedApplies}
              describedBy={seedNote ? "setting-seed-note" : undefined}
              onCommit={(v) => update("seed", v)}
            />
            <button
              type="button"
              class="pill-button"
              disabled={!seedApplies}
              aria-describedby={seedNote ? "setting-seed-note" : undefined}
              onClick={() => update("seed", 1 + Math.floor(Math.random() * 2147483646))}
            >
              Randomize
            </button>
          </span>
        </SettingRow>
        <AdvancedRows s={s} />
      </details>
    </div>
  );
}

/** OKLab L thresholds for ignore dark and light: the whole L range (M2 decision 3). */
const L_MIN = 0;
const L_MAX = 1;
const L_STEP = 0.01;
/** Minimum chroma, OKLab C 0 to 0.2 (spec 2.4). */
const CHROMA_MAX = 0.2;
const CHROMA_STEP = 0.01;
/** Alpha cutoff, 0 to 255 (spec 2.4). */
const ALPHA_MAX = 255;

/** A slider with a decimal field beside it (ui-contract Components "Slider"). */
function DecimalSlider({
  id,
  label,
  value,
  min,
  max,
  step,
  decimals = 2,
  disabled = false,
  describedBy,
  onCommit,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Digits the field shows after the period. */
  decimals?: number;
  disabled?: boolean;
  describedBy?: string | undefined;
  onCommit: (value: number) => void;
}) {
  return (
    <span class="slider-group">
      <input
        class="slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={`${label} slider`}
        aria-valuetext={value.toFixed(decimals)}
        aria-describedby={describedBy}
        onInput={(event) => onCommit(Number(event.currentTarget.value))}
      />
      <DecimalField
        id={id}
        value={value}
        min={min}
        max={max}
        step={step}
        decimals={decimals}
        disabled={disabled}
        describedBy={describedBy}
        onCommit={onCommit}
      />
    </span>
  );
}

/**
 * The collapsed Filters row after Working space (M2 decision 2b; spec 2.1 step 3, 2.4): ignore
 * dark and light, each a toggle with its OKLab L threshold, then minimum chroma and the alpha
 * cutoff. A threshold stays visible but disabled while its toggle is off, and keeps its value
 * (M1 decision 14). Filters apply to every algorithm.
 */
function FiltersRow({ s }: { s: ExtractionSettings }) {
  return (
    <details
      class="chevron-row"
      data-testid="filters-row"
      open={initialOpenRows.peek().includes("filters")}
    >
      <summary class="chevron-row__summary">
        <span>Filters</span>
        <ChevronRight class="chevron-row__chevron" size={16} strokeWidth={1.5} aria-hidden="true" />
      </summary>
      <SettingRow label="Ignore dark" htmlFor="setting-ignore-dark">
        <Toggle
          id="setting-ignore-dark"
          checked={s.ignoreDark.on}
          onChange={(on) => update("ignoreDark", { ...s.ignoreDark, on })}
        />
      </SettingRow>
      <SettingRow label="Dark threshold" htmlFor="setting-dark-threshold">
        <DecimalSlider
          id="setting-dark-threshold"
          label="Dark threshold"
          value={s.ignoreDark.threshold}
          min={L_MIN}
          max={L_MAX}
          step={L_STEP}
          disabled={!s.ignoreDark.on}
          onCommit={(threshold) => update("ignoreDark", { ...s.ignoreDark, threshold })}
        />
      </SettingRow>
      <SettingRow label="Ignore light" htmlFor="setting-ignore-light">
        <Toggle
          id="setting-ignore-light"
          checked={s.ignoreLight.on}
          onChange={(on) => update("ignoreLight", { ...s.ignoreLight, on })}
        />
      </SettingRow>
      <SettingRow label="Light threshold" htmlFor="setting-light-threshold">
        <DecimalSlider
          id="setting-light-threshold"
          label="Light threshold"
          value={s.ignoreLight.threshold}
          min={L_MIN}
          max={L_MAX}
          step={L_STEP}
          disabled={!s.ignoreLight.on}
          onCommit={(threshold) => update("ignoreLight", { ...s.ignoreLight, threshold })}
        />
      </SettingRow>
      <SettingRow label="Minimum chroma" htmlFor="setting-min-chroma">
        <DecimalSlider
          id="setting-min-chroma"
          label="Minimum chroma"
          value={s.minChroma}
          min={0}
          max={CHROMA_MAX}
          step={CHROMA_STEP}
          onCommit={(v) => update("minChroma", v)}
        />
      </SettingRow>
      <SettingRow label="Alpha cutoff" htmlFor="setting-alpha-cutoff">
        <span class="slider-group">
          <input
            class="slider"
            type="range"
            min={0}
            max={ALPHA_MAX}
            step={1}
            value={s.alphaCutoff}
            aria-label="Alpha cutoff slider"
            onInput={(event) => update("alphaCutoff", Number(event.currentTarget.value))}
          />
          <NumberField
            id="setting-alpha-cutoff"
            value={s.alphaCutoff}
            min={0}
            max={ALPHA_MAX}
            onCommit={(v) => update("alphaCutoff", v)}
          />
        </span>
      </SettingRow>
    </details>
  );
}

/**
 * The Advanced rows after Seed (M2-T7). Spatial weighting joins them in M2-T9. Histogram bits,
 * Distance metric and Sort apply to every algorithm built so far, so only the other rows read the
 * applicability tables.
 */
function AdvancedRows({ s }: { s: ExtractionSettings }) {
  const iterations = applicability("iterations", s.algorithm, "setting-iterations-note");
  const restarts = applicability("restarts", s.algorithm, "setting-restarts-note");
  const merge = applicability("mergeThreshold", s.algorithm, "setting-merge-note");
  const vividness = applicability("vividness", s.algorithm, "setting-vividness-note");
  const outlier = applicability("keepOutlier", s.algorithm, "setting-outlier-note");
  const scale = mergeScale(s.distanceMetric);
  const ciede = s.distanceMetric === "ciede2000";
  const mergeStep = 0.005 * scale;
  const commitMerge = (shown: number) =>
    update("mergeThreshold", Math.min(MERGE_MAX, Math.max(0, Number((shown / scale).toFixed(6)))));
  return (
    <>
      <SettingRow
        label="Iterations"
        htmlFor="setting-iterations"
        note={iterations.note}
        noteId={iterations.noteId}
      >
        <NumberField
          id="setting-iterations"
          value={s.iterations}
          min={5}
          max={100}
          disabled={!iterations.enabled}
          describedBy={iterations.describedBy}
          onCommit={(v) => update("iterations", v)}
        />
      </SettingRow>
      <SettingRow
        label="Restarts"
        htmlFor="setting-restarts"
        note={restarts.note}
        noteId={restarts.noteId}
      >
        <NumberField
          id="setting-restarts"
          value={s.restarts}
          min={1}
          max={10}
          disabled={!restarts.enabled}
          describedBy={restarts.describedBy}
          onCommit={(v) => update("restarts", v)}
        />
      </SettingRow>
      <SettingRow label="Histogram bits" htmlFor="setting-histogram-bits">
        <Select
          id="setting-histogram-bits"
          value={s.histogramBits}
          options={HISTOGRAM_BITS.map((b) => ({ value: b, label: String(b) }))}
          onChange={(v) => update("histogramBits", v)}
        />
      </SettingRow>
      <SettingRow
        label="Merge threshold"
        htmlFor="setting-merge"
        note={merge.note}
        noteId={merge.noteId}
      >
        <DecimalSlider
          id="setting-merge"
          label="Merge threshold"
          value={s.mergeThreshold * scale}
          min={0}
          max={MERGE_MAX * scale}
          step={mergeStep}
          decimals={ciede ? 1 : 3}
          disabled={!merge.enabled}
          describedBy={merge.describedBy}
          onCommit={commitMerge}
        />
      </SettingRow>
      <SettingRow label="Distance metric" htmlFor="setting-metric">
        <Select
          id="setting-metric"
          value={s.distanceMetric}
          options={(Object.keys(METRIC_LABELS) as DistanceMetric[]).map((m) => ({
            value: m,
            label: METRIC_LABELS[m],
          }))}
          onChange={(v) => update("distanceMetric", v)}
        />
      </SettingRow>
      <SettingRow
        label="Population vs. vividness"
        htmlFor="setting-vividness"
        note={vividness.note}
        noteId={vividness.noteId}
      >
        <DecimalSlider
          id="setting-vividness"
          label="Population vs. vividness"
          value={s.vividness}
          min={0}
          max={1}
          step={0.05}
          disabled={!vividness.enabled}
          describedBy={vividness.describedBy}
          onCommit={(value) => update("vividness", value)}
        />
      </SettingRow>
      <SettingRow
        label="Keep one outlier"
        htmlFor="setting-outlier"
        note={outlier.note}
        noteId={outlier.noteId}
      >
        <Toggle
          id="setting-outlier"
          checked={s.keepOutlier}
          disabled={!outlier.enabled}
          describedBy={outlier.describedBy}
          onChange={(v) => update("keepOutlier", v)}
        />
      </SettingRow>
      <SettingRow label="Sort" htmlFor="setting-sort">
        <Select
          id="setting-sort"
          value={s.sort}
          options={(Object.keys(SORT_LABELS) as SortOrder[]).map((o) => ({
            value: o,
            label: SORT_LABELS[o],
          }))}
          onChange={(v) => update("sort", v)}
        />
      </SettingRow>
    </>
  );
}
