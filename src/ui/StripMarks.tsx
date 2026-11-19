/**
 * Marks under the swatch strip (M3-T2 slot), shown wherever the strip is: the desktop Palette
 * column and the phone Source tab (inside the sticky strip dock, so they pin with it).
 * - M3-T8: `<ClosePairsMark/>`, the close-pair warning, in the Image view only (spec 3.5).
 * - M3-T14: `<ValueBracket/>`, a warn-colored bracket under each pair flagged Close in value, with
 *   "Close in value" beside it, in the Values view (spec 3.8; ui-contract Values view item 6). The
 *   bracket is placed from the swatches' measured boxes, so it follows any strip layout. It is
 *   drawn under a pair in the strip's last row; the pair is always listed in the Values rows too.
 */
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { closeInValue } from "../palette/values";
import { outputPalette, viewSettings } from "../state/signals";
import { ClosePairsMark } from "./ClosePairsMark";

/** Brackets drawn at most, one lane each; the Values rows list every pair. */
const MAX_LANES = 3;

interface Placed {
  first: number;
  second: number;
  left: number;
  width: number;
  /** Where the label starts, in the marks' own coordinates. */
  labelLeft: number;
}

/** Gap between a bracket and its label, in pixels; the stylesheet's `--space-2`. */
const LABEL_GAP = 8;

const samePlacement = (a: Placed[], b: Placed[]): boolean =>
  a.length === b.length &&
  a.every((p, i) => {
    const q = b[i];
    return (
      q &&
      p.first === q.first &&
      p.second === q.second &&
      Math.abs(p.left - q.left) < 0.5 &&
      Math.abs(p.width - q.width) < 0.5 &&
      Math.abs(p.labelLeft - q.labelLeft) < 0.5
    );
  });

function ValueBracket() {
  const root = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<Placed[]>([]);
  const view = viewSettings.value;
  const swatches = outputPalette.value;
  const pairs = view.mode === "values" ? closeInValue(swatches, view.closeInValue) : [];
  const lanes = pairs.slice(0, MAX_LANES);
  const laneKey = lanes.map((p) => `${p.first}-${p.second}`).join(",");

  useLayoutEffect(() => {
    const el = root.current;
    const strip = el?.parentElement?.parentElement?.querySelector<HTMLElement>(
      "[data-testid=swatch-strip]",
    );
    if (!el || !strip || lanes.length === 0) {
      setPlaced((old) => (old.length === 0 ? old : []));
      return;
    }
    const measure = () => {
      const boxes = [...strip.querySelectorAll<HTMLElement>("[data-swatch]")].map((s) =>
        s.getBoundingClientRect(),
      );
      const last = boxes[boxes.length - 1];
      const origin = el.getBoundingClientRect();
      const next: Placed[] = [];
      for (const [lane, pair] of lanes.entries()) {
        const a = boxes[pair.first];
        const b = boxes[pair.second];
        // A pair above the strip's last row has no room under it; the Values rows list it.
        if (!a || !b || !last || Math.abs(a.bottom - last.bottom) > 1) continue;
        if (Math.abs(b.bottom - last.bottom) > 1) continue;
        const left = Math.min(a.left, b.left) - origin.left;
        const right = Math.max(a.right, b.right) - origin.left;
        const label = el.querySelector<HTMLElement>(`[data-lane="${lane}"] [data-bracket-label]`);
        const labelWidth = label?.offsetWidth ?? 0;
        const after = right + LABEL_GAP;
        const labelLeft =
          after + labelWidth <= origin.width ? after : Math.max(0, left - LABEL_GAP - labelWidth);
        next.push({ first: pair.first, second: pair.second, left, width: right - left, labelLeft });
      }
      setPlaced((old) => (samePlacement(old, next) ? old : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    observer.observe(strip);
    return () => observer.disconnect();
    // `laneKey` stands for the lanes; `swatches` for the strip's contents.
  }, [laneKey, swatches]);

  if (lanes.length === 0) return null;
  return (
    <div ref={root} class="value-bracket-lanes" data-testid="value-bracket-lanes">
      {lanes.map((pair, lane) => {
        const at = placed.find((p) => p.first === pair.first && p.second === pair.second);
        return (
          <div
            key={`${pair.first}-${pair.second}`}
            class="value-bracket"
            data-lane={lane}
            data-testid={at ? "value-bracket" : undefined}
            data-placed={at ? "" : undefined}
          >
            {at && (
              <span
                class="value-bracket__line"
                data-bracket-line=""
                style={{ left: `${at.left}px`, width: `${at.width}px` }}
              />
            )}
            <span
              class="value-bracket__label"
              data-bracket-label=""
              style={at ? { left: `${at.labelLeft}px` } : undefined}
            >
              Close in value
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function StripMarks({ closePairs = true }: { closePairs?: boolean }) {
  return (
    <div class="strip-marks" data-testid="strip-marks">
      {closePairs && <ClosePairsMark />}
      <ValueBracket />
    </div>
  );
}
