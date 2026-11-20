/**
 * A whole-number field (spec 2.4: Colors, Seed, Iterations, Restarts, Alpha cutoff): a number
 * input, so it has a stepper (spec 6.1), with inputmode decimal and the 16 px touch size of
 * `.number-field`. Moved out of SettingsControls in M3-T2 so `Slider` can use it.
 */
import { useLayoutEffect, useState } from "preact/hooks";

/** A number field that accepts typing freely and commits valid integers in range. */
export function NumberField({
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
  // A change from elsewhere, such as a preset, replaces a draft that no longer matches it. A
  // layout effect runs with the render, before the next input event; a deferred effect could
  // run after the user has typed again and drop that new draft.
  useLayoutEffect(() => {
    setText((t) => (t !== null && parse(t) !== value ? null : t));
  }, [value]);
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
