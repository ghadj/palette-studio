/**
 * The gradient model (spec 4.3, 7.5; plan M4-T1): pure operations on stop lists. Each returns a new
 * list and keeps the other stops' identity, or returns the list unchanged when there is nothing to
 * do (as `src/palette/model.ts` does for swatches). Nothing here reads state.
 */
import type { Gradient, GradientStop, Oklch, StopColor, Swatch } from "../types";

export const MIN_STOPS = 2;
export const MAX_STOPS = 32;

let nextId = 1;

/** A new stop id, unique within this page load. Generated stops use stable ids (`swatchStops`). */
export function newStopId(): string {
  const id = `stop-n${nextId}`;
  nextId += 1;
  return id;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** A stop with the defaults: alpha 1, no midpoint, unlocked. */
export function makeStop(
  position: number,
  color: StopColor,
  init: Partial<Omit<GradientStop, "position" | "color">> = {},
): GradientStop {
  return {
    id: init.id ?? newStopId(),
    position: clamp01(position),
    color,
    alpha: init.alpha ?? 1,
    hint: init.hint ?? 0.5,
    locked: init.locked ?? false,
  };
}

/** The stops sorted by position; equal positions keep their order. Returns `stops` if sorted. */
function sorted(stops: GradientStop[]): GradientStop[] {
  for (let i = 1; i < stops.length; i++) {
    if ((stops[i]?.position ?? 0) < (stops[i - 1]?.position ?? 0))
      return [...stops].sort((a, b) => a.position - b.position);
  }
  return stops;
}

/**
 * Stops linked to `swatches`, one each, with stable ids (`stop-<swatch id>`) so a selection
 * survives a rebuild. Without `positions` they are spread evenly; one swatch gives two stops.
 */
export function swatchStops(
  swatches: readonly Swatch[],
  positions?: readonly number[],
): GradientStop[] {
  if (swatches.length === 0) return [];
  const first = swatches[0] as Swatch;
  if (swatches.length === 1) {
    return [
      makeStop(0, { kind: "swatch", id: first.id }, { id: `stop-${first.id}`, alpha: first.alpha }),
      makeStop(
        1,
        { kind: "swatch", id: first.id },
        { id: `stop-${first.id}-end`, alpha: first.alpha },
      ),
    ];
  }
  const last = swatches.length - 1;
  return swatches.map((s, i) =>
    makeStop(
      positions?.[i] ?? i / last,
      { kind: "swatch", id: s.id },
      {
        id: `stop-${s.id}`,
        alpha: s.alpha,
      },
    ),
  );
}

/** Adds a fixed-color stop at `position` (plan D4); refuses at 32 stops. */
export function addStop(
  stops: GradientStop[],
  position: number,
  color: Oklch,
  init: { alpha?: number; id?: string } = {},
): GradientStop[] {
  if (stops.length >= MAX_STOPS) return stops;
  const stop = makeStop(position, { kind: "value", color, from: null }, init);
  return sorted([...stops, stop]);
}

/** Moves a stop, re-sorting the list; ids stay. A locked stop doesn't move (plan D6). */
export function moveStop(stops: GradientStop[], id: string, position: number): GradientStop[] {
  const stop = stops.find((s) => s.id === id);
  if (!stop || stop.locked) return stops;
  const at = clamp01(position);
  if (at === stop.position) return stops;
  return sorted(stops.map((s) => (s.id === id ? { ...s, position: at } : s)));
}

/** Removes a stop; refuses below 2 stops, and for a locked stop. */
export function removeStop(stops: GradientStop[], id: string): GradientStop[] {
  const stop = stops.find((s) => s.id === id);
  if (!stop || stop.locked || stops.length <= MIN_STOPS) return stops;
  return stops.filter((s) => s.id !== id);
}

function patchStop(
  stops: GradientStop[],
  id: string,
  patch: (s: GradientStop) => GradientStop,
): GradientStop[] {
  if (!stops.some((s) => s.id === id)) return stops;
  return stops.map((s) => (s.id === id ? patch(s) : s));
}

/** Sets a fixed color, detaching a linked stop; `from` remembers the swatch for Relink (spec 4.3). */
export function setStopColor(stops: GradientStop[], id: string, color: Oklch): GradientStop[] {
  return patchStop(stops, id, (s) => ({
    ...s,
    color: { kind: "value", color, from: s.color.kind === "swatch" ? s.color.id : s.color.from },
  }));
}

/** Links a stop to a swatch. */
export function linkStop(stops: GradientStop[], id: string, swatchId: string): GradientStop[] {
  return patchStop(stops, id, (s) => ({ ...s, color: { kind: "swatch", id: swatchId } }));
}

/**
 * Relinks a detached stop to the swatch it came from (plan D30). Nothing changes when it never had
 * one, or when `exists` says the swatch is gone.
 */
export function relinkStop(
  stops: GradientStop[],
  id: string,
  exists: (swatchId: string) => boolean = () => true,
): GradientStop[] {
  const stop = stops.find((s) => s.id === id);
  if (stop?.color.kind !== "value" || stop.color.from === null) return stops;
  if (!exists(stop.color.from)) return stops;
  return linkStop(stops, id, stop.color.from);
}

export function setAlpha(stops: GradientStop[], id: string, alpha: number): GradientStop[] {
  return patchStop(stops, id, (s) => ({ ...s, alpha: clamp01(alpha) }));
}

export function setHint(stops: GradientStop[], id: string, hint: number): GradientStop[] {
  return patchStop(stops, id, (s) => ({ ...s, hint: Math.min(0.99, Math.max(0.01, hint)) }));
}

export function setLocked(stops: GradientStop[], id: string, locked: boolean): GradientStop[] {
  return patchStop(stops, id, (s) => ({ ...s, locked }));
}

/** Stores the stops currently in effect and sets Custom (plan Q1a). */
export function materialize(gradient: Gradient, effectiveStops: GradientStop[]): Gradient {
  return { ...gradient, custom: true, stops: effectiveStops };
}

/** A derived stop's color: the base with its hue shifted and, if set, its lightness replaced (D17). */
export function deriveColor(base: Oklch, derive: { hueShift: number; lightness?: number }): Oklch {
  return {
    l: derive.lightness ?? base.l,
    c: base.c,
    h: (((base.h + derive.hueShift) % 360) + 360) % 360,
  };
}

/**
 * Deleting or replacing swatches fixes the colors of their stops (spec 4.3): each becomes a value
 * stop with the swatch's last output color. `lastColors` maps a swatch id to that color. The
 * Colors subset forgets the removed swatches too.
 */
export function detachRemoved(
  gradient: Gradient,
  removedIds: readonly string[],
  lastColors: ReadonlyMap<string, Oklch>,
): Gradient {
  const removed = new Set(removedIds);
  const stops = gradient.stops.map((s): GradientStop => {
    if (s.color.kind !== "swatch" || !removed.has(s.color.id)) return s;
    const base = lastColors.get(s.color.id);
    if (!base) return s;
    const color = s.color.derive ? deriveColor(base, s.color.derive) : base;
    return { ...s, color: { kind: "value", color, from: s.color.id } };
  });
  const picked = gradient.technique.colors.ids.filter((id) => !removed.has(id));
  const changedStops = stops.some((s, i) => s !== gradient.stops[i]);
  const changedPicks = picked.length !== gradient.technique.colors.ids.length;
  if (!changedStops && !changedPicks) return gradient;
  return {
    ...gradient,
    stops,
    technique: changedPicks
      ? { ...gradient.technique, colors: { ...gradient.technique.colors, ids: picked } }
      : gradient.technique,
  };
}

/** A stop as the preview and the bake read it (plan T1). */
export interface ResolvedStop {
  id: string;
  /** 0 to 1, after reverse and mirror. */
  position: number;
  /** The output color: after adjustments, and with a derived stop's offset. */
  color: Oklch;
  alpha: number;
  /** Midpoint within the segment to the next resolved stop; 0.5 is none. */
  hint: number;
  link: "swatch" | "derived" | "value";
}

/** Reverses a resolved list: p becomes 1 − p, and each segment's midpoint flips. */
function reversed(list: ResolvedStop[]): ResolvedStop[] {
  return list
    .map((s, i) => ({ s, i }))
    .reverse()
    .map(({ s, i }) => ({
      ...s,
      position: 1 - s.position,
      // The segment that ran from stop i − 1 to stop i now runs from i to i − 1.
      hint: i > 0 ? 1 - (list[i - 1]?.hint ?? 0.5) : 0.5,
    }));
}

/**
 * The stops as rendered. A swatch stop takes the swatch's color from `outputPalette`; a stop whose
 * swatch is missing is skipped. Reverse (p → 1 − p) and mirror (a palindrome over 0 to 1) apply
 * here and never change the stored stops (plan D21); reverse comes first.
 */
export function resolveStops(
  gradient: Gradient,
  stops: readonly GradientStop[],
  outputPalette: readonly Swatch[],
): ResolvedStop[] {
  const byId = new Map(outputPalette.map((s) => [s.id, s]));
  let list: ResolvedStop[] = [];
  for (const stop of stops) {
    let color: Oklch;
    let link: ResolvedStop["link"];
    if (stop.color.kind === "swatch") {
      const swatch = byId.get(stop.color.id);
      if (!swatch) continue;
      link = stop.color.derive ? "derived" : "swatch";
      color = stop.color.derive ? deriveColor(swatch.color, stop.color.derive) : swatch.color;
    } else {
      link = "value";
      color = stop.color.color;
    }
    list.push({
      id: stop.id,
      position: stop.position,
      color,
      alpha: stop.alpha,
      hint: stop.hint,
      link,
    });
  }
  if (list.length > 0) {
    // The last stop has no segment after it.
    const last = list[list.length - 1] as ResolvedStop;
    list[list.length - 1] = { ...last, hint: 0.5 };
  }
  const { reverse, mirror } = gradient.geometry;
  if (reverse) list = reversed(list);
  if (mirror && list.length > 1) {
    const back = reversed(list);
    const front = list.slice(0, -1).map((s) => ({ ...s, position: s.position / 2 }));
    list = [...front, ...back.map((s) => ({ ...s, position: 0.5 + s.position / 2 }))];
    // The middle stop's midpoint is the one of the mirrored segment next to it (set by reversed()).
    const last = list[list.length - 1] as ResolvedStop;
    list[list.length - 1] = { ...last, hint: 0.5 };
  }
  return list;
}
