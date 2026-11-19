/**
 * The Adjustments row's content (spec 3.3, 3.6; ui-contract column 2 item 5): in place on desktop,
 * a bottom sheet on phones. One `Slider` per adjustment in the table order of 3.3, Even out,
 * Harmonize (anchor and amount), Gamut (Off or Clamp, with the indicator), Reset, and the
 * before/after Compare toggle. Plan D1 gives the ranges.
 *
 * Undo (plan D16): a slider drag is one step (begin on press, end on release); a keyboard step,
 * field entry, toggle or button is one step each. Compare is view state and isn't recorded (3.6).
 * Locked swatches aren't adjusted (spec 3.3); pinned ones are (decision 24), which the note under the title says.
 */
import { inGamut } from "../color/gamut";
import { isIdentity, resetAdjustments } from "../palette/adjust";
import { begin, commit, end } from "../state/history";
import { adjustments, compareBefore, outputPalette, palette } from "../state/signals";
import type { Adjustments, GamutMode } from "../types";
import { SettingRow } from "./SettingRow";
import { Slider } from "./Slider";
import { Toggle } from "./Toggle";

interface SliderSpec {
  id: string;
  label: string;
  /** The undo step's name. */
  step: string;
  min: number;
  max: number;
  stepSize?: number;
  decimals?: number;
  get: (a: Adjustments) => number;
  set: (a: Adjustments, value: number) => Adjustments;
}

const SLIDERS: readonly SliderSpec[] = [
  {
    id: "adjust-lightness",
    label: "Lightness",
    step: "Lightness",
    min: -0.5,
    max: 0.5,
    stepSize: 0.01,
    decimals: 2,
    get: (a) => a.lightness,
    set: (a, v) => ({ ...a, lightness: v }),
  },
  {
    id: "adjust-chroma",
    label: "Chroma %",
    step: "Chroma",
    min: 0,
    max: 200,
    get: (a) => Math.round(a.chroma * 100),
    set: (a, v) => ({ ...a, chroma: v / 100 }),
  },
  {
    id: "adjust-hue",
    label: "Hue rotate",
    step: "Hue rotate",
    min: -180,
    max: 180,
    get: (a) => a.hue,
    set: (a, v) => ({ ...a, hue: v }),
  },
  {
    id: "adjust-contrast",
    label: "Contrast %",
    step: "Contrast",
    min: 50,
    max: 200,
    get: (a) => Math.round(a.contrast * 100),
    set: (a, v) => ({ ...a, contrast: v / 100 }),
  },
  {
    id: "adjust-temperature",
    label: "Temperature",
    step: "Temperature",
    min: -0.1,
    max: 0.1,
    stepSize: 0.005,
    decimals: 3,
    get: (a) => a.temperature,
    set: (a, v) => ({ ...a, temperature: v }),
  },
  {
    id: "adjust-tint",
    label: "Tint",
    step: "Tint",
    min: -0.1,
    max: 0.1,
    stepSize: 0.005,
    decimals: 3,
    get: (a) => a.tint,
    set: (a, v) => ({ ...a, tint: v }),
  },
  {
    id: "adjust-gamma",
    label: "Gamma",
    step: "Gamma",
    min: 0.5,
    max: 2,
    stepSize: 0.05,
    decimals: 2,
    get: (a) => a.gamma,
    set: (a, v) => ({ ...a, gamma: v }),
  },
  {
    id: "adjust-range-min",
    label: "Lightness range min",
    step: "Lightness range",
    min: 0,
    max: 1,
    stepSize: 0.01,
    decimals: 2,
    get: (a) => a.lightnessRange.min,
    set: (a, v) => ({ ...a, lightnessRange: { ...a.lightnessRange, min: v } }),
  },
  {
    id: "adjust-range-max",
    label: "Lightness range max",
    step: "Lightness range",
    min: 0,
    max: 1,
    stepSize: 0.01,
    decimals: 2,
    get: (a) => a.lightnessRange.max,
    set: (a, v) => ({ ...a, lightnessRange: { ...a.lightnessRange, max: v } }),
  },
];

