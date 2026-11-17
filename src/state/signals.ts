/**
 * App state (spec 7.1): one signal per field of the M1 data model (7.5), so a change to one field
 * only re-renders what depends on it.
 */
import { batch, signal } from "@preact/signals";
import type { ExtractionSettings, ImageMeta, Project, Swatch, Tab, View } from "../types";
import { DEFAULT_SETTINGS, SCHEMA_VERSION } from "./defaults";

// Project fields (7.5)
export const schemaVersion = signal<number>(SCHEMA_VERSION);
export const settings = signal<ExtractionSettings>({ ...DEFAULT_SETTINGS });
export const palette = signal<Swatch[]>([]);
export const imageMeta = signal<ImageMeta | null>(null);

/** The project's name; it belongs to the library entry (5.5) and is shown in the header. */
export const projectName = signal<string>("Untitled");

/** URL of the image shown in the image well (the mockup image, or an object URL from T9). */
export const imageSrc = signal<string | null>(null);

// View state (not part of the project, never in undo history: spec 3.6)
export const selectedSwatchId = signal<string | null>(null);
export const activeTab = signal<Tab>("source");
export const activeView = signal<View>("studio");

/** True in the mockup state (?demo=mockup), which never touches storage (spec 5.5). */
export const demoMode = signal(false);

export function loadProject(project: Project, name: string): void {
  batch(() => {
    schemaVersion.value = project.schemaVersion;
    settings.value = { ...project.settings };
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
