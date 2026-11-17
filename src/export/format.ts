/**
 * Locale-independent number formatting for exports (spec 5): always a period as the decimal
 * separator, no grouping, and no negative zero. Never use toLocaleString or Intl here.
 */
export function formatNumber(value: number, digits: number): string {
  if (!Number.isFinite(value)) throw new Error(`Cannot format ${value}`);
  const text = value.toFixed(digits);
  return /^-0(\.0*)?$/.test(text) ? text.slice(1) : text;
}
