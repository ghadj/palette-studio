/**
 * Swatch strip columns (decision 13, ui-contract column 2 item 1): up to 6 swatches sit in one
 * row. With 7 to 12, one row is used only when every swatch keeps at least 44 px; otherwise two
 * even rows of at most 6.
 */
export const MIN_SWATCH_PX = 44; // --touch-target

/**
 * The cells the strip lays out: the swatches and the "+" tile, which shares their row (decision 29).
 * At the 12-swatch limit the tile is disabled and sits on a row of its own, so only swatches count.
 */
export function stripCells(swatches: number, max = 12): number {
  return swatches >= max ? swatches : swatches + 1;
}

export function stripColumns(count: number, width: number, gap: number): number {
  if (count <= 6) return Math.max(1, count);
  const oneRow = count * MIN_SWATCH_PX + (count - 1) * gap;
  if (width > 0 && width >= oneRow) return count;
  return Math.ceil(count / 2);
}
