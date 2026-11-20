/**
 * The gradient preview (ui-contract column 3 item 1; spec 4.4). M4-T2 gives it an interim body: the
 * CSS from `gradient-render` in a 2:1 box, `data-user-content` because a gradient is never themed
 * (spec 6.2). M4-T12 builds the real one (aspect, compare, the baked path, the checkerboard, the
 * vision simulation) and owns this file.
 *
 * The `data-*` attributes are the contract e2e tests read (plan "Rules"), so UI tasks can test
 * before the real preview lands; M4-T12 keeps them:
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
import { gradient, gradientPreview } from "../state/signals";
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
  return (
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
  );
}
