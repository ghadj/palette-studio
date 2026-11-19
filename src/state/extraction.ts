/**
 * Live extraction (spec 2.1, 7.4, 6.3): a new image extracts at once; settings changes re-extract
 * after a short debounce; stale results are dropped; the previous palette stays visible and dims
 * while working; a progress bar appears only after about 300 ms. The mockup state has no loaded
 * image, so it never runs extraction (mockup-state.md).
 */
import { batch, effect } from "@preact/signals";
import { type Extraction, imageClient } from "../extract/client";
import type { ClusterMap } from "../extract/cluster-map";
import type { ExtractedColor } from "../extract/postprocess";
import { missingRoles } from "../extract/swatches";
import { createSwatch, swatchOklab } from "../palette/model";
import { mergeKept } from "../palette/reextract";
import type { Algorithm, ExtractionSettings, ImagePoint, Swatch } from "../types";
import * as history from "./history";
import { createJobScheduler, DEBOUNCE_MS, PROGRESS_DELAY_MS } from "./jobs";
import { onImageLoaded } from "./load-image";
import { settingsChangeLabel } from "./setting-labels";
import {
  backgroundNotFound,
  clusterMap,
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

/** The cluster map each extracted palette came with, so undo and redo bring it back (spec 2.6). */
const extractedMaps = new WeakMap<Swatch[], ClusterMap | null>();
/** The swatch ids a cluster map labels, in order: the palette it was made for (spec 2.6). */
const mapOwners = new WeakMap<ClusterMap, readonly string[]>();

/** Shows a map made for this palette, and lets undo and redo bring it back (the demo's map). */
export function adoptClusterMap(list: Swatch[], map: ClusterMap): void {
  mapOwners.set(
    map,
    list.map((s) => s.id),
  );
  extractedMaps.set(list, map);
  clusterMap.value = map;
}

/**
 * Whether the map still labels this palette: the same swatches in the same order, each still its
 * extracted color. An edit, a marker drag, a Replace pick, a reorder, an add or a delete breaks it.
 */
export function mapFits(map: ClusterMap, list: readonly Swatch[]): boolean {
  const ids = mapOwners.get(map);
  if (!ids || ids.length !== list.length) return false;
  return list.every(
    (s, i) =>
      s.id === ids[i] &&
      s.extracted !== null &&
      s.extracted.color.l === s.color.l &&
      s.extracted.color.c === s.color.c &&
      s.extracted.color.h === s.color.h,
  );
}

function applyColors(
  colors: ExtractedColor[],
  algorithm: Algorithm | undefined,
  map: ClusterMap | null,
  points: readonly ImagePoint[] | undefined,
  keepLocked: boolean,
): void {
  const previous = palette.peek();
  const selectedId = selectedSwatchId.peek();
  const selectedIndex = previous.findIndex((s) => s.id === selectedId);
  // Swatch roles name each swatch by its role (spec 3.1); the swatch label then shows it.
  const fresh: Swatch[] = colors.map((c, i) => {
    const s = createSwatch(c.lab, {
      population: c.population,
      origin: "extracted",
      name: c.name ?? "",
      // Where the color lives in the image: its marker (spec 3.7).
      point: points?.[i] ?? null,
    });
    // Kept for "Reset to extracted" (spec 3.7).
    return { ...s, extracted: { color: s.color, point: s.point } };
  });
  // Locked swatches survive a re-extraction of the same image, keeping id, point and origin; the
  // others get fresh points (spec 3.6, 3.7; decisions 2a to 2c).
  const next = keepLocked ? mergeKept(previous, fresh, settings.peek().distanceMetric) : fresh;
  // The map labels the extracted colors, so it no longer matches once a locked swatch is mixed in.
  const shownMap = next.every((s) => fresh.includes(s)) ? map : null;
  if (shownMap)
    mapOwners.set(
      shownMap,
      next.map((s) => s.id),
    );
  extractedMaps.set(next, shownMap);
  batch(() => {
    palette.value = next;
    // The cluster map is stored with the palette it was made for (spec 2.6).
    clusterMap.value = shownMap;
    // Empty roles are left out of the strip and named in a note (M2 decision 10b).
    emptyRoles.value =
      algorithm === "swatch-roles" ? missingRoles(colors.map((c) => c.name ?? "")) : [];
    if (imageMessage.peek()?.fromExtraction) imageMessage.value = null;
    // A kept (locked) swatch stays selected; otherwise the swatch at the same position is.
    selectedSwatchId.value =
      selectedIndex < 0
        ? null
        : next.some((s) => s.id === selectedId)
          ? selectedId
          : (next[Math.min(selectedIndex, next.length - 1)]?.id ?? null);
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
/** The settings each job ran with, so a result for settings since changed isn't committed. */
const jobSettings = new Map<number, ExtractionSettings>();
/** The image the undo history belongs to (decision 3b). */
let historyImage = 0;

/** Commits the settings change since the last step, labelled with the setting (decision 3a). */
function commitSettingsChange(): void {
  const label = settingsChangeLabel(history.committedState().settings, settings.peek());
  if (label) history.commit(label);
}

/**
 * A result for the image the history belongs to is one step with its settings change. The first
 * result for a new image starts a fresh history instead (decision 3b).
 */
function recordResult(forImage: number, ranWith: ExtractionSettings | undefined): void {
  if (forImage !== historyImage) {
    historyImage = forImage;
    history.clear();
  } else if (ranWith === settings.peek()) {
    // A newer settings change is still pending otherwise; its own result makes the step.
    commitSettingsChange();
  }
}

/** M2 decision 18: the filters dropped every pixel. */
export const ALL_FILTERED_MESSAGE = "Every pixel is filtered out. Loosen a filter.";

const scheduler = createJobScheduler<Extraction>({
  run: (jobId) => {
    jobVersions.set(jobId, imageVersion);
    const current = settings.peek();
    jobAlgorithms.set(jobId, current.algorithm);
    jobSettings.set(jobId, current);
    return imageClient().extract(current);
  },
  apply: ({ colors, reason, map, background, points }, jobId) => {
    const forImage = jobVersions.get(jobId) ?? imageVersion;
    // A locked swatch's point belongs to its image: a new image keeps none of them.
    const sameImage = forImage === paletteVersion;
    paletteVersion = forImage;
    const algorithm = jobAlgorithms.get(jobId);
    const ranWith = jobSettings.get(jobId);
    jobVersions.clear();
    jobAlgorithms.clear();
    jobSettings.clear();
    applyColors(colors, algorithm, map, points, sameImage);
    backgroundNotFound.value = background === "none";
    if (reason === "all-filtered") {
      // No pixel was left to fill any role, so only the filter message shows.
      batch(() => {
        emptyRoles.value = [];
        imageMessage.value = { kind: "note", text: ALL_FILTERED_MESSAGE, fromExtraction: true };
      });
    }
    recordResult(paletteVersion, ranWith);
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
    jobSettings.clear();
    batch(() => {
      if (forImage !== paletteVersion) {
        palette.value = [];
        clusterMap.value = null;
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
  // Undo can't put the old image's palette over the new one (decision 3b).
  history.clear();
  scheduler.runNow();
}

/**
 * Place on image (spec 3.7 "Edge cases"): puts a marker for a swatch at its best-matching spot,
 * by the placement extraction uses. The point is stored on the swatch, so the markers show it; it
 * is one undo step. Resolves false when there is no image or the placement failed.
 */
export async function placeOnImage(id: string): Promise<boolean> {
  const list = palette.peek();
  const index = list.findIndex((s) => s.id === id);
  if (index < 0 || !displayImage.peek()) return false;
  try {
    const [point] = await imageClient().place(list.map(swatchOklab), [index], settings.peek());
    // Nothing lands over a palette that changed while the worker worked.
    if (!point || palette.peek() !== list) return false;
    palette.value = list.map((s) => (s.id === id ? { ...s, point } : s));
    history.commit("Place on image");
    return true;
  } catch {
    imageMessage.value = { kind: "error", text: "The marker couldn't be placed. Try again." };
    return false;
  }
}

let started = false;
let settingsCommit: ReturnType<typeof setTimeout> | undefined;

/**
 * Starts live extraction and the settings undo steps. Call once at startup, after any project (or
 * the mockup state) is loaded: that state is where history starts.
 */
export function startLiveExtraction(): void {
  if (started) return;
  started = true;
  history.clear();
  onImageLoaded(extractNewImage);
  // Undo and redo restore a palette with its settings, so nothing pending may land over them.
  history.onRestore(() => {
    scheduler.cancel();
    clearTimeout(settingsCommit);
  });
  // A restored extracted palette gets its own cluster map back, not the one on screen. Any other
  // palette keeps the map only while it still fits it (spec 2.6): an edit, a drag, a Replace pick or
  // a reorder makes it stale.
  effect(() => {
    const list = palette.value;
    const shown = clusterMap.peek();
    let map = shown;
    if (history.isRestoring() && extractedMaps.has(list)) map = extractedMaps.get(list) ?? null;
    if (map && !mapFits(map, list)) map = null;
    if (map !== shown) clusterMap.value = map;
  });
  let first = true;
  effect(() => {
    settings.value;
    if (first) {
      first = false;
      return;
    }
    if (history.isRestoring()) return;
    if (displayImage.peek()) {
      scheduler.request();
    } else {
      // No image (the mockup state): the change is the whole step, once the edits pause.
      clearTimeout(settingsCommit);
      settingsCommit = setTimeout(commitSettingsChange, DEBOUNCE_MS);
    }
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
