/**
 * The Interpolation setting row (ui-contract column 3 item 4; spec 4.3; plan M4-T9): the space the
 * colors mix in, a select of the ten spaces. A reset icon shows while it isn't OKLab (M3 decision
 * 58), and each change is one undo step. Hue, Easing, Premultiplied and Gamut live in the
 * Interpolation options row (plan Q4).
 */
import { RotateCcw } from "lucide-preact";
import { SPACE_LABELS } from "../gradient/labels";
import { DEFAULT_GRADIENT } from "../state/defaults";
import { setGradient } from "../state/gradient";
import { gradient } from "../state/signals";
import type { InterpolationSpace } from "../types";
import { SettingRow } from "./SettingRow";
import { Select } from "./SettingsControls";

const SPACES = Object.keys(SPACE_LABELS) as InterpolationSpace[];
const OPTIONS = SPACES.map((value) => ({ value, label: SPACE_LABELS[value] }));

function change(space: InterpolationSpace): void {
  if (gradient.peek().space === space) return;
  setGradient({ space }, "Interpolation");
}

export function InterpolationRow() {
  const space = gradient.value.space;
  return (
    <SettingRow
      label="Interpolation"
      htmlFor="interpolation-space"
      reset={
        space === DEFAULT_GRADIENT.space ? null : (
          <button
            type="button"
            class="reset-icon"
            data-testid="interpolation-space-reset"
            aria-label="Reset Interpolation"
            onClick={() => change(DEFAULT_GRADIENT.space)}
          >
            <RotateCcw aria-hidden="true" size={18} strokeWidth={1.5} />
          </button>
        )
      }
    >
      <Select id="interpolation-space" value={space} options={OPTIONS} onChange={change} />
    </SettingRow>
  );
}
