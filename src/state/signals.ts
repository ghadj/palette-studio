/**
 * App state (spec 7.1): one signal per field of the M1 data model (7.5), so a change to one field
 * only re-renders what depends on it.
 */
import { batch, signal } from "@preact/signals";
import type { ExtractionSettings, ImageMeta, Project, Swatch, Tab, View } from "../types";
import { clampColors, DEFAULT_SETTINGS, SCHEMA_VERSION } from "./defaults";

// Project fields (7.5)
export const schemaVersion = signal<number>(SCHEMA_VERSION);
export const settings = signal<ExtractionSettings>({ ...DEFAULT_SETTINGS });
export const palette = signal<Swatch[]>([]);
export const imageMeta = signal<ImageMeta | null>(null);

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

/** True once loading or extraction has taken longer than about 300 ms (spec 7.4, 6.3). */
export const progressVisible = signal(false);

// View state (not part of the project, never in undo history: spec 3.6)
export const selectedSwatchId = signal<string | null>(null);
export const activeTab = signal<Tab>("source");
export const activeView = signal<View>("studio");

/** True in the mockup state (?demo=mockup), which never touches storage (spec 5.5). */
export const demoMode = signal(false);

export function loadProject(project: Project, name: string): void {
  batch(() => {
    schemaVersion.value = project.schemaVersion;
    settings.value = { ...project.settings, colors: clampColors(project.settings.colors) };
    palette.value = project.palette;
    imageMeta.value = project.image;
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
