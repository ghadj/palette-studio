/**
 * Post-processing (spec 2.1 step 7, 2.4, 7.6): merge near-duplicate colors, closest pair first,
 * while they are closer than the merge threshold under the distance metric (ΔE OK, or CIEDE2000
 * with the threshold in ΔE00 units, decision 7), into a population-weighted average in OKLab; then
 * sort by population, largest first, with populations summing to 1. Pure.
 */
import { type Lab, type Oklab, oklabToLab } from "../color/convert";
import { type DistanceMetric, deltaE2000, deltaEOK } from "../color/delta-e";

export interface ExtractedColor {
  lab: Oklab;
  /** Share of the counted pixels, 0 to 1. */
  population: number;
}

export interface PostprocessOptions {
  /** In the metric's units: ΔE OK, or ΔE00 under CIEDE2000. */
  mergeThreshold: number;
  /** Defaults to ΔE OK. */
  metric?: DistanceMetric;
}

export function postprocess(
  colors: readonly ExtractedColor[],
  { mergeThreshold, metric = "ok" }: PostprocessOptions,
): ExtractedColor[] {
  const list = colors.map((c) => ({ lab: { ...c.lab }, population: c.population }));
  // CIEDE2000 works on CIELAB: convert each color once, and again only when it changes.
  const cielab: Lab[] = metric === "ciede2000" ? list.map((c) => oklabToLab(c.lab)) : [];
  const distance = (i: number, j: number): number =>
    metric === "ciede2000"
      ? deltaE2000(cielab[i] as Lab, cielab[j] as Lab)
      : deltaEOK((list[i] as ExtractedColor).lab, (list[j] as ExtractedColor).lab);
  for (;;) {
    let pair: [number, number] | null = null;
    let closest = mergeThreshold;
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const d = distance(i, j);
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
    if (metric === "ciede2000") {
      cielab[pair[0]] = oklabToLab(a.lab);
      cielab.splice(pair[1], 1);
    }
  }
  const total = list.reduce((n, c) => n + c.population, 0);
  if (total > 0) for (const c of list) c.population /= total;
  return list.sort(
    (x, y) =>
      y.population - x.population || y.lab.l - x.lab.l || y.lab.a - x.lab.a || y.lab.b - x.lab.b,
  );
}
