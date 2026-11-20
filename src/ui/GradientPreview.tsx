/**
 * The gradient preview (ui-contract column 3 item 1; spec 4.4, 4.5, 6.2; plan M4-T12, D22, D23,
 * decision 68).
 *
 * - A stage with the surround behind it: `--color-surface-sunken` for Match theme, else the fixed
 *   `--surround-*` tokens (the setting is T13's control; it is only read here).
 * - The preview at one fixed aspect, 2:1 at full width. On phones its height is capped so the dock
 *   (preview and stop bar) stays within about 35% of the screen (decision 67).
 * - It draws `render.css` (native or baked, `data-render`). A checkerboard sits behind it only while
 *   a stop has alpha below 1.
 * - Compare, the vision simulation, the text check and the aspect control were removed by the user
 *   (decision 68); the preview has no options.
 *
 * The `data-*` attributes are the contract e2e tests read (plan "Rules"):
 * - `data-stops`: the resolved stops after reverse and mirror, as `HEX@P` entries (8-digit HEX when
 *   not opaque, P in percent) with `~H` hint entries for midpoints off 50%, such as
 *   `#1DB07A@0,~30,#D4527F@50,#5039B0@100`
 * - `data-type`, `data-angle`, `data-space`, `data-hue`, `data-easing`, `data-render` (`native` or
 *   `baked`) and `data-cvd`
 */
import { stopHex } from "../gradient/css";
import type { ResolvedStop } from "../gradient/model";
import { render } from "../state/gradient-render";
import { resolvedStops } from "../state/gradient-stops";
import { gradient, gradientPreview, surround } from "../state/signals";
import { TextOverlay } from "./TextOverlay";

const num = (n: number): string => String(Math.round(n * 1000) / 1000);

/** The `data-stops` value for resolved stops (see the file comment). */
export function stopsAttribute(stops: readonly ResolvedStop[]): string {
  const parts: string[] = [];
  for (const [i, s] of stops.entries()) {
    parts.push(`${stopHex(s)}@${num(s.position * 100)}`);
    if (i < stops.length - 1 && s.hint !== 0.5) parts.push(`~${num(s.hint * 100)}`);
  }
  return parts.join(",");
}

export function GradientPreview() {
  const g = gradient.value;
  const { css, mode } = render.value;
  const checker = resolvedStops.value.some((s) => s.alpha < 1);
  return (
    <div class="gradient-stage" data-testid="gradient-stage" data-surround={surround.value}>
      <div class="gradient-frame" data-checker={checker ? "" : undefined}>
        <div
          class="gradient-preview"
          data-testid="gradient-preview"
          data-user-content=""
          role="img"
          aria-label="Gradient preview"
          data-stops={stopsAttribute(resolvedStops.value)}
          data-type={g.type}
          data-angle={String(g.geometry.angle)}
          data-space={g.space}
          data-hue={g.hue}
          data-easing={g.easing.kind}
          data-render={mode}
          data-cvd={gradientPreview.value.cvd}
          style={css ? { background: css } : undefined}
        >
          <TextOverlay />
        </div>
      </div>
    </div>
  );
}
