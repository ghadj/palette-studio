/**
 * Live extraction (spec 2.1, 7.4, 6.3): a new image extracts at once; settings changes re-extract
 * after a short debounce; stale results are dropped; the previous palette stays visible and dims
 * while working; a progress bar appears only after about 300 ms. The mockup state has no loaded
 * image, so it never runs extraction (mockup-state.md).
 */
import { batch, effect } from "@preact/signals";
import { imageClient } from "../extract/client";
import type { ExtractedColor } from "../extract/postprocess";
import { createSwatch } from "../palette/model";
import { createJobScheduler, PROGRESS_DELAY_MS } from "./jobs";
import { onImageLoaded } from "./load-image";
import {
  displayImage,
  extracting,
  imageLoading,
  imageMessage,
  palette,
  progressVisible,
  selectedSwatchId,
  settings,
} from "./signals";

let extractionProgress = false;
let loadingTimer: ReturnType<typeof setTimeout> | undefined;
let loadingProgress = false;
const updateProgress = () => {
  progressVisible.value = extractionProgress || loadingProgress;
};

function applyColors(colors: ExtractedColor[]): void {
  const previous = palette.peek();
  const selectedIndex = previous.findIndex((s) => s.id === selectedSwatchId.peek());
  const next = colors.map((c) =>
    createSwatch(c.lab, { population: c.population, origin: "extracted" }),
  );
  batch(() => {
    palette.value = next;
    selectedSwatchId.value =
      selectedIndex >= 0 ? (next[Math.min(selectedIndex, next.length - 1)]?.id ?? null) : null;
  });
}

const scheduler = createJobScheduler<ExtractedColor[]>({
  run: () => imageClient().extract(settings.peek()),
  apply: applyColors,
  onBusy: (busy) => {
    extracting.value = busy;
  },
  onProgress: (visible) => {
    extractionProgress = visible;
    updateProgress();
  },
  onError: () => {
    imageMessage.value = {
      kind: "error",
      text: "The palette couldn't be extracted from this image. Try another sample size or image.",
    };
  },
});

let started = false;

/** Starts live extraction. Call once at startup, outside the mockup state. */
export function startLiveExtraction(): void {
  if (started) return;
  started = true;
  onImageLoaded(() => scheduler.runNow());
  let first = true;
  effect(() => {
    settings.value;
    if (first) {
      first = false;
      return;
    }
    if (displayImage.peek()) scheduler.request();
  });
  effect(() => {
    clearTimeout(loadingTimer);
    if (imageLoading.value) {
      loadingTimer = setTimeout(() => {
        loadingProgress = true;
        updateProgress();
      }, PROGRESS_DELAY_MS);
    } else if (loadingProgress) {
      loadingProgress = false;
      updateProgress();
    }
  });
}
