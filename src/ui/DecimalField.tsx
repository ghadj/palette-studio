/**
 * A number field for decimal settings such as the filter thresholds and the merge threshold
 * (spec 2.4). It always shows a period as the decimal separator, whatever the locale, and accepts
 * "," or "." when typed (spec 5). It uses inputmode decimal and the 16 px touch size of
 * `.number-field` (spec 6.1). Number inputs can't do either in every browser, so it is a text
 * input with spinbutton semantics: the arrow keys step it and Page Up and Page Down step ten
 * times. Valid values in range commit while typing; on blur or Enter, out-of-range values are
 * clamped.
 */
import { useLayoutEffect, useState } from "preact/hooks";

/** Parses "0.05", "0,05", ".5" or "1": a finite number, or null. */
export function parseDecimal(raw: string): number | null {
  const text = raw.trim().replace(",", ".");
  if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** Formats with a fixed number of decimals and a period, under any locale. */
export function formatDecimal(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

const STEP_KEYS: Record<string, number> = { ArrowUp: 1, ArrowDown: -1, PageUp: 10, PageDown: -10 };

export function DecimalField({
  id,
  value,
  min,
  max,
  decimals,
  step = 10 ** -decimals,
  label,
  disabled = false,
  describedBy,
  deferred = false,
  onCommit,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  decimals: number;
  /** What the arrow keys add or take away; one unit of the last decimal by default. */
  step?: number;
  label?: string;
  disabled?: boolean;
  describedBy?: string | undefined;
  /** Commit on Enter, blur or an arrow step, not per keystroke: one commit, one undo step. */
  deferred?: boolean;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const round = (n: number) => Number(n.toFixed(decimals));
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const inRange = (n: number | null): n is number => n !== null && n >= min && n <= max;
  const shown = formatDecimal(value, decimals);
  // A change from elsewhere, such as a preset, replaces a draft that no longer matches it. A
  // layout effect runs with the render, before the next input event; a deferred effect could
  // run after the user has typed again and drop that new draft.
  useLayoutEffect(() => {
    setText((t) => {
      const n = t === null ? null : parseDecimal(t);
      return t !== null && (n === null || round(n) !== value) ? null : t;
    });
  }, [value]);
  return (
    <input
      id={id}
      class="number-field"
      type="text"
      role="spinbutton"
      inputMode="decimal"
      autoComplete="off"
      spellcheck={false}
      aria-label={label}
      aria-describedby={describedBy}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={shown}
      disabled={disabled}
      value={text ?? shown}
      onInput={(event) => {
        const raw = event.currentTarget.value;
        setText(raw);
        const n = parseDecimal(raw);
        if (!deferred && inRange(n)) onCommit(round(n));
      }}
      onKeyDown={(event) => {
        const steps = STEP_KEYS[event.key];
        if (steps === undefined) return;
        event.preventDefault();
        const typed = text === null ? null : parseDecimal(text);
        onCommit(clamp(round((typed ?? value) + steps * step)));
        setText(null);
      }}
      onChange={(event) => {
        // A value in range was already committed while typing. Committing it again here could
        // read it in units that have changed since, such as the merge threshold's after a metric
        // switch, so only out-of-range values are clamped and committed.
        const n = parseDecimal(event.currentTarget.value);
        if (n !== null && deferred) {
          const next = round(clamp(n));
          if (next !== value) onCommit(next);
        } else if (n !== null && !inRange(n)) onCommit(round(clamp(n)));
        setText(null);
      }}
      onBlur={() => setText(null)}
    />
  );
}
