/**
 * The Stop row's actions (plan M4-T8; spec 4.3 "Stops"): each edits the selected stop through
 * `editStops`, so it is one undo step and sets Custom (plan Q1a). An edit that changes nothing
 * records nothing and leaves the technique alone. Position units convert here too (plan D3).
 */
import type { Oklch } from "../color/convert";
import {
  linkStop,
  moveStop,
  relinkStop,
  removeStop,
  setAlpha,
  setHint,
  setLocked,
  setStopColor,
} from "../gradient/model";
import type { GradientStop } from "../types";
import { editStops, effectiveStops, selectStop } from "./gradient";
import { palette, selectedStopId } from "./signals";

export type PositionUnit = "%" | "px";

/** The selected stop, or null when none is selected or the selection is gone. */
export function selectedStop(): GradientStop | null {
  const id = selectedStopId.value;
  return effectiveStops.value.find((s) => s.id === id) ?? null;
}

/** The selected stop's index in position order, or -1. */
export function selectedStopIndex(): number {
  const id = selectedStopId.value;
  return effectiveStops.value.findIndex((s) => s.id === id);
}

/** Applies `change` to the selected stop's list as one step, unless it leaves everything as is. */
function editSelected(
  label: string,
  change: (stops: GradientStop[], id: string) => GradientStop[],
): boolean {
  const id = selectedStopId.peek();
  if (id === null) return false;
  let changed = false;
  editStops((stops) => {
    const next = change(stops, id);
    const same =
      next === stops || (next.length === stops.length && next.every((s, i) => s === stops[i]));
    changed = !same;
    return same ? stops : next;
  }, label);
  return changed;
}

/** Sets a fixed color, which detaches a linked stop. */
export function setSelectedColor(color: Oklch): void {
  editSelected("Stop color", (stops, id) => {
    const stop = stops.find((s) => s.id === id);
    if (stop?.color.kind === "value") {
      const c = stop.color.color;
      if (c.l === color.l && c.c === color.c && c.h === color.h) return stops;
    }
    return setStopColor(stops, id, color);
  });
}

/** Links the selected stop to a swatch (the chips). */
export function linkSelectedStop(swatchId: string): void {
  editSelected("Link stop", (stops, id) => {
    const stop = stops.find((s) => s.id === id);
    if (stop?.color.kind === "swatch" && stop.color.id === swatchId && !stop.color.derive)
      return stops;
    return linkStop(stops, id, swatchId);
  });
}

/** Whether the selected stop is a fixed color that remembers a swatch still in the palette. */
export function canRelink(stop: GradientStop | null): boolean {
  if (stop?.color.kind !== "value" || stop.color.from === null) return false;
  const from = stop.color.from;
  return palette.value.some((s) => s.id === from);
}

/** Relinks the selected detached stop to the swatch it came from (plan D30); false if it can't. */
export function relinkSelectedStop(): boolean {
  return editSelected("Relink stop", (stops, id) =>
    relinkStop(stops, id, (swatchId) => palette.peek().some((s) => s.id === swatchId)),
  );
}

/** Moves the selected stop (a fraction, 0 to 1), re-sorting; a locked stop doesn't move. */
export function setSelectedPosition(position: number): void {
  editSelected("Stop position", (stops, id) => moveStop(stops, id, position));
}

export function setSelectedAlpha(alpha: number): void {
  editSelected("Stop alpha", (stops, id) => {
    const stop = stops.find((s) => s.id === id);
    return stop && stop.alpha === Math.min(1, Math.max(0, alpha))
      ? stops
      : setAlpha(stops, id, alpha);
  });
}

export function setSelectedHint(hint: number): void {
  editSelected("Midpoint", (stops, id) => {
    const stop = stops.find((s) => s.id === id);
    return stop && stop.hint === hint ? stops : setHint(stops, id, hint);
  });
}

export function setSelectedLocked(locked: boolean): void {
  editSelected(locked ? "Lock stop" : "Unlock stop", (stops, id) => {
    const stop = stops.find((s) => s.id === id);
    return stop && stop.locked === locked ? stops : setLocked(stops, id, locked);
  });
}

/** Removes the selected stop and selects the one that takes its place; false if refused. */
export function removeSelectedStop(): boolean {
  const index = selectedStopIndex();
  const removed = editSelected("Remove stop", (stops, id) => removeStop(stops, id));
  if (!removed) return false;
  const stops = effectiveStops.peek();
  selectStop(stops[Math.min(index, stops.length - 1)]?.id ?? null);
  return true;
}

/** The width a px position is measured against: the rendered preview. */
export function previewWidth(): number {
  const el = document.querySelector<HTMLElement>("[data-testid=gradient-preview]");
  return el?.clientWidth ?? 0;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** A stop position, 0 to 1, as it is shown in `unit`, to one decimal. */
export function fractionToUnit(fraction: number, unit: PositionUnit, width: number): number {
  return round1(unit === "%" ? fraction * 100 : fraction * width);
}

/** A typed position in `unit` as a fraction, clamped to 0 to 1. */
export function unitToFraction(value: number, unit: PositionUnit, width: number): number {
  const fraction = unit === "%" ? value / 100 : width > 0 ? value / width : 0;
  return Math.min(1, Math.max(0, fraction));
}
