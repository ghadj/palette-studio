/**
 * Keep one outlier (spec 2.4; M2 decision 8): the algorithm extracts N − 1 colors, then the
 * histogram is split into 4N median-cut boxes, and the box that holds at least 0.1% of the pixels
 * and lies farthest from its nearest kept color joins the palette. Distances use the distance
 * metric (decision 7). The kept colors give up the outlier's share in proportion, so populations
 * still sum to 1. Pure and deterministic: ties go to the earlier box.
 */

import { type DistanceMetric, deltaE } from "../color/delta-e";
import { workingToOklab } from "../color/working-space";
import type { WorkingSpace } from "../types";
import type { Histogram } from "./histogram";
import { type Cluster, medianCut } from "./median-cut";

/** The smallest share a box needs to count as the outlier. */
export const OUTLIER_MIN_SHARE = 0.001;

export interface OutlierOptions {
  /** The palette size asked for, N; `kept` holds N − 1 colors. */
  n: number;
  space: WorkingSpace;
  metric: DistanceMetric;
}

export function addOutlier(
  h: Histogram,
  kept: readonly Cluster[],
  options: OutlierOptions,
): Cluster[] {
  const { n, space, metric } = options;
  if (kept.length === 0 || h.size === 0) return [...kept];
  const toLab = (c: Cluster) => workingToOklab(space, c.color[0], c.color[1], c.color[2]);
  const keptLab = kept.map(toLab);
  let best: Cluster | null = null;
  let bestD = 0;
  for (const box of medianCut(h, 4 * n)) {
    if (box.population < OUTLIER_MIN_SHARE) continue;
    const lab = toLab(box);
    let nearest = Number.POSITIVE_INFINITY;
    for (const k of keptLab) nearest = Math.min(nearest, deltaE(metric, lab, k));
    if (nearest > bestD) {
      bestD = nearest;
      best = box;
    }
  }
  if (!best) return [...kept];
  const rest = 1 - best.population;
  return [...kept.map((c) => ({ color: c.color, population: c.population * rest })), best];
}
