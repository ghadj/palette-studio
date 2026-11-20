/**
 * The Swatch row's content (M3 decision 5a): expands in place under the editor on desktop, and is
 * the swatch sheet on phones (spec 6.1). For the selected swatch it holds (spec 3.2, 3.7; plan T4):
 * a format choice (HEX, RGB, HSL, OKLCH) with editable fields, Name with the nearest CSS color name
 * as a chip (D15), a copy icon beside the color code (D14; decision 39: no Duplicate or Delete here,
 * the strip's X removes a swatch, decision 38), Reset to extracted with the
 * ΔE (D13), the sample radius and Mean or Median (D8), and the Cluster map toggle, which shows on
 * desktop too (D21; it was phone-only in M2, decisions 13d and 13f). M3-T13 adds Place on image.
 *
 * The fields show the displayed (output) color, like the strip, Copy and the color editor. An edit
 * sets the base color and pins the swatch (decision 24).
 * Edits commit on Enter or blur (D16).
 * Every button here is one undo step.
 */
import { batch, signal } from "@preact/signals";
import { Copy } from "lucide-preact";
import type { ComponentChildren } from "preact";
import { useId, useLayoutEffect, useState } from "preact/hooks";
import { bytesToOklch, hslIntsToOklch, oklchToBytes, oklchToHslInts } from "../color/bytes";
import { hexToOklch, type Oklch, oklchToOklab } from "../color/convert";
import { nearestCssName } from "../color/css-names";
import { deltaE } from "../color/delta-e";
import { parseHex } from "../color/hex";
import { formatHsl, formatNumber, formatOklch, formatRgb } from "../export/format";
import {
  FULL_MESSAGE,
  renameSwatch,
  resetToExtracted,
  selectedSwatch,
  setPinned,
  setSwatchColor,
  swatchHex,
} from "../palette/model";
import { clusterPinned, clusterToggle } from "../state/cluster";
import { placeOnImage } from "../state/extraction";
import { commit } from "../state/history";
import { changeSampling } from "../state/resample";
import {
  displayImage,
  masterThread,
  outputPalette,
  palette,
  selectedSwatchId,
  settings,
} from "../state/signals";
import type { SampleRadius, SampleStat, Swatch } from "../types";
import { SettingRow } from "./SettingRow";
import { showToast } from "./Toast";
import { Toggle } from "./Toggle";

export type SwatchFormat = "hex" | "rgb" | "hsl" | "oklch";

const FORMATS: ReadonlyArray<{ id: SwatchFormat; label: string }> = [
  { id: "hex", label: "HEX" },
  { id: "rgb", label: "RGB" },
  { id: "hsl", label: "HSL" },
  { id: "oklch", label: "OKLCH" },
];

/** The format of the fields and of Copy; kept while the row is closed and reopened. */
export const swatchFormat = signal<SwatchFormat>("hex");

const RADII: ReadonlyArray<{ value: SampleRadius; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: 1, label: "1" },
  { value: 3, label: "3" },
  { value: 5, label: "5" },
  { value: 11, label: "11" },
];

export { FULL_MESSAGE };

/** What each field of a format shows, how it is typed in and what it commits. */
interface Channel {
  label: string;
  text: string;
  /** The new base color for typed text, or null when it isn't valid. */
  apply: (raw: string) => Oklch | null;
}

const wholeNumber = (raw: string, min: number, max: number): number | null => {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= min && n <= max ? n : null;
};

const decimal = (raw: string, min: number, max: number): number | null => {
  const text = raw.trim().replace(",", ".");
  if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) return null;
  const n = Number(text);
  return n >= min && n <= max ? n : null;
};

