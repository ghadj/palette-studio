/**
 * The type chips (ui-contract column 3 item 2): Linear, Radial and Conic, the selected one with
 * `--color-accent-soft` fill, an accent outline and strong text. M4-T2 leaves them static and
 * marked `data-coming-soon`; M4-T6 builds them (and removes the marks) and owns this file.
 */
import { TYPE_LABELS } from "../gradient/labels";
import { gradient } from "../state/signals";
import type { GradientType } from "../types";
import { comingSoon } from "./comingSoon";

const TYPES: readonly GradientType[] = ["linear", "radial", "conic"];

export function GradientTypeChips() {
  const current = gradient.value.type;
  return (
    <fieldset class="segmented gradient-types" data-testid="gradient-types">
      <legend class="visually-hidden">Gradient type</legend>
      {TYPES.map((type) => (
        <button
          key={type}
          type="button"
          class="segment"
          aria-pressed={type === current}
          data-coming-soon=""
          onClick={comingSoon}
        >
          {TYPE_LABELS[type]}
        </button>
      ))}
    </fieldset>
  );
}
