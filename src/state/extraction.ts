/**
 * Live extraction (spec 2.1, 7.4, 6.3): a new image extracts at once; settings changes re-extract
 * after a short debounce; stale results are dropped; the previous palette stays visible and dims
 * while working; a progress bar appears only after about 300 ms. The mockup state has no loaded
 * image, so it never runs extraction (mockup-state.md).
 */
import { batch, effect } from "@preact/signals";
import { imageClient } from "../extract/client";
import type { ExtractedColor } from "../extract/postprocess";
import { missingRoles } from "../extract/swatches";
import { createSwatch } from "../palette/model";
import type { Algorithm } from "../types";
import { createJobScheduler, PROGRESS_DELAY_MS } from "./jobs";
import { onImageLoaded } from "./load-image";
import {
  displayImage,
  emptyRoles,
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

function applyColors(colors: ExtractedColor[], algorithm: Algorithm | undefined): void {
  const previous = palette.peek();
  const selectedIndex = previous.findIndex((s) => s.id === selectedSwatchId.peek());
  // Swatch roles name each swatch by its role (spec 3.1); the swatch label then shows it.
  const next = colors.map((c) =>
    createSwatch(c.lab, { population: c.population, origin: "extracted", name: c.name ?? "" }),
  );
  batch(() => {
    palette.value = next;
    // Empty roles are left out of the strip and named in a note (M2 decision 10b).
    emptyRoles.value =
      algorithm === "swatch-roles" ? missingRoles(colors.map((c) => c.name ?? "")) : [];
    if (imageMessage.peek()?.fromExtraction) imageMessage.value = null;
    selectedSwatchId.value =
      selectedIndex >= 0 ? (next[Math.min(selectedIndex, next.length - 1)]?.id ?? null) : null;
  });
}

/*
 * Which image the palette belongs to (fix L9). A new image keeps the old palette, dimmed, until its
 * own extraction lands (spec 6.3); if that extraction fails, the old palette no longer describes the
 * image on screen, so it is cleared rather than left to be copied.
 */
let imageVersion = 0;
let paletteVersion = 0;
const jobVersions = new Map<number, number>();
/** The algorithm each job ran with, so its result is read the way it was made. */
const jobAlgorithms = new Map<number, Algorithm>();

const scheduler = createJobScheduler<ExtractedColor[]>({
  run: (jobId) => {
    jobVersions.set(jobId, imageVersion);
    const current = settings.peek();
    jobAlgorithms.set(jobId, current.algorithm);
    return imageClient().extract(current);
  },
  apply: (colors, jobId) => {
    paletteVersion = jobVersions.get(jobId) ?? imageVersion;
    const algorithm = jobAlgorithms.get(jobId);
    jobVersions.clear();
    jobAlgorithms.clear();
    applyColors(colors, algorithm);
  },
  onBusy: (busy) => {
    extracting.value = busy;
  },
  onProgress: (visible) => {
    extractionProgress = visible;
    updateProgress();
  },
  onError: (_error, jobId) => {
    const forImage = jobVersions.get(jobId) ?? imageVersion;
    jobVersions.clear();
    jobAlgorithms.clear();
    batch(() => {
      if (forImage !== paletteVersion) {
        palette.value = [];
        emptyRoles.value = [];
        selectedSwatchId.value = null;
      }
      imageMessage.value = {
        kind: "error",
        text: "The palette couldn't be extracted from this image. Try another sample size or image.",
        fromExtraction: true,
      };
    });
  },
});

/** Runs an extraction now, superseding any pending one. */
export function extractNow(): void {
  scheduler.runNow();
}

/** Extracts for a newly loaded image. */
export function extractNewImage(): void {
  imageVersion += 1;
  scheduler.runNow();
}

let started = false;

/** Starts live extraction. Call once at startup, outside the mockup state. */
export function startLiveExtraction(): void {
  if (started) return;
  started = true;
  onImageLoaded(extractNewImage);
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
