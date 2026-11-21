/**
 * The pixel assignment (marker placement, spec 3.7): which swatch each analysis pixel belongs to. A swatch's pixels are
 * those that pass the filters and are nearest to it in the working space (M2 decision 13a); the
 * whole image is used. Pure; runs in the worker, so the UI
 * thread never loops over the pixels (spec 7.4).
 */
import { type Oklab, oklabToLab, oklabToLinearRgb, oklabToRgb } from "../color/convert";
import { rgb8ToWorking } from "../color/working-space";
import type { WorkingSpace } from "../types";
import type { AnalysisImage } from "./pipeline";

/** The label of a pixel the filters dropped. */
export const FILTERED = 255;

/** The most swatches a map can label: the indices 0 to 254, since 255 marks filtered pixels. */
export const MAX_ASSIGN_COLORS = FILTERED;

export interface PixelAssignment {
  /** Size of the analysis copy the map was made from. */
  width: number;
  height: number;
  /** One entry per analysis pixel, row by row: the nearest swatch's index, or FILTERED. */
  labels: Uint8Array;
}

/** An OKLab color in working-space coordinates, unclamped, to compare with converted pixels. */
function toWorking(space: WorkingSpace, c: Oklab): [number, number, number] {
  switch (space) {
    case "oklab":
      return [c.l, c.a, c.b];
    case "cielab": {
      const lab = oklabToLab(c);
      return [lab.l, lab.a, lab.b];
    }
    case "linear-srgb": {
      const rgb = oklabToLinearRgb(c);
      return [rgb.r, rgb.g, rgb.b];
    }
    case "srgb": {
      const rgb = oklabToRgb(c);
      return [rgb.r, rgb.g, rgb.b];
    }
  }
}

/**
 * Labels every pixel kept by `keep` (1 keeps, 0 drops) with the index of the nearest color in the
 * working space, by Euclidean distance; ties go to the lower index. Dropped pixels get FILTERED.
 */
export function assignPixels(
  image: AnalysisImage,
  keep: Uint8Array,
  colors: readonly Oklab[],
  space: WorkingSpace,
): PixelAssignment {
  if (colors.length > MAX_ASSIGN_COLORS) {
    throw new Error(`A pixel assignment labels at most ${MAX_ASSIGN_COLORS} colors`);
  }
  const count = image.width * image.height;
  const labels = new Uint8Array(count).fill(FILTERED);
  const k = colors.length;
  const centers = new Float64Array(k * 3);
  for (const [i, c] of colors.entries()) centers.set(toWorking(space, c), i * 3);
  const convert = rgb8ToWorking(space);
  const p = new Float64Array(3);
  const data = image.data;
  // Consecutive pixels often share a color, so the last answer is reused.
  let lastKey = -1;
  let lastLabel = 0;
  for (let i = 0; i < count; i += 1) {
    if (keep[i] !== 1 || k === 0) continue;
    const o = i * 4;
    const key = ((data[o] ?? 0) << 16) | ((data[o + 1] ?? 0) << 8) | (data[o + 2] ?? 0);
    if (key !== lastKey) {
      convert(data[o] ?? 0, data[o + 1] ?? 0, data[o + 2] ?? 0, p, 0);
      const x = p[0] ?? 0;
      const y = p[1] ?? 0;
      const z = p[2] ?? 0;
      let best = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let j = 0; j < k; j += 1) {
        const dx = x - (centers[j * 3] ?? 0);
        const dy = y - (centers[j * 3 + 1] ?? 0);
        const dz = z - (centers[j * 3 + 2] ?? 0);
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bestDistance) {
          bestDistance = d;
          best = j;
        }
      }
      lastKey = key;
      lastLabel = best;
    }
    labels[i] = lastLabel;
  }
  return { width: image.width, height: image.height, labels };
}
