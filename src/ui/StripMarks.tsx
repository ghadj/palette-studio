/**
 * The line under the swatch strip (M3-T2 slot), shown wherever the strip is: the desktop Palette
 * column and the phone Source and Palette tabs (inside the sticky strip dock, so it pins with the
 * strip). When swatches are flagged as close, the strip draws a dot in their top-left corner and
 * this line is the legend: the same dot and "Close in value" (Values view, spec 3.8) or "Very close
 * colors" (Image view, spec 3.5; Palette tab and desktop only, M3 decision 32). Pairs are not
 * listed (M3 decisions 51 and 52). A live region announces one general sentence when the set of
 * flagged swatches changes (spec 6.3).
 */
import { closeFlags, swatchList } from "./closeFlags";

export function StripMarks({ closePairs = true }: { closePairs?: boolean }) {
  const { kind, partners } = closeFlags();
  const shown = kind === "value" || (kind === "color" && closePairs) ? kind : null;
  // The sentence names the flagged swatches, so it changes (and is re-announced) when the set does.
  const which = shown ? `: ${swatchList([...partners.keys()].sort((a, b) => a - b))}.` : "";
  const sentence =
    shown === "value"
      ? `Some colors are close in value${which}`
      : shown === "color"
        ? `Some colors are very close${which}`
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
      <p class="visually-hidden" role="status" data-testid="close-announce">
        {sentence}
      </p>
    </div>
  );
}
