/**
 * Loading an image (spec 2.1 steps 1 and 2, 6.3, 7.4): decode, make the working master and the
 * display copy, then update the project. A failed load leaves the previous image in place. The
 * previous palette stays visible, dimmed, until the new image's extraction lands (spec 6.3).
 */
import { batch } from "@preact/signals";
import { imageClient } from "../extract/client";
import { decodeImageFile, projectNameFromFile, unreadableMessage } from "../image/load";
import { fitView } from "../image/viewport";
import {
  displayImage,
  imageLoading,
  imageMessage,
  imageMeta,
  imageSrc,
  imageView,
  masterThread,
  projectName,
} from "./signals";

let sequence = 0;
const listeners = new Set<() => void>();

/** Called after each successful load, for example to start extraction. */
export function onImageLoaded(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadImageFile(file: File): Promise<boolean> {
  sequence += 1;
  const mine = sequence;
  imageLoading.value = true;
  try {
    const decoded = await decodeImageFile(file);
    if (mine !== sequence) {
      if (decoded.ok) decoded.bitmap.close();
      return false;
    }
    if (!decoded.ok) {
      imageMessage.value = { kind: "error", text: decoded.message };
      return false;
    }
    let prepared: Awaited<ReturnType<ReturnType<typeof imageClient>["prepare"]>>;
    try {
      prepared = await imageClient().prepare(decoded.bitmap);
    } catch {
      if (mine === sequence)
        imageMessage.value = { kind: "error", text: unreadableMessage(decoded.format) };
      return false;
    }
    if (mine !== sequence) {
      prepared.display.close();
      return false;
    }
    const previous = displayImage.peek();
    batch(() => {
      displayImage.value = prepared.display;
      imageView.value = fitView();
      imageSrc.value = null;
      masterThread.value = prepared.thread;
      imageMeta.value = { name: file.name, width: decoded.width, height: decoded.height };
      projectName.value = projectNameFromFile(file.name);
      imageMessage.value = decoded.note ? { kind: "note", text: decoded.note } : null;
    });
    previous?.close();
    // If the worker stops later, it can rebuild the master from the original file.
    imageClient().setRestore(async () => {
      const again = await decodeImageFile(file);
      if (!again.ok) throw new Error(again.message);
      return again.bitmap;
    });
    for (const listener of listeners) listener();
    return true;
  } finally {
    if (mine === sequence) imageLoading.value = false;
  }
}

export async function loadImageFromUrl(url: string, name: string): Promise<boolean> {
  const before = sequence;
  imageLoading.value = true;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(String(response.status));
    const blob = await response.blob();
    return loadImageFile(new File([blob], name, { type: blob.type }));
  } catch {
    if (sequence === before) imageLoading.value = false;
    imageMessage.value = { kind: "error", text: `The sample image ${name} couldn't be loaded.` };
    return false;
  }
}
