/**
 * Slider (ui-contract Components "Slider"; spec 6.1 "Sliders and buttons"): a range input with a
 * divider-colored track and a round accent thumb, larger on touch, and a number field beside it as
 * its stepper. Whole numbers use `NumberField`; decimals use `DecimalField`, which always shows a
 * period (spec 5). The M2 Colors slider, made generic in M3-T2 for the editor and adjustments.
 *
 * `onDragStart` and `onDragEnd` bracket one pointer drag of the thumb, so a caller can make the
 * drag one undo step with the history's `begin` and `end` (plan D16). Keyboard steps and field
 * entries come without them: each is its own step.
 */
import { useRef } from "preact/hooks";
import { DecimalField } from "./DecimalField";
import { NumberField } from "./NumberField";

export function Slider({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  decimals = 0,
  disabled = false,
  describedBy,
  deferred = false,
  onChange,
  onDragStart,
  onDragEnd,
}: {
  /** The number field's id, which the row's `<label for>` names. */
  id: string;
  /** Names the range input ("Colors slider"); the row's label names the field. */
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** 0 for whole numbers; otherwise the digits the field shows after the period. */
  decimals?: number;
  disabled?: boolean;
  describedBy?: string | undefined;
  /** The whole-number field commits on Enter, blur or an arrow step, not per keystroke. */
  deferred?: boolean;
  /** Every new value, live while dragging. */
  onChange: (value: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const dragging = useRef(false);
  const finish = () => {
    if (!dragging.current) return;
    dragging.current = false;
    onDragEnd?.();
  };
  return (
    <span class="slider-group">
      <input
        class="slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={`${label} slider`}
        aria-valuetext={decimals > 0 ? value.toFixed(decimals) : undefined}
        disabled={disabled}
        aria-describedby={describedBy}
        onPointerDown={() => {
          if (dragging.current) return;
          dragging.current = true;
          onDragStart?.();
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
        onLostPointerCapture={finish}
        onChange={finish}
        onInput={(event) => onChange(Number(event.currentTarget.value))}
      />
      {decimals > 0 ? (
        <DecimalField
          id={id}
          value={value}
          min={min}
          max={max}
          step={step}
          decimals={decimals}
          disabled={disabled}
          describedBy={describedBy}
          onCommit={onChange}
        />
      ) : (
        <NumberField
          id={id}
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          describedBy={describedBy}
          deferred={deferred}
          onCommit={onChange}
        />
      )}
    </span>
  );
}
