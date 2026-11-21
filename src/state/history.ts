/**
 * Undo and redo (spec 3.6): 50 steps of snapshots of the palette, the adjustments, the
 * extraction settings (M3 decision 3a) and the gradient (M4 plan T1). View state (selection, tab, zoom, view settings, markers,
 * compare) is never recorded, so undo never moves the view.
 *
 * The store keeps the last committed state. `commit` pushes it as the "before" of a new step, so
 * only states that were committed are ever restored: an uncommitted change (such as a settings
 * change whose re-extraction hasn't landed) is dropped by undo, and redo returns to the committed
 * state instead.
 */
import { batch, computed, signal } from "@preact/signals";
import type { Adjustments, ExtractionSettings, Gradient, Swatch } from "../types";
import { effectiveStops } from "./gradient-stops";
import {
  adjustments,
  gradient,
  palette,
  selectedStopId,
  selectedSwatchId,
  settings,
} from "./signals";

export const HISTORY_LIMIT = 50;

export interface Snapshot {
  palette: Swatch[];
  adjustments: Adjustments;
  settings: ExtractionSettings;
  gradient: Gradient;
}

interface Step {
  /** The state on the other side of the step. */
  snapshot: Snapshot;
  label: string;
}

const past = signal<readonly Step[]>([]);
const future = signal<readonly Step[]>([]);

export const canUndo = computed(() => past.value.length > 0);
export const canRedo = computed(() => future.value.length > 0);
/** The step Undo would revert, such as "Colors"; null when there is none. */
export const undoLabel = computed(() => past.value[past.value.length - 1]?.label ?? null);
export const redoLabel = computed(() => future.value[future.value.length - 1]?.label ?? null);

const capture = (): Snapshot => ({
  palette: palette.peek(),
  adjustments: adjustments.peek(),
  settings: settings.peek(),
  gradient: gradient.peek(),
});

let committed: Snapshot = capture();
let depth = 0;
let pendingLabel: string | null = null;
let restoring = false;
const restoreListeners = new Set<() => void>();

const same = (a: Snapshot, b: Snapshot): boolean =>
  a.palette === b.palette &&
  a.adjustments === b.adjustments &&
  a.settings === b.settings &&
  a.gradient === b.gradient;

/** The last committed state, for example to name what a pending change touched. */
export function committedState(): Snapshot {
  return committed;
}

/** True while a snapshot is being applied: a settings change then doesn't extract. */
export function isRestoring(): boolean {
  return restoring;
}

/**
 * Called before undo or redo applies a snapshot, for example to cancel a pending re-extraction so
 * its result can't land over the restored state.
 */
export function onRestore(listener: () => void): () => void {
  restoreListeners.add(listener);
  return () => restoreListeners.delete(listener);
}

/**
 * Records the change since the last commit as one step. Nothing is recorded when nothing changed.
 * Between `begin` and `end` it only remembers the label, so a drag is one step (plan D16).
 */
export function commit(label: string): void {
  if (depth > 0) {
    pendingLabel = label;
    return;
  }
  const now = capture();
  if (same(now, committed)) return;
  past.value = [...past.value, { snapshot: committed, label }].slice(-HISTORY_LIMIT);
  future.value = [];
  committed = now;
}

/** Starts coalescing: commits until the matching `end` make one step. */
export function begin(): void {
  depth += 1;
}

/** Ends coalescing and commits once, with `label` or the last label committed inside. */
export function end(label?: string): void {
  if (depth === 0) return;
  depth -= 1;
  if (depth > 0) return;
  const name = label ?? pendingLabel;
  pendingLabel = null;
  if (name !== null) commit(name);
}

function apply(snapshot: Snapshot): void {
  for (const listener of restoreListeners) listener();
  const selectedIndex = palette.peek().findIndex((s) => s.id === selectedSwatchId.peek());
  const stopIndex = effectiveStops.peek().findIndex((s) => s.id === selectedStopId.peek());
  restoring = true;
  try {
    batch(() => {
      palette.value = snapshot.palette;
      adjustments.value = snapshot.adjustments;
      settings.value = snapshot.settings;
      gradient.value = snapshot.gradient;
      // Selection is view state and stays put. If its swatch isn't in the restored palette, the
      // swatch at the same position stays selected, as after a re-extraction.
      const id = selectedSwatchId.peek();
      if (id !== null && !snapshot.palette.some((s) => s.id === id)) {
        const at = Math.min(selectedIndex, snapshot.palette.length - 1);
        selectedSwatchId.value = at >= 0 ? (snapshot.palette[at]?.id ?? null) : null;
      }
      // The same for the selected stop (M4 plan T1): the stop at the same position stays selected.
      const stopId = selectedStopId.peek();
      const stops = effectiveStops.peek();
      if (stopId !== null && !stops.some((s) => s.id === stopId)) {
        const at = Math.min(stopIndex, stops.length - 1);
        selectedStopId.value = at >= 0 ? (stops[at]?.id ?? null) : null;
      }
    });
  } finally {
    restoring = false;
  }
}

export function undo(): void {
  const step = past.value[past.value.length - 1];
  if (!step) return;
  depth = 0;
  pendingLabel = null;
  batch(() => {
    past.value = past.value.slice(0, -1);
    future.value = [...future.value, { snapshot: committed, label: step.label }];
  });
  committed = step.snapshot;
  apply(step.snapshot);
}

export function redo(): void {
  const step = future.value[future.value.length - 1];
  if (!step) return;
  depth = 0;
  pendingLabel = null;
  batch(() => {
    future.value = future.value.slice(0, -1);
    past.value = [...past.value, { snapshot: committed, label: step.label }];
  });
  committed = step.snapshot;
  apply(step.snapshot);
}

/** Empties both stacks and takes the current state as committed (a new image, decision 3b). */
export function clear(): void {
  depth = 0;
  pendingLabel = null;
  committed = capture();
  batch(() => {
    past.value = [];
    future.value = [];
  });
}
