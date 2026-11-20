/**
 * Which swatches are flagged as close, for the corner dots and the legend (M3 decisions 51 and 52;
 * spec 3.5, 3.8). One dot style serves both conditions, because they never show together: the
 * Values view flags swatches that are close in value, the Image view flags very close colors, and
 * the Palette view flags nothing. Pairs are not listed anywhere; the dots, one legend line and one
 * live sentence are the only indication.
 */
import { closePairs } from "../palette/close-pairs";
import { closeInValue } from "../palette/values";
import { outputPalette, settings, viewSettings } from "../state/signals";

export type CloseKind = "value" | "color";

export interface CloseFlags {
  kind: CloseKind | null;
  /** For each flagged swatch index, the 0-based indexes it is close to. */
  partners: Map<number, number[]>;
}

/** Reads the signals it needs, so a component calling it re-renders when they change. */
export function closeFlags(): CloseFlags {
  const view = viewSettings.value;
  const swatches = outputPalette.value;
  let kind: CloseKind | null = null;
  let pairs: { first: number; second: number }[] = [];
  if (view.mode === "values") {
    kind = "value";
    pairs = closeInValue(swatches, view.closeInValue);
  } else if (view.mode === "image") {
    kind = "color";
    const { distanceMetric, mergeThreshold } = settings.value;
    pairs = closePairs(swatches, distanceMetric, mergeThreshold);
  }
  const partners = new Map<number, number[]>();
  for (const { first, second } of pairs) {
    partners.set(first, [...(partners.get(first) ?? []), second]);
    partners.set(second, [...(partners.get(second) ?? []), first]);
  }
  return { kind: partners.size > 0 ? kind : null, partners };
}

/** "close in value to swatch 2" or "very close to swatches 1 and 4", for a swatch's description. */
export function closeDescription(kind: CloseKind, partners: readonly number[]): string {
  const list = partners.map((i) => i + 1);
  const names =
    list.length === 1
      ? `swatch ${list[0]}`
      : `swatches ${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
  return kind === "value" ? `Close in value to ${names}` : `Very close to ${names}`;
}
