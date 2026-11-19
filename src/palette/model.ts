/**
 * Swatch creation, selection helpers and the palette operations (spec 3.1, 3.2, 3.7). Every
 * operation is pure: it returns a new list, keeps the other swatch objects' identity, and returns
 * the list unchanged when there is nothing to do.
 */
import { type Oklab, oklabToOklch, oklchToHex, oklchToOklab } from "../color/convert";
import type { ImagePoint, Oklch, Swatch } from "../types";

/** A palette holds at most 12 swatches everywhere (M1 decision 13; M3 decision 4a). */
export const MAX_SWATCHES = 12;

let nextId = 1;

/** A new id, unique within this page load. */
export function newSwatchId(): string {
  const id = `swatch-${nextId}`;
  nextId += 1;
  return id;
}

/** Creates a swatch from an OKLab color. The color is stored as OKLCH (spec 3.1). */
export function createSwatch(lab: Oklab, init: Partial<Omit<Swatch, "color">> = {}): Swatch {
  return {
    id: init.id ?? newSwatchId(),
    color: oklabToOklch(lab),
    alpha: init.alpha ?? 1,
    name: init.name ?? "",
    locked: init.locked ?? false,
    origin: init.origin ?? "extracted",
    population: init.population ?? 0,
    point: init.point ?? null,
    sampleRadius: init.sampleRadius ?? "auto",
    sampleStat: init.sampleStat ?? "mean",
    extracted: init.extracted ?? null,
  };
}

export function swatchOklab(swatch: Swatch): Oklab {
  return oklchToOklab(swatch.color);
}

/** The sRGB hex shown for a swatch, uppercase. */
export function swatchHex(swatch: Swatch): string {
  return oklchToHex(swatch.color);
}

export function selectedSwatch(palette: readonly Swatch[], id: string | null): Swatch | null {
  if (id === null) return null;
  return palette.find((s) => s.id === id) ?? null;
}

/** The label naming a swatch: its name, or "Swatch N" by position (ui-contract column 2 item 2). */
export function swatchLabel(palette: readonly Swatch[], id: string | null): string {
  const index = palette.findIndex((s) => s.id === id);
  const swatch = palette[index];
  if (!swatch) return "";
  return swatch.name || `Swatch ${index + 1}`;
}

// Palette operations (spec 3.2)

/** True while the palette has room for another swatch (decision 4a). */
export function canAdd(palette: readonly Swatch[]): boolean {
  return palette.length < MAX_SWATCHES;
}

/** Inserts a swatch at `index` (the end by default); refuses at 12. */
export function addSwatch(palette: Swatch[], swatch: Swatch, index = palette.length): Swatch[] {
  if (!canAdd(palette)) return palette;
  const at = Math.max(0, Math.min(palette.length, index));
  return [...palette.slice(0, at), swatch, ...palette.slice(at)];
}

/**
 * Inserts a copy after the source: a new id, origin manual, unlocked, with no point and nothing to
 * reset to (plan D12). Refuses at 12.
 */
export function duplicateSwatch(palette: Swatch[], id: string): Swatch[] {
  const index = palette.findIndex((s) => s.id === id);
  const source = palette[index];
  if (!source) return palette;
  const copy: Swatch = {
    ...source,
    id: newSwatchId(),
    origin: "manual",
    locked: false,
    point: null,
    extracted: null,
  };
  return addSwatch(palette, copy, index + 1);
}

export function deleteSwatch(palette: Swatch[], id: string): Swatch[] {
  const next = palette.filter((s) => s.id !== id);
  return next.length === palette.length ? palette : next;
}

/** Moves the swatch at `from` to `to`, shifting the ones between. */
export function moveSwatch(palette: Swatch[], from: number, to: number): Swatch[] {
  const swatch = palette[from];
  if (!swatch || from === to || to < 0 || to >= palette.length) return palette;
  const next = palette.filter((_, i) => i !== from);
  next.splice(to, 0, swatch);
  return next;
}

function patchSwatch(palette: Swatch[], id: string, patch: Partial<Omit<Swatch, "id">>): Swatch[] {
  if (!palette.some((s) => s.id === id)) return palette;
  return palette.map((s) => (s.id === id ? { ...s, ...patch } : s));
}

export function setLocked(palette: Swatch[], id: string, locked: boolean): Swatch[] {
  return patchSwatch(palette, id, { locked });
}

export function renameSwatch(palette: Swatch[], id: string, name: string): Swatch[] {
  return patchSwatch(palette, id, { name });
}

/** Sets the base color. `extracted` is kept, so the swatch can still be reset (spec 3.7). */
export function setSwatchColor(palette: Swatch[], id: string, color: Oklch): Swatch[] {
  return patchSwatch(palette, id, { color });
}

export function setSwatchPoint(palette: Swatch[], id: string, point: ImagePoint | null): Swatch[] {
  return patchSwatch(palette, id, { point });
}

/**
 * Restores the extracted color and point, sets origin extracted and unlocks (spec 3.7 "Reset to
 * extracted"). A swatch extraction didn't make has nothing to restore.
 */
export function resetToExtracted(palette: Swatch[], id: string): Swatch[] {
  const extracted = palette.find((s) => s.id === id)?.extracted;
  if (!extracted) return palette;
  return patchSwatch(palette, id, {
    color: extracted.color,
    point: extracted.point,
    origin: "extracted",
    locked: false,
  });
}
