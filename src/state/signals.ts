/**
 * App state (spec 7.1): one signal per field of the M1 data model (7.5), so a change to one field
 * only re-renders what depends on it.
 */
import { batch, computed, signal } from "@preact/signals";
import { fitView, type View as ImageView } from "../image/viewport";
import { applyAdjustments } from "../palette/adjust";
import type {
  Adjustments,
  ExtractionSettings,
  EyedropperMode,
  Gradient,
  GradientPreviewSettings,
  ImageMeta,
  Project,
  Surround,
  Swatch,
  Tab,
  View,
  ViewSettings,
} from "../types";
import {
  clampColors,
  DEFAULT_ADJUSTMENTS,
  DEFAULT_GRADIENT,
  DEFAULT_GRADIENT_PREVIEW,
  DEFAULT_SETTINGS,
  DEFAULT_VIEW_SETTINGS,
  SCHEMA_VERSION,
} from "./defaults";

// Project fields (7.5)
export const schemaVersion = signal<number>(SCHEMA_VERSION);
export const settings = signal<ExtractionSettings>({ ...DEFAULT_SETTINGS });
/** Before/after compare (3.6): shows the base colors while on. View state, never in undo. */
export const compareBefore = signal(false);
/** The base swatches (7.5). Everything that shows or exports colors reads `outputPalette`. */
export const palette = signal<Swatch[]>([]);
export const adjustments = signal<Adjustments>({ ...DEFAULT_ADJUSTMENTS });
/** The palette after adjustments (7.5 "palette"): what the strip shows and exports copy. */
export const outputPalette = computed(() =>
  // Before/after compare (3.6, M3-T6) shows the base colors while on.
  compareBefore.value ? palette.value : applyAdjustments(palette.value, adjustments.value),
);
export const imageMeta = signal<ImageMeta | null>(null);
/** View settings (7.5, 3.8): part of the project, but never in undo history (3.6). */
export const viewSettings = signal<ViewSettings>({ ...DEFAULT_VIEW_SETTINGS });

/** The gradient (7.5): in undo history (3.6). Read stops through `effectiveStops`, not `stops`. */
export const gradient = signal<Gradient>({ ...DEFAULT_GRADIENT });

/** The project's name; it belongs to the library entry (5.5) and is shown in the header. */
export const projectName = signal<string>("Untitled");

/** URL of an image shown as-is in the image well: the mockup state's fixture image. */
export const imageSrc = signal<string | null>(null);

/** The display copy of a loaded image's working master (spec 7.4), drawn in the image well. */
export const displayImage = signal<ImageBitmap | null>(null);

export interface ImageMessage {
  kind: "error" | "note";
  text: string;
  /** Set on extraction errors, which the next successful extraction clears. */
  fromExtraction?: true;
}

/** The inline message under the image: an unreadable file, or the large-image note (spec 6.3). */
export const imageMessage = signal<ImageMessage | null>(null);

/** True while an image is being decoded and prepared. */
export const imageLoading = signal(false);

/** Where the working master lives: in the worker, or on the main thread (fallback, spec 7.4). */
export const masterThread = signal<"worker" | "main" | null>(null);

/** True while an extraction job is running; the previous palette stays visible, dimmed (6.3). */
export const extracting = signal(false);

/**
 * The swatch roles the last swatch-roles extraction left empty, named in a muted note under the
 * strip (M2 decision 10b). Empty for every other algorithm. Not part of the project.
 */
export const emptyRoles = signal<readonly string[]>([]);

/**
 * True when the last extraction ran Ignore background on Auto and found no background, so the row
 * shows "None found" (M2 decisions 4 and 18). Not part of the project.
 */
export const backgroundNotFound = signal(false);

/** True once loading or extraction has taken longer than about 300 ms (spec 7.4, 6.3). */
export const progressVisible = signal(false);

// View state (not part of the project, never in undo history: spec 3.6)
export const selectedSwatchId = signal<string | null>(null);
export const activeTab = signal<Tab>("source");
export const activeView = signal<View>("studio");

/**
 * Zoom and pan of the image well (decision 15), with offsets as fractions of the well's size. View
 * state: not saved in the project, not in undo (spec 3.6), and back to Fit on a new image.
 */
export const imageView = signal<ImageView>(fitView());

/** The selected gradient stop (plan T1): view state, never in undo (3.6). */
export const selectedStopId = signal<string | null>(null);
/** Gradient preview options (4.4, plan D22): view state, not saved, never in undo. */
export const gradientPreview = signal<GradientPreviewSettings>({ ...DEFAULT_GRADIENT_PREVIEW });
/** The preview's surround (6.2, plan D23): an app setting like the theme, not in undo. */
export const surround = signal<Surround>("theme");

/** The swatch whose card or marker is hovered, linking the two (3.7). */
export const hoveredSwatchId = signal<string | null>(null);
/** The show/hide toggle for all markers (3.7). */
export const markersVisible = signal(true);
export const eyedropperMode = signal<EyedropperMode>("off");

/** True in the mockup state (?demo=mockup), which never touches storage (spec 5.5). */
export const demoMode = signal(false);

/**
 * Chevron rows that start expanded, such as "filters": the mockup state's `rows` parameter. On
 * phones the Palette column's rows ("swatch", "adjustments", "contrast", "cvd") and the Ramp panel
 * ("ramp") open as bottom sheets instead (plan D20).
 */
export const initialOpenRows = signal<readonly string[]>([]);

/** True when the theme menu starts open: the mockup state's `menu=theme` parameter (M4 plan D28). */
export const initialThemeMenu = signal(false);

/**
 * The palette index of the swatch whose marker shows the loupe at load: the mockup state's
 * `loupe=<n>` parameter (plan D20). Null for none. M3-T12's Loupe reads it.
 */
export const initialLoupe = signal<number | null>(null);

export function loadProject(project: Project, name: string): void {
  batch(() => {
    schemaVersion.value = project.schemaVersion;
    settings.value = { ...project.settings, colors: clampColors(project.settings.colors) };
    palette.value = project.palette;
    adjustments.value = project.adjustments;
    imageMeta.value = project.image;
    viewSettings.value = project.view;
    gradient.value = project.gradient;
    selectedStopId.value = null;
    projectName.value = name;
    selectedSwatchId.value = null;
    activeTab.value = "source";
  });
}

/** Replaces one swatch; the other swatch objects keep their identity. */
export function updateSwatch(id: string, patch: Partial<Omit<Swatch, "id">>): void {
  palette.value = palette.value.map((s) => (s.id === id ? { ...s, ...patch } : s));
}

export function selectSwatch(id: string | null): void {
  selectedSwatchId.value = id;
}
