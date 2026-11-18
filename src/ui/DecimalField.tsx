/**
 * A number field for decimal settings such as the filter thresholds (spec 2.4). It always shows a
 * period as the decimal separator, whatever the locale, and accepts "," or "." when typed
 * (spec 5). It uses inputmode decimal and the 16 px touch size of `.number-field` (spec 6.1).
 * Valid values in range commit while typing; on blur or Enter, out-of-range values are clamped.
 */
import { useState } from "preact/hooks";

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

export function DecimalField({
  id,
  value,
  min,
  max,
  decimals,
  label,
  disabled = false,
  describedBy,
  onCommit,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  decimals: number;
  label?: string;
  disabled?: boolean;
  describedBy?: string | undefined;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const round = (n: number) => Number(n.toFixed(decimals));
  return (
    <input
      id={id}
      class="number-field"
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellcheck={false}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      value={text ?? formatDecimal(value, decimals)}
      onInput={(event) => {
        const raw = event.currentTarget.value;
        setText(raw);
        const n = parseDecimal(raw);
        if (n !== null && n >= min && n <= max) onCommit(round(n));
      }}
      onChange={(event) => {
        const n = parseDecimal(event.currentTarget.value);
        if (n !== null) onCommit(round(Math.min(max, Math.max(min, n))));
        setText(null);
      }}
      onBlur={() => setText(null)}
    />
  );
}
