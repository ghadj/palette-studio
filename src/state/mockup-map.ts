/**
 * The mockup state's cluster map (spec 2.6, mockup-state.md): decodes `mockup-scene.png`,
 * prepares it in the worker and assigns its pixels to the fixture palette. No extraction runs and
 * nothing touches storage (spec 5.5); the image well keeps showing the fixture `<img>`, so the
 * screenshots don't depend on this.
 */
import { oklchToOklab } from "../color/convert";
import { imageClient } from "../extract/client";
import { decodeImageFile } from "../image/load";
import {
  clusterMap,
  displayImage,
  imageLoading,
  masterThread,
  outputPalette,
  settings,
} from "./signals";

/** True while no real image has been loaded over the fixture. */
const fixtureShown = (): boolean => displayImage.peek() === null && !imageLoading.peek();

/**
 * Builds the fixture's cluster map. It is stored only if the palette is still the fixture's and
 * no image has been loaded meanwhile. On failure the demo simply has no map.
 */
export async function loadMockupClusterMap(url: string, name: string): Promise<void> {
  // The map is made for the colors on screen: the palette after adjustments (spec 7.5).
  const fixture = outputPalette.peek();
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(String(response.status));
    const blob = await response.blob();
    const file = new File([blob], name, { type: blob.type || "image/png" });
    const decode = async (): Promise<ImageBitmap> => {
      const decoded = await decodeImageFile(file);
      if (!decoded.ok) throw new Error(decoded.message);
      return decoded.bitmap;
    };
    const bitmap = await decode();
    if (!fixtureShown()) {
      bitmap.close();
      return;
    }
    const client = imageClient();
    const prepared = await client.prepare(bitmap);
    prepared.display.close();
    // The master is ready, so the image views can be drawn from it (M3-T14).
    if (fixtureShown()) masterThread.value = prepared.thread;
    // If the worker stops, it can rebuild the fixture's master, until a real image replaces it.
    if (fixtureShown()) client.setRestore(decode);
    const map = await client.assign(
      fixture.map((s) => oklchToOklab(s.color)),
      settings.peek(),
    );
    if (outputPalette.peek() === fixture && fixtureShown()) clusterMap.value = map;
  } catch {
    // The map is an aid: without it the demo still shows its fixture.
  }
}
