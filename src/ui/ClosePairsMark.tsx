/**
 * The close-pair warning beside the strip (spec 3.5; M3-T8): a warn dot plus text, so color is
 * never the only signal. It shows in the Image view only, since the Values view marks its own pair
 * with a bracket (M3-T14). It lives inside `StripMarks`, so it pins with the phone's strip dock.
 */
import { closePairs } from "../palette/close-pairs";
import { outputPalette, settings, viewSettings } from "../state/signals";

/** "Swatches 1 and 2 are very close" for a pair of palette indexes (shown 1-based). */
export const closePairText = (first: number, second: number): string =>
  `Swatches ${first + 1} and ${second + 1} are very close`;

export function ClosePairsMark() {
  const { distanceMetric, mergeThreshold } = settings.value;
  const pairs =
    viewSettings.value.mode === "image"
      ? closePairs(outputPalette.value, distanceMetric, mergeThreshold)
      : [];
  const [pair] = pairs;
  const more = pairs.length - 1;
  // The live region stays mounted so a pair that appears is announced (spec 6.3).
  return (
    <div class="live-region" role="status">
      {pair && (
        <p class="close-pairs-mark" data-testid="close-pairs-mark">
          <span class="close-dot" aria-hidden="true" />
          <span>
            {closePairText(pair.first, pair.second)}
            {more > 0 ? ` and ${more} more` : ""}
          </span>
        </p>
      )}
    </div>
  );
}