function channels(format: SwatchFormat, color: Oklch): Channel[] {
  if (format === "rgb") {
    const bytes = oklchToBytes(color);
    return (["R", "G", "B"] as const).map((label, i) => ({
      label,
      text: String(bytes[i]),
      apply: (raw) => {
        const n = wholeNumber(raw, 0, 255);
        if (n === null) return null;
        const next: [number, number, number] = [...bytes];
        next[i] = n;
        return bytesToOklch(next);
      },
    }));
  }
  if (format === "hsl") {
    const hsl = oklchToHslInts(color);
    const max = [360, 100, 100] as const;
    return (["H", "S", "L"] as const).map((label, i) => ({
      label,
      text: String(hsl[i]),
      apply: (raw) => {
        const n = wholeNumber(raw, 0, max[i] ?? 100);
        if (n === null) return null;
        const next: [number, number, number] = [...hsl];
        next[i] = n;
        return hslIntsToOklch(next);
      },
    }));
  }
  const parts: Array<{ label: string; key: keyof Oklch; digits: number; max: number }> = [
    { label: "L", key: "l", digits: 3, max: 1 },
    { label: "C", key: "c", digits: 3, max: 0.5 },
    { label: "H", key: "h", digits: 1, max: 360 },
  ];
  return parts.map((p) => ({
    label: p.label,
    text: formatNumber(color[p.key], p.digits),
    apply: (raw) => {
      const n = decimal(raw, 0, p.max);
      return n === null ? null : { ...color, [p.key]: n };
    },
  }));
}

/**
 * A text field that edits a draft and commits it on Enter or blur (D16). An invalid draft is
 * dropped on blur, so the field shows the stored value again. `inputmode=decimal` and 16 px on
 * touch come from `.number-field`.
 */
