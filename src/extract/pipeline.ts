/**
 * The extraction pipeline (spec 2.1 steps 3 to 7) on an analysis copy: histogram in the working
 * space, quantize with the chosen algorithm, convert to OKLab, then post-process. Pure; the worker
 * runs it. The whole image is always used: there is no region of interest (M2 decision 15a). Ignore
 * background removes the border-connected backdrop with the filters (decision 4), and spatial
 * weighting weighs each pixel (decision 9).
 */
import { thresholdFor } from "../color/delta-e";
import { workingToOklab } from "../color/working-space";
import { clampColors } from "../state/defaults";
import type { Algorithm, ExtractionSettings } from "../types";
import { detectBackground } from "./background";
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
import { spatialWeights } from "./weighting";
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
  /**
   * Ignore background (decision 4): "found" when a background was removed, "none" when Auto found
   * none. Absent while Ignore background is off.
   */
  background?: BackgroundStatus;
}

export type BackgroundStatus = "found" | "none";

/** The pixels extraction keeps, and Ignore background's outcome. */
export interface KeptPixels {
  /** One entry per pixel: 1 keeps the pixel, 0 drops it. */
  mask: Uint8Array;
  /** Number of pixels kept. */
  kept: number;
  /** Absent while Ignore background is off. */
  background?: BackgroundStatus;
}

/**
 * The keep mask (spec 2.1 step 3) that extraction and the cluster map share: the pixel filters
 * (alpha cutoff, ignore dark and light, minimum chroma), then, with Ignore background on Auto, the
 * background pixels connected to the border (decision 4).
 */
export function keepPixels(image: AnalysisImage, settings: ExtractionSettings): KeptPixels {
  const { mask, kept: filtered } = filterPixels(image.data, settings);
  if (settings.ignoreBackground !== "auto") return { mask, kept: filtered };
  const background = detectBackground(image, { alphaCutoff: settings.alphaCutoff });
  let kept = filtered;
  if (background.found) {
    for (let p = 0; p < mask.length; p += 1) {
      if (background.removed[p] === 1 && mask[p] === 1) {
        mask[p] = 0;
        kept -= 1;
      }
    }
  }
  return { mask, kept, background: background.found ? "found" : "none" };
}

/**
 * Keeps the pixels (spec 2.1 step 3), then extracts with the spatial weights (decision 9). A keep
 * mask already made by `keepPixels` can be passed in, so the cluster map uses the same one. When
 * nothing is kept, the result is empty with the reason "all-filtered", so the app can ask the user
 * to loosen a filter.
 */
export function runExtraction(
  image: AnalysisImage,
  settings: ExtractionSettings,
  keep: KeptPixels = keepPixels(image, settings),
): ExtractionResult {
  const { mask, kept, ...status } = keep;
  if (kept === 0 && image.data.length >= 4) {
    return { colors: [], reason: "all-filtered", ...status };
  }
  const weights = spatialWeights(image, settings.spatialWeighting);
  return { colors: paletteFrom(image, settings, mask, weights), reason: null, ...status };
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
  weights: Float64Array | null,
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
    // Spatial weighting: populations become weighted shares (decision 9b).
    ...(weights ? { weights } : {}),
  });
  const h = weightByVividness(histogram, vividness, settings.workingSpace);
  // Keep one outlier: extract N − 1 colors, then add the most distinct small cluster (decision 8).
  const outlier = settings.keepOutlier && algorithm !== "swatch-roles";
  // Exact colors adds a real input color as the outlier (decision 8b), not a box mean.
  const exactOutlier = outlier && algorithm === "exact";
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
        ...(weights ? { weights } : {}),
        ...(exactOutlier ? { outlier: settings.distanceMetric } : {}),
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
  if (outlier && !exactOutlier) {
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
    sort: settings.sort,
  });
}
