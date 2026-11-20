/**
 * The stop bar (ui-contract column 3 item 3; Components "Stop handle"): a thin rounded bar showing
 * the gradient with a round handle for each stop, in the stop's color, with a light ring and an
 * accent ring on the selected stop. M4-T2 leaves it static; M4-T7 builds it (add, drag, select,
 * keyboard) and owns this file. It reads the stops through `resolvedStops` and changes them only
 * through the `src/state/gradient.ts` actions.
 */
import { oklchToHex } from "../color/convert";
import { stopList } from "../gradient/css";
import { resolvedStops } from "../state/gradient-stops";
import { selectedStopId } from "../state/signals";

export function StopBar() {
  const stops = resolvedStops.value;
  const selected = selectedStopId.value;
  return (
    <div class="stop-bar" data-testid="stop-bar" role="img" aria-label="Gradient stops">
      <div
        class="stop-bar__track"
        data-user-content=""
        // The bar always runs left to right along the stop axis, whatever the type (plan D27).
        style={
          stops.length > 0
            ? { background: `linear-gradient(90deg, ${stopList(stops)})` }
            : undefined
        }
      />
      {stops.map((stop, i) => (
        <span
          // The id repeats in a mirrored gradient.
          key={`${stop.id}-${i}`}
          class="stop-handle"
          data-selected={stop.id === selected ? "" : undefined}
          data-user-content=""
          style={{ left: `${stop.position * 100}%`, background: oklchToHex(stop.color) }}
        />
      ))}
    </div>
  );
}
