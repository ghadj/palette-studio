/**
 * The line under the swatch strip (M3-T2 slot), shown wherever the strip is: the desktop Palette
 * column and the phone Source and Palette tabs (inside the sticky strip dock, so it pins with the
 * strip). When swatches are flagged as close, the strip draws a dot in their top-left corner and
 * this line is the legend: the same dot and "Close in value" (Values view, spec 3.8) or "Very close
 * colors" (Image view, spec 3.5; Palette tab and desktop only, M3 decision 32). Pairs are not
 * listed (M3 decisions 51 and 52). A live region announces one general sentence when the set of
 * flagged swatches changes (spec 6.3).
 */
import type { ComponentChildren } from "preact";
import { closeFlags } from "./closeFlags";

export function StripMarks({
  closePairs = true,
  trailing,
}: {
  closePairs?: boolean;
  /** A control right-aligned on the legend line (the phone Export button, M3 decision 53). */
  trailing?: ComponentChildren;
}) {
  const { kind, partners } = closeFlags();
  const shown = kind === "value" || (kind === "color" && closePairs) ? kind : null;
  const sentence =
    shown === "value"
      ? "Some colors are close in value."
      : shown === "color"
        ? "Some colors are very close."
        : "";
  return (
    <div
      class="strip-marks"
      data-testid="strip-marks"
      data-flags={shown ? [...partners.keys()].join(",") : undefined}
    >
      {shown && (
        <p class="close-legend" data-testid="close-legend" aria-hidden="true">
          <span class="close-dot" />
          <span>{shown === "value" ? "Close in value" : "Very close colors"}</span>
        </p>
      )}
      {trailing && <span class="strip-marks__trailing">{trailing}</span>}
      <p class="visually-hidden" role="status" data-testid="close-announce">
        {sentence}
      </p>
    </div>
  );
}
