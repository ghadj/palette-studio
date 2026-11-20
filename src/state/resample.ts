/**
 * Sampling settings of a swatch (spec 3.7; M3 decision 31). Changing the radius or statistic of a
 * swatch that has a point resamples it at once, through the worker `sample`, as one undo step.
 */

import type { Oklab } from "../color/convert";
import { oklabToOklch } from "../color/convert";
import { imageClient } from "../extract/client";
import type { ImagePoint, SampleRadius, SampleStat, Swatch } from "../types";
import * as history from "./history";
import { displayImage, masterThread, palette } from "./signals";

/**
 * True when a sample can be taken: an image is loaded, or the demo's fixture has a prepared master
 * (the demo never touches storage, but its image is on screen).
 */
export function imageAvailable(): boolean {
  return displayImage.peek() !== null || masterThread.peek() !== null;
}

type Sampler = (
  point: ImagePoint,
  radius: SampleRadius,
  stat: SampleStat,
) => Promise<{ color: Oklab }>;

const workerSample: Sampler = (point, radius, stat) => imageClient().sample(point, radius, stat);

/**
 * Applies the setting change, then (when the swatch has a point and an image is available)
 * replaces its color with the new sample, picked and pinned like a marker drag. The setting and the
 * color are one undo step. If sampling fails, the setting is kept and the color is not.
 */
export async function changeSampling(
  id: string,
  label: string,
  changes: Partial<Pick<Swatch, "sampleRadius" | "sampleStat">>,
  sample: Sampler = workerSample,
): Promise<void> {
  const before = palette.peek();
  const found = before.find((s) => s.id === id);
  if (!found) return;
  history.begin();
  try {
    const updated = { ...found, ...changes };
    palette.value = before.map((s) => (s.id === id ? updated : s));
    if (updated.point && imageAvailable()) {
      try {
        const result = await sample(updated.point, updated.sampleRadius, updated.sampleStat);
        // Nothing lands over a swatch that changed while the worker worked.
        const now = palette.peek().find((s) => s.id === id);
        if (now === updated) {
          palette.value = palette
            .peek()
            .map((s) =>
              s.id === id
                ? { ...s, color: oklabToOklch(result.color), origin: "picked", pinned: true }
                : s,
            );
        }
      } catch {
        // The setting stays; the color keeps its value.
      }
    }
  } finally {
    history.end(label);
  }
}
