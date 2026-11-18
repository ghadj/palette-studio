/**
 * Swatch strip columns (decision 13, ui-contract column 2 item 1): up to 6 swatches sit in one
 * row. With 7 to 12, one row is used only when every swatch keeps at least 44 px; otherwise two
 * even rows of at most 6.
 */
export const MIN_SWATCH_PX = 44; // --touch-target

export function stripColumns(count: number, width: number, gap: number): number {
  if (count <= 6) return Math.max(1, count);
  const oneRow = count * MIN_SWATCH_PX + (count - 1) * gap;
  if (width > 0 && width >= oneRow) return count;
  return Math.ceil(count / 2);
}
