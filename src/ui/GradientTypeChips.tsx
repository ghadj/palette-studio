/**
 * The type chips (ui-contract column 3 item 2; spec 4.1): Linear, Radial and Conic as a segmented
 * control, the selected one with `--color-accent-soft` fill, an accent outline and strong text.
 * Arrow keys, Home and End move between them. Each change is one undo step, "Gradient type".
 */
import { TYPE_LABELS } from "../gradient/labels";
import { setGradient } from "../state/gradient";
import { gradient } from "../state/signals";
import type { GradientType } from "../types";

const TYPES: readonly GradientType[] = ["linear", "radial", "conic"];

function choose(type: GradientType): void {
  if (gradient.peek().type !== type) setGradient({ type }, "Gradient type");
}

export function GradientTypeChips() {
  const current = gradient.value.type;
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % TYPES.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      next = (index + TYPES.length - 1) % TYPES.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TYPES.length - 1;
    else return;
    event.preventDefault();
    const type = TYPES[next] as GradientType;
    choose(type);
    const group = (event.currentTarget as HTMLElement).parentElement;
    (group?.querySelectorAll("button")[next] as HTMLElement | undefined)?.focus();
  };
  return (
    <fieldset class="segmented gradient-types" data-testid="gradient-types">
      <legend class="visually-hidden">Gradient type</legend>
      {TYPES.map((type, i) => (
        <button
          key={type}
          type="button"
          class="segment"
          aria-pressed={type === current}
          onClick={() => choose(type)}
          onKeyDown={(event) => onKeyDown(event, i)}
        >
          {TYPE_LABELS[type]}
        </button>
      ))}
    </fieldset>
  );
}