function CommitField({
  id,
  value,
  label,
  className = "number-field",
  inputMode = "decimal",
  onCommit,
}: {
  id: string;
  value: string;
  label: string;
  className?: string;
  inputMode?: "decimal" | "text";
  /** True when the draft was valid and applied. */
  onCommit: (raw: string) => boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  // A change from elsewhere, such as an undo, replaces a draft that is no longer being edited.
  useLayoutEffect(() => {
    setDraft((d) => (d !== null && d.trim() === value ? null : d));
  }, [value]);
  const finish = () => {
    if (draft !== null && draft.trim() !== value) onCommit(draft);
    setDraft(null);
  };
  return (
    <input
      id={id}
      class={className}
      type="text"
      inputMode={inputMode}
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      spellcheck={false}
      aria-label={label}
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

function copyText(format: SwatchFormat, color: Oklch): string {
  if (format === "rgb") return formatRgb(color);
  if (format === "hsl") return formatHsl(color);
  if (format === "oklch") return formatOklch(color);
  return swatchHex({ color } as Swatch);
}

export async function copySelected(color: Oklch, format: SwatchFormat): Promise<void> {
  const text = copyText(format, color);
  try {
    if (!navigator.clipboard?.writeText) throw new Error("No clipboard");
    await navigator.clipboard.writeText(text);
    showToast(`Copied ${text}`);
  } catch {
    showToast("Couldn't copy: the clipboard isn't available.");
  }
}

/** Runs `change` on the base palette and records it as one undo step. */
function edit(label: string, change: (p: Swatch[]) => Swatch[]): void {
  const next = change(palette.peek());
  if (next === palette.peek()) return;
  palette.value = next;
  commit(label);
}

const sameColor = (a: Oklch, b: Oklch): boolean => a.l === b.l && a.c === b.c && a.h === b.h;

function Segments<T extends string | number>({
  label,
  options,
  value,
  onChange,
  testId,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  testId?: string;
}) {
  return (
    <fieldset class="segmented swatch-segmented" data-testid={testId}>
      <legend class="visually-hidden">{label}</legend>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          class="segment"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </fieldset>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ComponentChildren;
}) {
  return (
    <SettingRow label={label} {...(htmlFor ? { htmlFor } : {})}>
      {children}
    </SettingRow>
  );
}

/**
 * The cluster map's path without hover (spec 6.1 "No hover"): a toggle that shows the selected
 * swatch's map over the image. It shows everywhere (D21), so desktop and phone hold the same
 * controls (spec 6.6 rule 6).
 */
function ClusterMapRow() {
  return (
    <div class="setting-rows">
      <SettingRow label="Cluster map" htmlFor="cluster-map-toggle">
        <Toggle
          id="cluster-map-toggle"
          checked={clusterToggle.value}
          onChange={(on) =>
            batch(() => {
              clusterToggle.value = on;
              // The toggle takes over from the mockup state's `cluster` parameter.
              clusterPinned.value = null;
            })
          }
        />
      </SettingRow>
    </div>
  );
}

/** The C shortcut (plan D17): copies the selected swatch's HEX, as the displayed color. */
export async function copySelectedHex(): Promise<void> {
  const id = selectedSwatchId.peek();
  const swatch = outputPalette.peek().find((s) => s.id === id);
  if (swatch) await copySelected(swatch.color, "hex");
}

/** Sets the base color and pins the swatch, as the color editor does (decision 24). */
export function setExact(p: Swatch[], id: string, color: Oklch): Swatch[] {
  return setPinned(setSwatchColor(p, id, color), id, true);
}

/** The copy icon beside the color code: copies the value in the current format (decision 39; D14). */
function CopyIcon({ color, format }: { color: Oklch; format: SwatchFormat }) {
  const name = FORMATS.find((f) => f.id === format)?.label ?? format.toUpperCase();
  return (
    <button
      type="button"
      class="icon-pill copy-icon"
      data-testid="copy-value"
      aria-label={`Copy ${name} value`}
      onClick={() => void copySelected(color, format)}
    >
      <Copy aria-hidden="true" size={18} strokeWidth={1.5} />
    </button>
  );
}

/**
 * `swatch` is the BASE swatch: the fields show and edit the base color, as the color editor does
 * (M3 decisions 24 and 47). When adjustments change it, a muted "After adjustments" line shows
 * the output color, with its own copy icon.
 */
function ValueFields({ swatch, output }: { swatch: Swatch; output: Swatch }) {
  const base = useId();
  const format = swatchFormat.value;
  const color = swatch.color;
  const hex = swatchHex(swatch);
  const adjustedHex = swatchHex(output);
  return (
    <div class="swatch-fields" data-testid="swatch-fields">
      {format === "hex" ? (
        <Field label="HEX" htmlFor={`${base}-hex`}>
          <span class="copy-group">
            <CommitField
              id={`${base}-hex`}
              className="number-field swatch-hex-field"
              inputMode="text"
              label="HEX"
              value={hex}
              onCommit={(raw) => {
                const parsed = parseHex(raw);
                if (parsed === null) return false;
                const next = hexToOklch(parsed);
                edit("Color", (p) => setExact(p, swatch.id, next));
                return true;
              }}
            />
            <CopyIcon color={color} format={format} />
          </span>
        </Field>
      ) : (
        channels(format, color).map((channel, at) => (
          <Field
            key={`${format}-${channel.label}`}
            label={channel.label}
            htmlFor={`${base}-${channel.label}`}
          >
            <span class="copy-group">
              <CommitField
                id={`${base}-${channel.label}`}
                label={`${format.toUpperCase()} ${channel.label}`}
                value={channel.text}
                onCommit={(raw) => {
                  const next = channel.apply(raw);
                  if (!next) return false;
                  edit("Color", (p) => setExact(p, swatch.id, next));
                  return true;
                }}
              />
              {at === 0 && <CopyIcon color={color} format={format} />}
            </span>
          </Field>
        ))
      )}
      {adjustedHex !== hex && (
        <p class="hint swatch-adjusted" data-testid="swatch-after-adjustments">
          <span>After adjustments {adjustedHex}</span>
          <button
            type="button"
            class="icon-pill copy-icon"
            data-testid="copy-adjusted"
            aria-label="Copy adjusted HEX value"
            onClick={() => void copySelected(output.color, "hex")}
          >
            <Copy aria-hidden="true" size={18} strokeWidth={1.5} />
          </button>
        </p>
      )}
    </div>
  );
}

function NameField({ swatch, index }: { swatch: Swatch; index: number }) {
  const base = useId();
  const suggestion = nearestCssName(oklchToOklab(swatch.color));
  return (
    <div class="swatch-name">
      <Field label="Name" htmlFor={`${base}-name`}>
        <CommitField
          id={`${base}-name`}
          className="number-field swatch-name-field"
          inputMode="text"
          label="Name"
          value={swatch.name}
          onCommit={(raw) => {
            edit("Rename", (p) => renameSwatch(p, swatch.id, raw.trim()));
            return true;
          }}
        />
      </Field>
      {swatch.name !== suggestion && (
        <SettingRow label="Suggested">
          <button
            type="button"
            class="chip"
            data-testid="name-suggestion"
            aria-label={`Name swatch ${index + 1} ${suggestion}`}
            onClick={() => edit("Rename", (p) => renameSwatch(p, swatch.id, suggestion))}
          >
            {suggestion}
          </button>
        </SettingRow>
      )}
    </div>
  );
}

function deltaText(swatch: Swatch): string | null {
  const extracted = swatch.extracted;
  if (!extracted || sameColor(extracted.color, swatch.color)) return null;
  const metric = settings.value.distanceMetric;
  const d = deltaE(metric, oklchToOklab(extracted.color), oklchToOklab(swatch.color));
  return metric === "ciede2000" ? `ΔE00 ${formatNumber(d, 1)}` : `ΔE OK ${formatNumber(d, 3)}`;
}

function SwatchControls({ swatch, index }: { swatch: Swatch; index: number }) {
  const base = useId();
  const output = outputPalette.value.find((s) => s.id === swatch.id) ?? swatch;
  const delta = deltaText(swatch);
  const extracted = swatch.extracted;
  const available = displayImage.value !== null || masterThread.value !== null;
  const edited =
    extracted !== null &&
    (!sameColor(extracted.color, swatch.color) ||
      extracted.point?.x !== swatch.point?.x ||
      extracted.point?.y !== swatch.point?.y);
  return (
    <>
      <Field label="Format">
        <Segments
          label="Color format"
          options={FORMATS.map((f) => ({ value: f.id, label: f.label }))}
          value={swatchFormat.value}
          onChange={(f) => {
            swatchFormat.value = f;
          }}
          testId="swatch-format"
        />
      </Field>
      <ValueFields swatch={swatch} output={output} />
      <NameField swatch={swatch} index={index} />
      <div class="swatch-actions">
        <button
          type="button"
          class="pill-button"
          disabled={!edited}
          aria-describedby={`${base}-delta`}
          onClick={() => edit("Reset to extracted", (p) => resetToExtracted(p, swatch.id))}
        >
          Reset to extracted
        </button>
        <span class="swatch-note" id={`${base}-delta`} data-testid="reset-delta">
          {delta ?? ""}
        </span>
      </div>
      {swatch.point === null && (
        <div class="swatch-actions">
          <button
            type="button"
            class="pill-button"
            data-testid="place-on-image"
            disabled={!available}
            aria-describedby={available ? undefined : `${base}-place`}
            onClick={() => void placeOnImage(swatch.id)}
          >
            Place on image
          </button>
          {!available && (
            <span class="swatch-note" id={`${base}-place`}>
              Load an image first
            </span>
          )}
        </div>
      )}
      <Field label="Sample radius (px)">
        <Segments
          label="Sample radius"
          options={RADII}
          value={swatch.sampleRadius}
          onChange={(r) => void changeSampling(swatch.id, "Sample radius", { sampleRadius: r })}
          testId="sample-radius"
        />
      </Field>
      <Field label="Sample statistic">
        <Segments<SampleStat>
          label="Sample statistic"
          options={[
            { value: "mean", label: "Mean" },
            { value: "median", label: "Median" },
          ]}
          value={swatch.sampleStat}
          onChange={(s) => void changeSampling(swatch.id, "Sample statistic", { sampleStat: s })}
          testId="sample-stat"
        />
      </Field>
    </>
  );
}

export function SwatchDetails() {
  const id = selectedSwatchId.value;
  const base = palette.value;
  const swatch = selectedSwatch(base, id);
  const index = base.findIndex((s) => s.id === id);
  return (
    <div class="swatch-details" data-testid="swatch-details">
      {swatch ? (
        <SwatchControls key={swatch.id} swatch={swatch} index={index} />
      ) : (
        <p class="hint">Select a swatch to edit it.</p>
      )}
      <ClusterMapRow />
    </div>
  );
}
