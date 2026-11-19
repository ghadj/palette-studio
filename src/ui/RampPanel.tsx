/**
 * The Ramp panel (spec 3.4; M3 decision 4b), opened by the editor's Ramp pill: in place under the
 * editor on desktop, a bottom sheet on phones (spec 6.1). M3-T7 builds it: the 11-step ramp and the
 * harmonies, each tile addable to the palette. A stub until then.
 */
import { COMING_SOON } from "./comingSoon";

/** The panel's name: the sheet title on phones. */
export const RAMP_TITLE = "Ramp";

export function RampPanel() {
  return (
    <div class="ramp-panel" data-testid="ramp-panel">
      <p class="hint panel-stub">{COMING_SOON}</p>
    </div>
  );
}
