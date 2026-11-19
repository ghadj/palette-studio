/**
 * The Adjustments row's content (spec 3.3, 3.6; ui-contract column 2 item 5): in place on desktop,
 * a bottom sheet on phones. M3-T6 builds it: one `Slider` per adjustment, Even out, Harmonize,
 * Gamut, Reset and the before/after Compare toggle. A stub until then.
 */
import { COMING_SOON } from "./comingSoon";

export function AdjustmentsPanel() {
  return (
    <div class="adjustments-panel" data-testid="adjustments-panel">
      <p class="hint panel-stub">{COMING_SOON}</p>
    </div>
  );
}
