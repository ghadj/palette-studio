/**
 * Re-extraction that keeps locked and pinned swatches (spec 3.6, 3.7; M3 decisions 2a to 2c, 24, 25). Pure.
 *
 * The total stays at the number of extracted colors (Colors): for each locked swatch, the nearest
 * new color is dropped (2a). Locked swatches keep their positions, and the new colors fill the
 * other slots in their sort order (2b). Everything neither locked nor pinned, manual swatches included, is
 * replaced (2c). A locked swatch is returned as the same object, so its id, point, origin and
 * `extracted` all survive.
 */
import { oklchToOklab } from "../color/convert";
import { deltaE } from "../color/delta-e";
import type { DistanceMetric, Swatch } from "../types";
import { isKept } from "./model";

export function mergeKept(
  previous: readonly Swatch[],
  extracted: readonly Swatch[],
  metric: DistanceMetric,
): Swatch[] {
  const locked = previous
    .map((swatch, index) => ({ swatch, index }))
    .filter((e) => isKept(e.swatch));
  if (locked.length === 0) return [...extracted];
  const total = extracted.length;
  // As many locked swatches as slots: nothing new is added.
  if (locked.length >= total) return locked.map((e) => e.swatch);

  // Drop, for each locked swatch in turn, the nearest color still in the pool.
  const pool = [...extracted];
  for (const { swatch } of locked) {
    const lab = oklchToOklab(swatch.color);
    let nearest = 0;
    let best = Number.POSITIVE_INFINITY;
    pool.forEach((candidate, i) => {
      const d = deltaE(metric, lab, oklchToOklab(candidate.color));
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    pool.splice(nearest, 1);
  }

  // Locked swatches take their old position, or the nearest free slot when it is gone or taken.
  const slots: Array<Swatch | null> = new Array(total).fill(null);
  for (const { swatch, index } of locked) {
    let at = Math.min(index, total - 1);
    if (slots[at]) {
      let up = at;
      while (up < total && slots[up]) up += 1;
      let down = at;
      while (down >= 0 && slots[down]) down -= 1;
      at = up < total ? up : down;
    }
    slots[at] = swatch;
  }
  let next = 0;
  return slots.map((slot) => slot ?? (pool[next++] as Swatch));
}
