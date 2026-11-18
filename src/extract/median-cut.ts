/**
 * Median cut (Heckbert 1982; spec 2.2, 7.6) over the weighted histogram: repeatedly split the box
 * with the largest range along its widest channel at the population median, until there are N
 * boxes or nothing can be split. Each box's weighted mean becomes a color. Pure and deterministic.
 */
import type { Histogram } from "./histogram";

export interface Cluster {
  /** Working-space color. */
  color: [number, number, number];
  /** Share of the counted pixels, 0 to 1. */
  population: number;
}

interface Box {
  bins: number[];
  channel: number;
  range: number;
}

function measure(h: Histogram, bins: number[]): Box {
  let channel = 0;
  let range = 0;
  for (let c = 0; c < 3; c += 1) {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const bin of bins) {
      const v = h.means[bin * 3 + c] ?? 0;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (max - min > range) {
      range = max - min;
      channel = c;
    }
  }
  return { bins, channel, range };
}

export function summarize(h: Histogram, bins: readonly number[]): Cluster {
  let weight = 0;
  const sum = [0, 0, 0];
  for (const bin of bins) {
    const w = h.counts[bin] ?? 0;
    weight += w;
    for (let c = 0; c < 3; c += 1) sum[c] = (sum[c] ?? 0) + w * (h.means[bin * 3 + c] ?? 0);
  }
  return {
    color: [(sum[0] ?? 0) / weight, (sum[1] ?? 0) / weight, (sum[2] ?? 0) / weight],
    population: weight / h.total,
  };
}

export function medianCut(h: Histogram, n: number): Cluster[] {
  if (h.size === 0 || h.total === 0) return [];
  const boxes: Box[] = [
    measure(
      h,
      Array.from({ length: h.size }, (_, i) => i),
    ),
  ];
  while (boxes.length < n) {
    let pick = -1;
    for (let i = 0; i < boxes.length; i += 1) {
      const box = boxes[i];
      if (!box || box.bins.length < 2 || box.range <= 0) continue;
      if (pick < 0 || box.range > (boxes[pick]?.range ?? 0)) pick = i;
    }
    if (pick < 0) break;
    const box = boxes[pick] as Box;
    const c = box.channel;
    const sorted = [...box.bins].sort(
      (a, b) =>
        (h.means[a * 3 + c] ?? 0) - (h.means[b * 3 + c] ?? 0) ||
        (h.means[a * 3 + ((c + 1) % 3)] ?? 0) - (h.means[b * 3 + ((c + 1) % 3)] ?? 0) ||
        (h.means[a * 3 + ((c + 2) % 3)] ?? 0) - (h.means[b * 3 + ((c + 2) % 3)] ?? 0) ||
        a - b,
    );
    const total = sorted.reduce((s, bin) => s + (h.counts[bin] ?? 0), 0);
    // The cut goes after the bin where the running population reaches half, keeping both sides non-empty.
    let running = 0;
    let cut = sorted.length - 1;
    for (let i = 0; i < sorted.length; i += 1) {
      running += h.counts[sorted[i] ?? 0] ?? 0;
      if (running >= total / 2) {
        cut = i + 1;
        break;
      }
    }
    cut = Math.min(Math.max(cut, 1), sorted.length - 1);
    boxes.splice(pick, 1, measure(h, sorted.slice(0, cut)), measure(h, sorted.slice(cut)));
  }
  return boxes.map((box) => summarize(h, box.bins));
}
