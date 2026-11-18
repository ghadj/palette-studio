/**
 * The extraction pipeline (spec 2.1 steps 4 to 7) on an analysis copy's RGBA pixels: histogram in
 * the working space, quantize with the chosen algorithm, convert to OKLab, then post-process. Pure;
 * the worker runs it. Filters (step 3) arrive in M2.
 */
import { workingToOklab } from "../color/working-space";
import { clampColors } from "../state/defaults";
import type { ExtractionSettings } from "../types";
import { buildHistogram } from "./histogram";
import { kmeans } from "./kmeans";
import { type Cluster, medianCut } from "./median-cut";
import { type ExtractedColor, postprocess } from "./postprocess";

export type { ExtractedColor } from "./postprocess";

/** Algorithms M1 builds (spec 9). The others arrive in M2. */
export const M1_ALGORITHMS = ["kmeans", "median-cut"] as const;

export function extractPalette(
  rgba: Uint8ClampedArray | Uint8Array,
  settings: ExtractionSettings,
): ExtractedColor[] {
  const count = clampColors(settings.colors);
  const h = buildHistogram(rgba, {
    space: settings.workingSpace,
    alphaCutoff: settings.alphaCutoff,
    bits: settings.histogramBits,
  });
  let clusters: Cluster[];
  switch (settings.algorithm) {
    case "kmeans":
      clusters = kmeans(h, {
        k: count,
        iterations: settings.iterations,
        restarts: settings.restarts,
        seed: settings.seed,
      }).clusters;
      break;
    case "median-cut":
      clusters = medianCut(h, count);
      break;
    default:
      throw new Error(`The ${settings.algorithm} algorithm is not available until a later version`);
  }
  const colors = clusters.map((c) => ({
    lab: workingToOklab(settings.workingSpace, c.color[0], c.color[1], c.color[2]),
    population: c.population,
  }));
  return postprocess(colors, { mergeThreshold: settings.mergeThreshold });
}
