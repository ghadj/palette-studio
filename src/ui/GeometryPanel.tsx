/**
 * The Geometry chevron row (spec 4.3; plan D21, D24): angle with its dial and presets, radial shape,
 * size and center, conic start angle and center, Reverse and Mirror. M4-T2 places the row with its
 * content stub; M4-T6 builds the content, the header count and reset-all, and owns this file (and
 * `AngleDial.tsx`).
 */
import { ChevronRow } from "./ChevronRow";
import { COMING_SOON } from "./comingSoon";

export function GeometryPanel() {
  return <p class="hint">{COMING_SOON}</p>;
}

export function GeometryRow() {
  return (
    <ChevronRow id="geometry" label="Geometry">
      <GeometryPanel />
    </ChevronRow>
  );
}
