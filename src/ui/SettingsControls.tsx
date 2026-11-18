/**
 * The extraction settings under the image (spec 2.4; M1 decision 5): Algorithm, Colors (slider and
 * number field) and Working space, then a collapsed Advanced row with Sample size, Resampling, and
 * Seed with Randomize (spec 6.6 rule 2). Every change re-extracts live (spec 1, 7.4).
 */
import { ChevronDown, ChevronRight } from "lucide-preact";
import { useState } from "preact/hooks";
import { settingApplies, settingNote } from "../extract/applicability";
import { AVAILABLE_ALGORITHMS } from "../extract/pipeline";
import { clampColors, MAX_COLORS, MIN_COLORS } from "../state/defaults";
import { settings } from "../state/signals";
import type { Algorithm, ExtractionSettings, Resampling, SampleSize, WorkingSpace } from "../types";
import { SettingRow } from "./SettingRow";

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

export function SettingsControls() {
  const s = settings.value;
  // Decision 14: settings that don't apply to the algorithm are disabled, not hidden, and keep their values.
  const seedApplies = settingApplies("seed", s.algorithm);
  const seedNote = settingNote("seed");
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
      <SettingRow label="Colors" htmlFor="setting-colors">
        <span class="slider-group">
          <input
            class="slider"
            type="range"
            min={MIN_COLORS}
            max={MAX_COLORS}
            step={1}
            value={s.colors}
            aria-label="Colors slider"
            onInput={(event) => update("colors", clampColors(Number(event.currentTarget.value)))}
          />
          <NumberField
            id="setting-colors"
            value={s.colors}
            min={MIN_COLORS}
            max={MAX_COLORS}
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
      <details class="chevron-row">
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
      </details>
    </div>
  );
}
