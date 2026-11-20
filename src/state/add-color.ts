/**
 * The "+" tile (M3 decision 40; spec 3.2): adds a color at once, with no menu. With an image it is
 * the image's next most distinct color, which the worker finds by extracting at the maximum Colors
 * with the current settings; the one farthest (by the current metric) from every swatch is taken,
 * if it is beyond the merge threshold, and a marker is placed for it through the worker's `place`.
 * With no image, or when the image offers nothing more distinct, it is the selected swatch's color
 * (else the last swatch's) with its hue rotated by 30 degrees, gamut-mapped to sRGB.
 *
 * The new swatch is manual, neither pinned nor locked, goes at the end, is selected so it can be
 * edited at once, and is one undo step, "Add color". The UI thread never loops over pixels.
 */
import { signal } from "@preact/signals";
import type { Oklab } from "../color/convert";
import { oklabToOklch } from "../color/convert";
import { deltaE, thresholdFor } from "../color/delta-e";
import { clampChroma } from "../color/gamut";
import { imageClient } from "../extract/client";
import {
  addSwatch,
  canAdd,
  createSwatch,
  FULL_MESSAGE,
  MAX_SWATCHES,
  swatchOklab,
} from "../palette/model";
import type { DistanceMetric, ExtractionSettings, ImagePoint, Oklch } from "../types";
import { commit } from "./history";
import { imageAvailable } from "./resample";
import { palette, selectedSwatchId, selectSwatch, settings } from "./signals";

/** The hue step of the no-image color, in degrees. */
export const HUE_STEP = 30;

/** True while an add waits for the worker, so a second press doesn't queue another. */
export const adding = signal(false);

export interface AddDeps {
  extract(settings: ExtractionSettings): Promise<{ colors: ReadonlyArray<{ lab: Oklab }> }>;
  place(
    colors: readonly Oklab[],
    indexes: readonly number[],
    settings: ExtractionSettings,
  ): Promise<ImagePoint[]>;
}

const workerDeps = (): AddDeps => {
  const client = imageClient();
  return {
    extract: (s) => client.extract(s),
    place: (colors, indexes, s) => client.place(colors, indexes, s),
  };
};

/** The candidate farthest from every existing color, or null when none is beyond the threshold. */
export function mostDistinct(
  existing: readonly Oklab[],
  candidates: ReadonlyArray<{ lab: Oklab }>,
  metric: DistanceMetric,
  mergeThreshold: number,
): Oklab | null {
  const limit = thresholdFor(metric, mergeThreshold);
  let best: Oklab | null = null;
  let bestDistance = limit;
  for (const { lab } of candidates) {
    const nearest = existing.reduce((m, e) => Math.min(m, deltaE(metric, e, lab)), Infinity);
    if (nearest > bestDistance) {
      bestDistance = nearest;
      best = lab;
    }
  }
  return best;
}

/** The color with its hue turned by 30 degrees, chroma reduced to fit sRGB. */
export function hueRotated(color: Oklch): Oklch {
  return clampChroma({ ...color, h: (color.h + HUE_STEP) % 360 });
}

/** Adds the next color (see the file comment). `notify` announces the 12-color limit. */
export async function addColor(
  deps: AddDeps | null = null,
  notify: (message: string) => void = () => {},
): Promise<void> {
  if (adding.peek()) return;
  if (!canAdd(palette.peek())) {
    notify(FULL_MESSAGE);
    return;
  }
  adding.value = true;
  try {
    const list = palette.peek();
    let color: Oklch | null = null;
    let point: ImagePoint | null = null;
    if (imageAvailable()) {
      try {
        const worker = deps ?? workerDeps();
        const current = settings.peek();
        const result = await worker.extract({ ...current, colors: MAX_SWATCHES });
        const found = mostDistinct(
          list.map(swatchOklab),
          result.colors,
          current.distanceMetric,
          current.mergeThreshold,
        );
        if (found) {
          const colors = [...list.map(swatchOklab), found];
          const [placed] = await worker.place(colors, [list.length], current);
          color = oklabToOklch(found);
          point = placed ?? null;
        }
      } catch {
        // The image offers nothing usable now: the hue-rotated color below.
      }
    }
    // The palette may have changed while the worker worked: add to what is there now.
    const now = palette.peek();
    if (!canAdd(now)) {
      notify(FULL_MESSAGE);
      return;
    }
    if (!color) {
      const source =
        now.find((s) => s.id === selectedSwatchId.peek()) ?? now[now.length - 1] ?? null;
      color = hueRotated(source ? source.color : { l: 0.5, c: 0, h: 0 });
      point = null;
    }
    const swatch = createSwatch({ l: 0, a: 0, b: 0 }, { origin: "manual", point });
    const added = { ...swatch, color };
    palette.value = addSwatch(now, added);
    selectSwatch(added.id);
    commit("Add color");
  } finally {
    adding.value = false;
  }
}
