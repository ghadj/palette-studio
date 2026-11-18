/**
 * Post-processing (spec 2.1 step 7, 2.4, 7.6): merge near-duplicate colors, closest pair first,
 * while they are closer than the merge threshold (ΔE OK), into a population-weighted average in
 * OKLab; then sort by population, largest first, with populations summing to 1. Pure.
 */
import type { Oklab } from "../color/convert";
import { deltaEOK } from "../color/delta-e";

export interface ExtractedColor {
  lab: Oklab;
  /** Share of the counted pixels, 0 to 1. */
  population: number;
}

export function postprocess(
  colors: readonly ExtractedColor[],
  { mergeThreshold }: { mergeThreshold: number },
): ExtractedColor[] {
  const list = colors.map((c) => ({ lab: { ...c.lab }, population: c.population }));
  for (;;) {
    let pair: [number, number] | null = null;
    let closest = mergeThreshold;
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const d = deltaEOK((list[i] as ExtractedColor).lab, (list[j] as ExtractedColor).lab);
        if (d < closest) {
          closest = d;
          pair = [i, j];
        }
      }
    }
    if (!pair) break;
    const a = list[pair[0]] as ExtractedColor;
    const b = list[pair[1]] as ExtractedColor;
    const w = a.population + b.population;
    const t = w > 0 ? b.population / w : 0.5;
    a.lab = {
      l: a.lab.l + (b.lab.l - a.lab.l) * t,
      a: a.lab.a + (b.lab.a - a.lab.a) * t,
      b: a.lab.b + (b.lab.b - a.lab.b) * t,
    };
    a.population = w;
    list.splice(pair[1], 1);
  }
  const total = list.reduce((n, c) => n + c.population, 0);
  if (total > 0) for (const c of list) c.population /= total;
  return list.sort(
    (x, y) =>
      y.population - x.population || y.lab.l - x.lab.l || y.lab.a - x.lab.a || y.lab.b - x.lab.b,
  );
}
