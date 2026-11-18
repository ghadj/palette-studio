/** Swatch creation and selection helpers (spec 3.1). */
import { type Oklab, oklabToOklch, oklchToHex, oklchToOklab } from "../color/convert";
import type { Swatch } from "../types";

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