const HARMONIZE_SLIDERS: readonly SliderSpec[] = [
  {
    id: "adjust-harmonize-anchor",
    label: "Harmonize anchor °",
    step: "Harmonize anchor",
    min: 0,
    max: 360,
    get: (a) => a.harmonize.anchor,
    set: (a, v) => ({ ...a, harmonize: { ...a.harmonize, anchor: v } }),
  },
  {
    id: "adjust-harmonize-amount",
    label: "Harmonize amount %",
    step: "Harmonize amount",
    min: 0,
    max: 100,
    get: (a) => Math.round(a.harmonize.amount * 100),
    set: (a, v) => ({ ...a, harmonize: { ...a.harmonize, amount: v / 100 } }),
  },
];

const GAMUT_LABELS: ReadonlyArray<readonly [GamutMode, string]> = [
  ["off", "Off"],
  ["srgb", "Clamp"],
];

function change(next: Adjustments, label: string): void {
  // History compares by reference, so a field's commit of the same value mustn't add a step.
  if (JSON.stringify(next) === JSON.stringify(adjustments.peek())) return;
  adjustments.value = next;
  commit(label);
}

function AdjustSlider({ spec }: { spec: SliderSpec }) {
  return (
    <SettingRow label={spec.label} htmlFor={spec.id}>
      <Slider
        id={spec.id}
        label={spec.label}
        value={spec.get(adjustments.value)}
        min={spec.min}
        max={spec.max}
        step={spec.stepSize ?? 1}
        decimals={spec.decimals ?? 0}
        onChange={(v) => change(spec.set(adjustments.peek(), v), spec.step)}
        onDragStart={begin}
        onDragEnd={() => end()}
      />
    </SettingRow>
  );
}

export function AdjustmentsPanel() {
  const a = adjustments.value;
  const identity = isIdentity(a);
  const hasLocked = palette.value.some((s) => s.locked);
  const outside = outputPalette.value.filter((s) => !inGamut(s.color)).length;
  const gamutNote =
    outside > 0
      ? `${outside} ${outside === 1 ? "swatch is" : "swatches are"} outside sRGB`
      : "All swatches are inside sRGB";
  return (
    <div class="adjustments-panel" data-testid="adjustments-panel">
      {hasLocked && <p class="hint adjustments-panel__note">Locked swatches are not adjusted.</p>}
      {SLIDERS.map((spec) => (
        <AdjustSlider key={spec.id} spec={spec} />
      ))}
      <SettingRow label="Even out lightness" htmlFor="adjust-even-out">
        <Toggle
          id="adjust-even-out"
          checked={a.evenOut}
          onChange={(checked) => change({ ...a, evenOut: checked }, "Even out lightness")}
        />
      </SettingRow>
      {HARMONIZE_SLIDERS.map((spec) => (
        <AdjustSlider key={spec.id} spec={spec} />
      ))}
      <SettingRow label="Gamut" note={gamutNote} noteId="adjust-gamut-note">
        <fieldset class="segmented" aria-describedby="adjust-gamut-note">
          <legend class="visually-hidden">Gamut</legend>
          {GAMUT_LABELS.map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              class="segment"
              aria-pressed={a.gamut === mode}
              onClick={() => {
                if (a.gamut !== mode) change({ ...a, gamut: mode }, "Gamut");
              }}
            >
              {label}
            </button>
          ))}
        </fieldset>
      </SettingRow>
      <SettingRow label="Compare to base colors" htmlFor="adjust-compare">
        <Toggle
          id="adjust-compare"
          checked={compareBefore.value}
          onChange={(checked) => {
            compareBefore.value = checked;
          }}
        />
      </SettingRow>
      <div class="adjustments-panel__actions">
        <button
          type="button"
          class="pill-button"
          disabled={identity}
          onClick={() => change(resetAdjustments(), "Reset adjustments")}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
