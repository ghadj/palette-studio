/**
 * Which swatch's cluster map shows over the image (spec 2.6). View state: not in the project and
 * not in undo (spec 3.6).
 *
 * On desktop, hovering a swatch with a fine pointer or focusing it from the keyboard shows its map.
 * Nothing depends on hover (spec 6.1 "No hover"): on phones a "Cluster map" toggle in the swatch
 * sheet shows the selected swatch's map (M2 decision 13d).
 * The mockup state's `cluster=<n>` parameter pins a swatch's map (decision 14b).
 */
import { computed, signal } from "@preact/signals";
import type { ClusterMap } from "../extract/cluster-map";
import { clusterMap, outputPalette, selectedSwatchId } from "./signals";

/** The swatch under a fine pointer. */
export const clusterHover = signal<string | null>(null);
/** The swatch with keyboard focus. */
export const clusterFocus = signal<string | null>(null);
/** The swatch the mockup state's `cluster` parameter shows. */
export const clusterPinned = signal<string | null>(null);
/** The phone's "Cluster map" toggle: shows the selected swatch's map (decision 13d). */
export const clusterToggle = signal(false);

export interface ShownCluster {
  /** The swatch whose map shows. */
  id: string;
  /** Its palette index, which is its label in the map. */
  index: number;
  map: ClusterMap;
  /** Its share of the image's kept pixels (plain pixel share, see the M2 plan under T14). */
  share: number;
}

/**
 * The map on show, or null. Hover wins over focus, focus over the pin, the pin over the toggle.
 * It shows only while the map belongs to the palette on screen.
 */
export const shownCluster = computed<ShownCluster | null>(() => {
  const id =
    clusterHover.value ??
    clusterFocus.value ??
    clusterPinned.value ??
    (clusterToggle.value ? selectedSwatchId.value : null);
  const map = clusterMap.value;
  const swatches = outputPalette.value;
  if (id === null || !map || map.shares.length !== swatches.length) return null;
  const index = swatches.findIndex((s) => s.id === id);
  if (index < 0) return null;
  return { id, index, map, share: map.shares[index] ?? 0 };
});

/** A share as a percentage with one decimal, always with a period (spec 5), such as "0.5%". */
export function shareText(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}
