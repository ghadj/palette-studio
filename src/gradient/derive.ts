/**
 * Derived stops (spec 4.2; plan D17): analogous, complementary, monochrome and warm-to-cool, made
 * from one base swatch. They stay linked to it through `StopColor.derive`, so its edits flow in.
 * `sources.ts` calls `derivedStops`.
 */
import type { GradientStop, Oklch, Swatch, Technique } from "../types";
import { makeStop } from "./model";

type DeriveKind = Technique["derive"]["kind"];

/** The ramp's lightness for a step label (src/color/ramps.ts: 0.97 down to 0.25 over 10 steps). */
function rampL(label: number): number {
  const index = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].indexOf(label);
  return 0.97 - (0.72 * index) / 10;
}

/** The signed shorter-arc hue difference from `from` to `to`, in degrees (-180 to 180]. */
function arc(from: number, to: number): number {
  const d = (((to - from) % 360) + 360) % 360;
  return d > 180 ? d - 360 : d;
}

/** Each stop's offset from the base: a hue shift and, for monochrome, a lightness (D17). */
function offsets(kind: DeriveKind, base: Oklch): Array<{ hueShift: number; lightness?: number }> {
  switch (kind) {
    case "analogous":
      return [{ hueShift: -30 }, { hueShift: 0 }, { hueShift: 30 }];
    case "complementary":
      return [{ hueShift: 0 }, { hueShift: 180 }];
    case "monochrome":
      // Ramp steps 900 to 100 (M3 D4): dark to light.
      return [900, 700, 500, 300, 100].map((label) => ({ hueShift: 0, lightness: rampL(label) }));
    case "warm-cool":
      // Warm and cool pull the hue 50% of the way toward 60 and toward 240.
      return [
        { hueShift: 0.5 * arc(base.h, 60) },
        { hueShift: 0 },
        { hueShift: 0.5 * arc(base.h, 240) },
      ];
  }
}

/** Linked stops for `kind` from the swatch `baseId` (color `baseColor`), spread evenly (D17). */
export function deriveStops(kind: DeriveKind, baseId: string, baseColor: Oklch): GradientStop[] {
  const list = offsets(kind, baseColor);
  return list.map((derive, i) =>
    makeStop(
      i / (list.length - 1),
      { kind: "swatch", id: baseId, derive },
      { id: `stop-${baseId}-${kind}-${i}` },
    ),
  );
}

/**
 * Stops for the Derived technique. The base is `technique.derive.from`, or the first swatch when
 * it is null or gone (plan D17).
 */
export function derivedStops(technique: Technique, swatches: readonly Swatch[]): GradientStop[] {
  const base = swatches.find((s) => s.id === technique.derive.from) ?? swatches[0];
  if (!base) return [];
  return deriveStops(technique.derive.kind, base.id, base.color);
}
