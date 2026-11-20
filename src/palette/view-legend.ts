/**
 * Text for the image views' rows (spec 3.8; ui-contract "Image views"): the Palette view's legend
 * and the Values view's flagged pairs. Numbers use a period under any locale (spec 5).
 */
import type { ValuePair } from "./values";

/** One legend entry: its color squares and the share text. */
export interface LegendEntry {
  /** One hex, or several for a merged entry, in palette order. */
  hexes: string[];
  /** Such as "83.2%", or "0.5% each" for merged entries. */
  text: string;
  /** The entry's share (the mean for a merged entry), 0 to 1. */
  share: number;
}

/** Shares under 1% may merge, if they are within this many percentage points of each other. */
const MERGE_BELOW = 0.01;
const MERGE_WITHIN = 0.0015;

const percent = (share: number): string => `${(share * 100).toFixed(1)}%`;

/**
 * The legend for the area shares, largest first (ui-contract Palette view item 4). Small shares
 * that are equal, within 0.15 percentage points, share one entry: "0.5% each".
 */
export function legendEntries(shares: readonly number[], hexes: readonly string[]): LegendEntry[] {
  const sorted = shares
    .map((share, index) => ({ share, index, hex: hexes[index] ?? "" }))
    .sort((a, b) => b.share - a.share || a.index - b.index);
  const entries: LegendEntry[] = [];
  let at = 0;
  while (at < sorted.length) {
    const first = sorted[at];
    if (!first) break;
    const group = [first];
    if (first.share < MERGE_BELOW) {
      for (let next = at + 1; next < sorted.length; next += 1) {
        const candidate = sorted[next];
        if (!candidate || first.share - candidate.share > MERGE_WITHIN) break;
        group.push(candidate);
      }
    }
    if (group.length > 1) {
      const mean = group.reduce((sum, g) => sum + g.share, 0) / group.length;
      const inPaletteOrder = [...group].sort((a, b) => a.index - b.index);
      entries.push({
        hexes: inPaletteOrder.map((g) => g.hex),
        text: `${percent(mean)} each`,
        share: mean,
      });
    } else {
      entries.push({ hexes: [first.hex], text: percent(first.share), share: first.share });
    }
    at += group.length;
  }
  return entries;
}

/** "Swatch 1 and 2, ΔL 0.004" for a flagged pair (ui-contract Values view item 5). */
export const valuePairText = (pair: ValuePair): string =>
  `Swatch ${pair.first + 1} and ${pair.second + 1}, ΔL ${pair.deltaL.toFixed(3)}`;
