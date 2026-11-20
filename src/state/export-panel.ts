/**
 * The Export panel's state (M3 decision 56): whether it is open and which section it shows. The last
 * section is remembered for the session only (a signal, not storage).
 */
import { signal } from "@preact/signals";

export type ExportSection = "palette" | "gradient" | "image" | "project";

export const EXPORT_SECTIONS: readonly ExportSection[] = [
  "palette",
  "gradient",
  "image",
  "project",
];

export const exportOpen = signal(false);
export const exportSection = signal<ExportSection>("palette");

/** Opens the panel on a section (the grid's "Export grid" shortcut uses this in M5). */
export function openExport(section?: ExportSection): void {
  if (section) exportSection.value = section;
  exportOpen.value = true;
}
