/**
 * The Swatch row's content (M3 decision 5a): expands in place under the editor on desktop, and is
 * the swatch sheet on phones (spec 6.1). For the selected swatch it holds (spec 3.2, 3.7; plan T4):
 * a format choice (HEX, RGB, HSL, OKLCH) with editable fields, Name with the nearest CSS color name
 * as a chip (D15), Copy in the selected format (D14), Duplicate, Delete, Reset to extracted with the
 * ΔE (D13), the sample radius and Mean or Median (D8), and the Cluster map toggle, which shows on
 * desktop too (D21; it was phone-only in M2, decisions 13d and 13f). M3-T13 adds Place on image.
 *
 * The fields show the displayed (output) color, like the strip, Copy and the color editor. An edit
 * sets exactly that color and locks the swatch (decision 1b), so base and output agree after it.
 * Edits commit on Enter or blur (D16).
 * Every button here is one undo step.
 */
import { batch, signal } from "@preact/signals";
import type { ComponentChildren } from "preact";
import { useId, useLayoutEffect, useState } from "preact/hooks";
import { hexToOklch, type Oklch, oklabToRgb, oklchToOklab, rgbToOklab } from "../color/convert";
import { nearestCssName } from "../color/css-names";
import { deltaE } from "../color/delta-e";
import { parseHex } from "../color/hex";
import { formatHsl, formatNumber, formatOklch, formatRgb } from "../export/format";
import {
  canAdd,
  deleteSwatch,
  duplicateSwatch,
  MAX_SWATCHES,
  renameSwatch,
  resetToExtracted,
  selectedSwatch,
  setLocked,
  setSwatchColor,
  swatchHex,
} from "../palette/model";
import { clusterPinned, clusterToggle } from "../state/cluster";
import { placeOnImage } from "../state/extraction";
import { commit } from "../state/history";
import {
  displayImage,
  outputPalette,
  palette,
  selectedSwatchId,
  selectSwatch,
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

export const FULL_MESSAGE = `A palette holds up to ${MAX_SWATCHES} colors`;

// sRGB helpers for the RGB and HSL fields

const byte = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 255);

function rgbBytes(color: Oklch): [number, number, number] {
  const c = oklabToRgb(oklchToOklab(color));
  return [byte(c.r), byte(c.g), byte(c.b)];
}

function bytesToOklch([r, g, b]: readonly [number, number, number]): Oklch {
  const lab = rgbToOklab({ r: r / 255, g: g / 255, b: b / 255 });
  const c = Math.hypot(lab.a, lab.b);
  const h = c < 1e-9 ? 0 : ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360;
  return { l: lab.l, c, h };
}

/** HSL as whole numbers: hue 0 to 360, saturation and lightness 0 to 100. */
function toHsl(color: Oklch): [number, number, number] {
  const [r, g, b] = rgbBytes(color).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, Math.round(l * 100)];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [Math.round(h) % 360, Math.round(s * 100), Math.round(l * 100)];
}

function fromHsl([h, s, l]: readonly [number, number, number]): Oklch {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return bytesToOklch([byte(f(0)), byte(f(8)), byte(f(4))]);
}

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
    const bytes = rgbBytes(color);
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
    const hsl = toHsl(color);
    const max = [360, 100, 100] as const;
    return (["H", "S", "L"] as const).map((label, i) => ({
      label,
      text: String(hsl[i]),
      apply: (raw) => {
        const n = wholeNumber(raw, 0, max[i] ?? 100);
        if (n === null) return null;
        const next: [number, number, number] = [...hsl];
        next[i] = n;
        return fromHsl(next);
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

async function copySelected(color: Oklch, format: SwatchFormat): Promise<void> {
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

function patch(id: string, label: string, changes: Partial<Omit<Swatch, "id">>): void {
  edit(label, (p) => p.map((s) => (s.id === id ? { ...s, ...changes } : s)));
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

/** Sets the exact color and locks the swatch, as the color editor does (decision 1b). */
export function setExact(p: Swatch[], id: string, color: Oklch): Swatch[] {
  return setLocked(setSwatchColor(p, id, color), id, true);
}

/** `swatch` is the output (displayed) swatch: the fields show what the strip shows. */
function ValueFields({ swatch }: { swatch: Swatch }) {
  const base = useId();
  const format = swatchFormat.value;
  const color = swatch.color;
  const hex = swatchHex(swatch);
  return (
    <div class="swatch-fields" data-testid="swatch-fields">
      {format === "hex" ? (
        <Field label="HEX" htmlFor={`${base}-hex`}>
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
        </Field>
      ) : (
        channels(format, color).map((channel) => (
          <Field
            key={`${format}-${channel.label}`}
            label={channel.label}
            htmlFor={`${base}-${channel.label}`}
          >
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
          </Field>
        ))
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
  const full = !canAdd(palette.value);
  const output = outputPalette.value.find((s) => s.id === swatch.id) ?? swatch;
  const delta = deltaText(swatch);
  const extracted = swatch.extracted;
  const edited =
    extracted !== null &&
    (!sameColor(extracted.color, swatch.color) ||
      extracted.point?.x !== swatch.point?.x ||
      extracted.point?.y !== swatch.point?.y);
  const label = swatch.name || `Swatch ${index + 1}`;
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
      <ValueFields swatch={output} />
      <NameField swatch={swatch} index={index} />
      <div class="swatch-actions">
        <button
          type="button"
          class="pill-button"
          onClick={() => void copySelected(output.color, swatchFormat.value)}
        >
          Copy
        </button>
        <button
          type="button"
          class="pill-button"
          disabled={full}
          aria-describedby={full ? `${base}-full` : undefined}
          onClick={() =>
            edit("Duplicate", (p) => {
              const next = duplicateSwatch(p, swatch.id);
              const copy = next[p.findIndex((s) => s.id === swatch.id) + 1];
              if (copy && next !== p) selectSwatch(copy.id);
              return next;
            })
          }
        >
          Duplicate
        </button>
        <button
          type="button"
          class="pill-button"
          aria-label={`Delete ${label}`}
          onClick={() => {
            const at = palette.peek().findIndex((s) => s.id === swatch.id);
            edit("Delete", (p) => deleteSwatch(p, swatch.id));
            const rest = palette.peek();
            selectSwatch(rest[Math.min(at, rest.length - 1)]?.id ?? null);
          }}
        >
          Delete
        </button>
      </div>
      {full && (
        <p class="swatch-note" id={`${base}-full`}>
          {FULL_MESSAGE}
        </p>
      )}
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
            disabled={!displayImage.value}
            aria-describedby={displayImage.value ? undefined : `${base}-place`}
            onClick={() => void placeOnImage(swatch.id)}
          >
            Place on image
          </button>
          {!displayImage.value && (
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
          onChange={(r) => patch(swatch.id, "Sample radius", { sampleRadius: r })}
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
          onChange={(s) => patch(swatch.id, "Sample statistic", { sampleStat: s })}
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
