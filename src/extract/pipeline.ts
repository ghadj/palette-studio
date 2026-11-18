/**
 * The extraction pipeline (spec 2.1 steps 3 to 7) on an analysis copy: histogram in the working
 * space, quantize with the chosen algorithm, convert to OKLab, then post-process. Pure; the worker
 * runs it. The whole image is always used: there is no region of interest (M2 decision 15a).
 */
import { thresholdFor } from "../color/delta-e";
import { workingToOklab } from "../color/working-space";
import { clampColors } from "../state/defaults";
import type { Algorithm, ExtractionSettings } from "../types";
import { balanced } from "./balanced";
import { buildHistogram, weightByVividness } from "./histogram";
import { kmeans } from "./kmeans";
import { type Cluster, medianCut } from "./median-cut";
import { type ExtractedColor, postprocess } from "./postprocess";
import { wu } from "./wu";

export type { ExtractedColor } from "./postprocess";

/** The algorithms built so far, in spec 2.4 order. The rest arrive later in M2. */
export const AVAILABLE_ALGORITHMS = [
  "median-cut",
  "wu",
  "kmeans",
  "balanced",
] as const satisfies readonly Algorithm[];

/** The analysis copy: RGBA pixels, row by row. */
export interface AnalysisImage {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

export function extractPalette(
  image: AnalysisImage,
  settings: ExtractionSettings,
): ExtractedColor[] {
  const count = clampColors(settings.colors);
  // Population vs. vividness weights the bins and ranks the result (decisions 5c and 6).
  const vividness = settings.vividness;
  const histogram = buildHistogram(image.data, {
    space: settings.workingSpace,
    alphaCutoff: settings.alphaCutoff,
    bits: settings.histogramBits,
  });
  const h = weightByVividness(histogram, vividness, settings.workingSpace);
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
    case "wu":
      clusters = wu(h, count);
      break;
    case "balanced":
      clusters = balanced(h, { k: count, iterations: settings.iterations });
      break;
    default:
      throw new Error(`The ${settings.algorithm} algorithm is not available until a later version`);
  }
  const colors = clusters.map((c) => ({
    lab: workingToOklab(settings.workingSpace, c.color[0], c.color[1], c.color[2]),
    population: c.population,
  }));
  return postprocess(colors, {
    mergeThreshold: thresholdFor(settings.distanceMetric, settings.mergeThreshold),
    metric: settings.distanceMetric,
    vividness,
  });
}
