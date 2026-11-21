/**
 * The mockup state's image master (mockup-state.md): decodes `mockup-scene.png` and prepares it in
 * the worker, so the image views (`image=palette`, `image=values`) can be drawn from it (spec 3.8).
 * No extraction runs and nothing touches storage (spec 5.5); the image well keeps showing the
 * fixture `<img>`, so the screenshots don't depend on this.
 */
import { imageClient } from "../extract/client";
import { decodeImageFile } from "../image/load";
import { displayImage, imageLoading, masterThread } from "./signals";

/** True while no real image has been loaded over the fixture. */
const fixtureShown = (): boolean => displayImage.peek() === null && !imageLoading.peek();

/** Prepares the fixture's master. On failure the demo simply has no image views. */
export async function loadMockupMaster(url: string, name: string): Promise<void> {
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
  } catch {
    // The views are an aid: without them the demo still shows its fixture.
  }
}
