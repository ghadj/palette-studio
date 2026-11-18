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
import { evenSpread } from "./even-spread";
import { exactColors } from "./exact";
import { filterPixels } from "./filters";
import { buildHistogram, weightByVividness } from "./histogram";
import { kmeans } from "./kmeans";
import { type Cluster, medianCut } from "./median-cut";
import { addOutlier } from "./outlier";
import { type ExtractedColor, postprocess } from "./postprocess";
import { swatchRoles } from "./swatches";
import { wu } from "./wu";

export type { ExtractedColor } from "./postprocess";

/** The algorithms built so far, in spec 2.4 order. Octree comes later (spec 2.2). */
export const AVAILABLE_ALGORITHMS = [
  "median-cut",
  "wu",
  "kmeans",
  "balanced",
  "exact",
  "even-spread",
  "swatch-roles",
] as const satisfies readonly Algorithm[];

/** The analysis copy: RGBA pixels, row by row. */
export interface AnalysisImage {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

/** An extraction's colors, and why they are empty when every pixel was filtered out. */
export interface ExtractionResult {
  colors: ExtractedColor[];
  /** "all-filtered": the filters dropped every pixel (M2 decision 18). */
  reason: "all-filtered" | null;
}

/**
 * Filters the pixels (spec 2.1 step 3), then extracts. When the filters drop every pixel, the
 * result is empty with the reason "all-filtered", so the app can ask the user to loosen a filter.
 */
export function runExtraction(
  image: AnalysisImage,
  settings: ExtractionSettings,
): ExtractionResult {
  const { mask, kept } = filterPixels(image.data, settings);
  if (kept === 0 && image.data.length >= 4) return { colors: [], reason: "all-filtered" };
  return { colors: paletteFrom(image, settings, mask), reason: null };
}

export function extractPalette(
  image: AnalysisImage,
  settings: ExtractionSettings,
): ExtractedColor[] {
  return runExtraction(image, settings).colors;
}

function paletteFrom(
  image: AnalysisImage,
  settings: ExtractionSettings,
  mask: Uint8Array,
): ExtractedColor[] {
  const count = clampColors(settings.colors);
  const algorithm = settings.algorithm;
  // Population vs. vividness weights the bins and ranks the result; exact colors and swatch roles
  // don't use it (decisions 5c and 6).
  const vividness = algorithm === "exact" || algorithm === "swatch-roles" ? 0 : settings.vividness;
  const histogram = buildHistogram(image.data, {
    space: settings.workingSpace,
    alphaCutoff: settings.alphaCutoff,
    bits: settings.histogramBits,
    mask,
  });
  const h = weightByVividness(histogram, vividness, settings.workingSpace);
  // Keep one outlier: extract N − 1 colors, then add the most distinct small cluster (decision 8).
  const outlier = settings.keepOutlier && algorithm !== "swatch-roles";
  const n = outlier ? count - 1 : count;
  let clusters: Array<Cluster & { role?: string }>;
  switch (algorithm) {
    case "kmeans":
      clusters = kmeans(h, {
        k: n,
        iterations: settings.iterations,
        restarts: settings.restarts,
        seed: settings.seed,
      }).clusters;
      break;
    case "median-cut":
      clusters = medianCut(h, n);
      break;
    case "wu":
      clusters = wu(h, n);
      break;
    case "balanced":
      clusters = balanced(h, { k: n, iterations: settings.iterations });
      break;
    case "exact":
      clusters = exactColors(image.data, {
        n,
        space: settings.workingSpace,
        alphaCutoff: settings.alphaCutoff,
        mask,
      });
      break;
    case "even-spread":
      clusters = evenSpread(h, n);
      break;
    case "swatch-roles":
      clusters = swatchRoles(h, settings.workingSpace);
      break;
    default:
      throw new Error(`The ${algorithm} algorithm is not available until a later version`);
  }
  if (outlier) {
    clusters = addOutlier(h, clusters, {
      n: count,
      space: settings.workingSpace,
      metric: settings.distanceMetric,
    });
  }
  const colors = clusters.map(
    (c): ExtractedColor => ({
      lab: workingToOklab(settings.workingSpace, c.color[0], c.color[1], c.color[2]),
      population: c.population,
      ...(c.role ? { name: c.role } : {}),
    }),
  );
  return postprocess(colors, {
    // Swatch roles don't merge (decision 10c): a role is never folded into another.
    mergeThreshold:
      algorithm === "swatch-roles"
        ? 0
        : thresholdFor(settings.distanceMetric, settings.mergeThreshold),
    metric: settings.distanceMetric,
    vividness,
  });
}
