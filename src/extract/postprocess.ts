/**
 * Post-processing (spec 2.1 step 7, 2.4, 7.6): merge near-duplicate colors, closest pair first,
 * while they are closer than the merge threshold under the distance metric (ΔE OK, or CIEDE2000
 * with the threshold in ΔE00 units, decision 7), into a population-weighted average in OKLab; then
 * normalize populations to sum to 1 and rank by the score (1 − v) × population + v × min(1, C / 0.2)
 * (decision 5c), highest first. At vividness 0 the score is the population. Pure.
 */
import { type Lab, type Oklab, oklabToLab } from "../color/convert";
import { type DistanceMetric, deltaE2000, deltaEOK } from "../color/delta-e";
import { vividnessOf } from "./histogram";

export interface ExtractedColor {
  lab: Oklab;
  /** Share of the counted pixels, 0 to 1. */
  population: number;
  /** A role name from swatch roles, such as "Vibrant" (spec 3.1, 7.6 "Labels"). */
  name?: string;
}

export interface PostprocessOptions {
  /** In the metric's units: ΔE OK, or ΔE00 under CIEDE2000. */
  mergeThreshold: number;
  /** Defaults to ΔE OK. */
  metric?: DistanceMetric;
  /** Population vs. vividness, 0 to 1; defaults to 0 (rank by population). */
  vividness?: number;
}

export function postprocess(
  colors: readonly ExtractedColor[],
  { mergeThreshold, metric = "ok", vividness = 0 }: PostprocessOptions,
): ExtractedColor[] {
  const list = colors.map((c) => ({ ...c, lab: { ...c.lab } }));
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
  const v = Math.min(1, Math.max(0, vividness));
  const score = (c: ExtractedColor) =>
    v === 0 ? c.population : (1 - v) * c.population + v * vividnessOf(c.lab.a, c.lab.b);
  return list.sort(
    (x, y) =>
      score(y) - score(x) ||
      y.population - x.population ||
      y.lab.l - x.lab.l ||
      y.lab.a - x.lab.a ||
      y.lab.b - x.lab.b,
  );
}
