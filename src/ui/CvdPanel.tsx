/**
 * The CVD row's content (spec 3.5; plan D6): in place on desktop, a bottom sheet on phones. M3-T9
 * builds it: a Normal strip and one simulated strip per type. A stub until then.
 */
import { COMING_SOON } from "./comingSoon";

export function CvdPanel() {
  return (
    <div class="cvd-panel" data-testid="cvd-panel">
      <p class="hint panel-stub">{COMING_SOON}</p>
    </div>
  );
}
