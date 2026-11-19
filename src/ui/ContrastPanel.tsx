/**
 * The Contrast row's content (spec 3.5; M3 decision 6c): in place on desktop, a bottom sheet on
 * phones. M3-T8 builds it: the swatch × swatch WCAG 2.x matrix with badges, and the close pairs.
 * A stub until then.
 */
import { COMING_SOON } from "./comingSoon";

export function ContrastPanel() {
  return (
    <div class="contrast-panel" data-testid="contrast-panel">
      <p class="hint panel-stub">{COMING_SOON}</p>
    </div>
  );
}
