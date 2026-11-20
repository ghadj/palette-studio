/**
 * The Interpolation options chevron row (spec 4.3; plan Q4, D12, D24, D25). It holds only the rows
 * that apply: Hue for the polar spaces, Easing always (with its four bezier fields for Custom),
 * Premultiplied alpha while a stop is translucent, and Gamut while the bake maps colors. Every row
 * has a reset icon off its default and each change is one undo step. The header shows an accent dot
 * with the count, "Interpolation options · N", and a reset-all icon (M3 decision 58); the count
 * includes options whose row is hidden, so reset-all clears everything it counts.
 */
import { RotateCcw } from "lucide-preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";
import {
  changedOptions,
  hasTranslucentStop,
  isPolar,
  type OptionKey,
  optionDiffers,
  optionReset,
  resetAllPatch,
} from "../gradient/interpolation-options";
import { setGradient } from "../state/gradient";
import { render } from "../state/gradient-render";
import { resolvedStops } from "../state/gradient-stops";
import { gradient } from "../state/signals";
import type { EasingKind, GamutHandling, HueMethod } from "../types";
import { ChevronRow } from "./ChevronRow";
import { SettingRow } from "./SettingRow";
import { Select } from "./SettingsControls";
import { Toggle } from "./Toggle";

export const OUT_OF_GAMUT_NOTE = "Some colors fall outside sRGB.";

const HUES: ReadonlyArray<{ value: HueMethod; label: string }> = [
  { value: "shorter", label: "Shorter" },
  { value: "longer", label: "Longer" },
  { value: "increasing", label: "Increasing" },
  { value: "decreasing", label: "Decreasing" },
];

const EASINGS: ReadonlyArray<{ value: EasingKind; label: string }> = [
  { value: "linear", label: "Linear" },
  { value: "ease-in", label: "Ease in" },
  { value: "ease-out", label: "Ease out" },
  { value: "ease-in-out", label: "Ease in-out" },
  { value: "smoothstep", label: "Smoothstep" },
  { value: "cubic-bezier", label: "Custom" },
];

const GAMUTS: ReadonlyArray<{ value: GamutHandling; label: string }> = [
  { value: "chroma", label: "Reduce chroma" },
  { value: "clamp", label: "Clamp" },
];

const ROW_LABELS: Record<OptionKey, string> = {
  hue: "Hue",
  easing: "Easing",
  premultiplied: "Premultiplied alpha",
  gamut: "Gamut",
};

function ResetIcon({ option }: { option: OptionKey }) {
  if (!optionDiffers(option, gradient.value)) return null;
  return (
    <button
      type="button"
      class="reset-icon"
      data-testid="interpolation-reset-row"
      data-row-key={option}
      aria-label={`Reset ${ROW_LABELS[option]}`}
      onClick={() => setGradient(optionReset(option), `Reset ${ROW_LABELS[option]}`)}
    >
      <RotateCcw aria-hidden="true" size={18} strokeWidth={1.5} />
    </button>
  );
}

const BEZIER_NAMES = ["x1", "y1", "x2", "y2"] as const;
const BEZIER_STEP = 0.05;

/** Parses "0.25", "0,25", "-.5" or "1": a finite number, or null. */
function parseSigned(raw: string): number | null {
  const text = raw.trim().replace(",", ".");
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

const round3 = (n: number): number => Number(n.toFixed(3));
const inRange = (index: number, n: number): boolean => index % 2 === 1 || (n >= 0 && n <= 1);

/** The four control points: x1 and x2 must lie within 0 to 1 (plan D7); others take any number. */
function BezierFields() {
  const bezier = gradient.value.easing.bezier;
  const [drafts, setDrafts] = useState<Array<string | null>>([null, null, null, null]);
  const noteId = useId();
  const invalid = drafts.map((d, i) => {
    if (d === null) return false;
    const n = parseSigned(d);
    return n === null || !inRange(i, n);
  });
  const setDraft = (i: number, value: string | null) =>
    setDrafts((d) => d.map((v, k) => (k === i ? value : v)));
  const commit = (i: number, n: number) => {
    const g = gradient.peek();
    const next = [...g.easing.bezier] as typeof g.easing.bezier;
    next[i] = round3(n);
    if (next[i] === g.easing.bezier[i]) return;
    setGradient({ easing: { ...g.easing, bezier: next } }, "Easing");
  };
  const showNote = invalid.some(Boolean);
  return (
    <div class="bezier" data-testid="bezier-fields">
      <div class="bezier__grid">
        {BEZIER_NAMES.map((name, i) => (
          <label key={name} class="bezier__cell">
            <span class="bezier__name">{name}</span>
            <input
              class="number-field bezier__field"
              data-testid="bezier-field"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellcheck={false}
              aria-label={name}
              aria-invalid={invalid[i] ? "true" : undefined}
              aria-describedby={showNote ? noteId : undefined}
              value={drafts[i] ?? (bezier[i] ?? 0).toString()}
              onInput={(event) => setDraft(i, event.currentTarget.value)}
              onKeyDown={(event) => {
                const dir = event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0;
                if (dir === 0) return;
                event.preventDefault();
                const typed = drafts[i] === null ? null : parseSigned(drafts[i] ?? "");
                const next = (typed ?? bezier[i] ?? 0) + dir * BEZIER_STEP;
                if (inRange(i, next)) commit(i, next);
                setDraft(i, null);
              }}
              onChange={(event) => {
                const n = parseSigned(event.currentTarget.value);
                if (n !== null && inRange(i, n)) commit(i, n);
                setDraft(i, null);
              }}
              onBlur={() => setDraft(i, null)}
            />
          </label>
        ))}
      </div>
      <p
        class="setting-row__note bezier__note"
        id={noteId}
        role="status"
        data-testid={showNote ? "bezier-note" : undefined}
      >
        {showNote ? "x1 and x2 must be between 0 and 1, and every value a number." : ""}
      </p>
    </div>
  );
}

export function InterpolationOptions() {
  const g = gradient.value;
  const translucent = hasTranslucentStop(resolvedStops.value);
  const outOfGamut = render.value.outOfGamut;
  return (
    <div class="interpolation-options" data-testid="interpolation-options">
      {isPolar(g.space) && (
        <SettingRow label="Hue" htmlFor="interp-hue" reset={<ResetIcon option="hue" />}>
          <Select
            id="interp-hue"
            value={g.hue}
            options={HUES}
            onChange={(hue) => hue !== gradient.peek().hue && setGradient({ hue }, "Hue")}
          />
        </SettingRow>
      )}
      <SettingRow label="Easing" htmlFor="interp-easing" reset={<ResetIcon option="easing" />}>
        <Select
          id="interp-easing"
          value={g.easing.kind}
          options={EASINGS}
          onChange={(kind) => {
            const cur = gradient.peek().easing;
            if (kind !== cur.kind) setGradient({ easing: { ...cur, kind } }, "Easing");
          }}
        />
      </SettingRow>
      {g.easing.kind === "cubic-bezier" && <BezierFields />}
      {translucent && (
        <SettingRow
          label="Premultiplied alpha"
          htmlFor="interp-premultiplied"
          reset={<ResetIcon option="premultiplied" />}
        >
          <Toggle
            id="interp-premultiplied"
            checked={g.premultiplied}
            onChange={(premultiplied) => setGradient({ premultiplied }, "Premultiplied alpha")}
          />
        </SettingRow>
      )}
      {outOfGamut && (
        <SettingRow
          label="Gamut"
          htmlFor="interp-gamut"
          note={OUT_OF_GAMUT_NOTE}
          reset={<ResetIcon option="gamut" />}
        >
          <Select
            id="interp-gamut"
            value={g.gamut}
            options={GAMUTS}
            onChange={(gamut) => gamut !== gradient.peek().gamut && setGradient({ gamut }, "Gamut")}
          />
        </SettingRow>
      )}
    </div>
  );
}

function resetAll(): void {
  if (changedOptions(gradient.peek()).length === 0) return;
  setGradient(resetAllPatch(), "Interpolation options");
}

function ResetAllButton({ testId }: { testId: string }) {
  return (
    <button
      type="button"
      class="reset-icon"
      data-testid={testId}
      aria-label="Reset interpolation options"
      onClick={(event) => {
        event.stopPropagation();
        resetAll();
      }}
    >
      <RotateCcw aria-hidden="true" size={18} strokeWidth={1.5} />
    </button>
  );
}

/**
 * The header's extras: the reset-all icon while any option differs, and a hidden description for
 * the toggle button while the bake maps colors (plan Risks). The button belongs to `ChevronRow`, so
 * the description is attached to it from here.
 */
export function InterpolationOptionsHeader() {
  const g = gradient.value;
  const count = changedOptions(g).length;
  const outOfGamut = render.value.outOfGamut;
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const button = ref.current?.closest(".chevron-row__head")?.querySelector("button");
    if (!button) return;
    if (outOfGamut) button.setAttribute("aria-describedby", id);
    else button.removeAttribute("aria-describedby");
  }, [outOfGamut, id]);
  return (
    <>
      <span ref={ref} id={id} class="visually-hidden">
        {outOfGamut ? OUT_OF_GAMUT_NOTE : ""}
      </span>
      {count > 0 && <ResetAllButton testId="interpolation-reset-all" />}
    </>
  );
}

export function InterpolationOptionsRow() {
  const count = changedOptions(gradient.value).length;
  return (
    <ChevronRow
      id="interpolation"
      label="Interpolation options"
      badge={count > 0 ? { count, name: `Interpolation options, ${count} active` } : null}
      sheetAction={count > 0 ? <ResetAllButton testId="interpolation-reset-all-sheet" /> : null}
      summaryExtra={<InterpolationOptionsHeader />}
    >
      <InterpolationOptions />
    </ChevronRow>
  );
}
