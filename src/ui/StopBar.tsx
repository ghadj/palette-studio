/**
 * The stop bar (ui-contract column 3 item 3; Components "Stop handle"; spec 4.3 "Stops"): a thin
 * rounded bar showing the gradient, with a round handle for each stop. A click on the bar adds a
 * stop; a handle drags (pointer capture, one update per frame, Esc and `pointercancel` restore the
 * start, one undo step) and takes the arrow keys. Diamonds on the segments next to the selected
 * stop set the midpoint. It reads the stops through `resolvedStops` and changes them only through
 * `editStops`, so a hand edit switches the technique to Custom (plan Q1a).
 *
 * The bar shows reverse and mirror (plan D21); positions are mapped back to the stored stops.
 * A mirrored bar has no diamonds, because its segments are copies.
 */
import { useEffect, useRef, useState } from "preact/hooks";
import { oklchToHex } from "../color/convert";
import { addStop, MAX_STOPS, MIN_STOPS, newStopId, removeStop, setHint } from "../gradient/model";
import {
  dragStop,
  hintFromPointer,
  positionFromPointer,
  toStoredPosition,
} from "../gradient/stop-drag";
import { editStops, selectStop } from "../state/gradient";
import { colorAt, render } from "../state/gradient-render";
import { effectiveStops, resolvedStops } from "../state/gradient-stops";
import { begin, end } from "../state/history";
import { gradient, outputPalette, selectedStopId } from "../state/signals";
import type { Gradient } from "../types";

type PEvent = PointerEvent & { currentTarget: HTMLElement };
type MEvent = MouseEvent & { currentTarget: HTMLElement };
type KEvent = KeyboardEvent & { currentTarget: HTMLElement };

const MOVE_LABEL = "Move stop";
const MIDPOINT_LABEL = "Move midpoint";
const pct = (p: number): number => Math.round(p * 1000) / 10;

interface Drag {
  pointerId: number;
  kind: "stop" | "hint";
  id: string;
  /** Pointer x minus the handle's center at pointerdown. */
  grab: number;
  startStops: ReturnType<typeof effectiveStops.peek>;
  startGradient: Gradient;
  x: number;
  frame: number;
  /** The Esc listener, kept so a later render removes the very same function. */
  esc: (e: KeyboardEvent) => void;
  /** For a midpoint: the displayed segment's ends, and which stored stop owns the hint. */
  segment?: undefined | { a: number; b: number; owner: string; flip: boolean };
}

export function StopBar() {
  const stops = resolvedStops.value;
  const stored = effectiveStops.value;
  const selected = selectedStopId.value;
  const g = gradient.value;
  const swatches = outputPalette.value;
  // The real interpolation, as the preview draws it, laid left to right (plan D27, M4-T10).
  const { barCss } = render.value;
  const bar = useRef<HTMLFieldSetElement>(null);
  const drag = useRef<Drag | null>(null);
  const justDragged = useRef(false);
  const [note, setNote] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);

  const geometry = { reverse: g.geometry.reverse, mirror: g.geometry.mirror };

  const displayAt = (clientX: number): number => {
    const rect = bar.current?.getBoundingClientRect();
    return rect ? positionFromPointer(clientX, rect) : 0;
  };

  const apply = (d: Drag): void => {
    const p = displayAt(d.x - d.grab);
    if (d.kind === "stop") {
      editStops(() => dragStop(d.startStops, d.id, toStoredPosition(p, geometry)), MOVE_LABEL);
    } else if (d.segment) {
      const { a, b, owner, flip } = d.segment;
      const h = hintFromPointer(p, a, b);
      editStops((s) => setHint(s, owner, flip ? 1 - h : h), MIDPOINT_LABEL);
    }
  };

  const finish = (cancel: boolean): void => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    window.removeEventListener("keydown", d.esc, true);
    if (d.frame) cancelAnimationFrame(d.frame);
    if (cancel) {
      gradient.value = d.startGradient;
    } else {
      apply(d);
    }
    end(d.kind === "stop" ? MOVE_LABEL : MIDPOINT_LABEL);
    setDragging(null);
    justDragged.current = true;
    setTimeout(() => {
      justDragged.current = false;
    }, 0);
  };

  useEffect(
    () => () => {
      const d = drag.current;
      if (d) window.removeEventListener("keydown", d.esc, true);
    },
    [],
  );

  const startDrag = (
    e: PEvent,
    kind: Drag["kind"],
    id: string,
    segment?: Drag["segment"],
  ): void => {
    if (drag.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.stopPropagation();
    const box = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    begin();
    const esc = (ev: KeyboardEvent): void => {
      if (ev.key !== "Escape" || !drag.current) return;
      ev.preventDefault();
      ev.stopPropagation();
      finish(true);
    };
    drag.current = {
      esc,
      pointerId: e.pointerId,
      kind,
      id,
      grab: e.clientX - (box.left + box.width / 2),
      startStops: effectiveStops.peek(),
      startGradient: gradient.peek(),
      x: e.clientX,
      frame: 0,
      segment,
    };
    window.addEventListener("keydown", esc, true);
    setDragging(id);
  };

  const moveDrag = (e: PEvent): void => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    d.x = e.clientX;
    if (!d.frame) {
      d.frame = requestAnimationFrame(() => {
        d.frame = 0;
        if (drag.current === d) apply(d);
      });
    }
  };

  const upDrag = (e: PEvent): void => {
    if (drag.current && e.pointerId === drag.current.pointerId) finish(false);
  };
  const cancelDrag = (e: PEvent): void => {
    if (drag.current && e.pointerId === drag.current.pointerId) finish(true);
  };

  const focusStop = (id: string): void => {
    requestAnimationFrame(() => {
      bar.current?.querySelector<HTMLElement>(`[data-stop-id="${id}"]`)?.focus();
    });
  };

  const addAt = (displayed: number): void => {
    if (stored.length >= MAX_STOPS) {
      setNote(`A gradient can have at most ${MAX_STOPS} stops.`);
      return;
    }
    const id = newStopId();
    const color = colorAt(displayed);
    editStops((s) => addStop(s, toStoredPosition(displayed, geometry), color, { id }), "Add stop");
    selectStop(id);
    setNote("");
  };

  const onBarClick = (e: MEvent): void => {
    if (justDragged.current) return;
    if ((e.target as Element).closest(".stop-handle, .stop-diamond")) return;
    addAt(displayAt(e.clientX));
  };

  const onKey = (e: KEvent, index: number): void => {
    const stop = stops[index];
    if (!stop) return;
    const move = (to: number): void => {
      e.preventDefault();
      if (stored.find((s) => s.id === stop.id)?.locked) {
        setNote("A locked stop can't be moved.");
        return;
      }
      const p = Math.min(1, Math.max(0, to));
      editStops((s) => dragStop(s, stop.id, toStoredPosition(p, geometry)), MOVE_LABEL);
      setNote("");
    };
    const step = e.shiftKey ? 0.1 : 0.01;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        move(stop.position + step);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        move(stop.position - step);
        break;
      case "Home":
        move(0);
        break;
      case "End":
        move(1);
        break;
      case "Delete":
      case "Backspace": {
        e.preventDefault();
        if (stored.length <= MIN_STOPS) {
          setNote("A gradient needs at least 2 stops.");
          break;
        }
        if (stored.find((s) => s.id === stop.id)?.locked) {
          setNote("A locked stop can't be removed.");
          break;
        }
        const neighbor = stops[index + 1] ?? stops[index - 1];
        editStops((s) => removeStop(s, stop.id), "Remove stop");
        if (neighbor) {
          selectStop(neighbor.id);
          focusStop(neighbor.id);
        }
        setNote("");
        break;
      }
      case "+":
      case "Insert": {
        e.preventDefault();
        const next = stops[index + 1];
        const other = next ?? stops[index - 1];
        if (!other) break;
        addAt((stop.position + other.position) / 2);
        break;
      }
    }
  };

  const nameOf = (id: string, index: number): string => {
    const stop = stored.find((s) => s.id === id);
    let link = "Fixed color";
    if (stop?.color.kind === "swatch") {
      const n = swatches.findIndex((s) => s.id === (stop.color as { id: string }).id) + 1;
      link = `Swatch ${n}${stop.color.derive ? ", derived" : ""}`;
    }
    return `Stop ${index + 1}, ${link}, ${pct(stops[index]?.position ?? 0)}%`;
  };

  const seen = new Map<string, number>();
  const selectedIndex = stops.findIndex((s) => s.id === selected);
  const diamonds: Array<{ a: number; b: number }> = [];
  if (!geometry.mirror && selectedIndex >= 0) {
    if (selectedIndex > 0) diamonds.push({ a: selectedIndex - 1, b: selectedIndex });
    if (selectedIndex < stops.length - 1) diamonds.push({ a: selectedIndex, b: selectedIndex + 1 });
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the keyboard adds a stop with + or Insert on a handle
    <fieldset
      class="stop-bar"
      data-testid="stop-bar"
      aria-label="Gradient stops"
      ref={bar}
      onClick={onBarClick}
    >
      <div
        class="stop-bar__track"
        data-user-content=""
        // The bar always runs left to right along the stop axis, whatever the type (plan D27).
        style={barCss ? { background: barCss } : undefined}
      />
      {diamonds.map(({ a, b }) => {
        const sa = stops[a];
        const sb = stops[b];
        if (!sa || !sb) return null;
        const owner = geometry.reverse ? sb.id : sa.id;
        return (
          <span
            key={`hint-${sa.id}-${sb.id}`}
            class="stop-diamond"
            role="slider"
            tabIndex={0}
            aria-label={`Midpoint between stop ${a + 1} and stop ${b + 1}`}
            aria-valuemin={1}
            aria-valuemax={99}
            aria-valuenow={Math.round(sa.hint * 100)}
            aria-valuetext={`${Math.round(sa.hint * 100)}%`}
            data-testid="stop-midpoint"
            data-dragging={dragging === `hint-${owner}` ? "" : undefined}
            style={{ left: `${(sa.position + sa.hint * (sb.position - sa.position)) * 100}%` }}
            onPointerDown={(e) =>
              startDrag(e, "hint", owner, {
                a: sa.position,
                b: sb.position,
                owner,
                flip: geometry.reverse,
              })
            }
            onPointerMove={moveDrag}
            onPointerUp={upDrag}
            onPointerCancel={cancelDrag}
            onKeyDown={(e) => {
              const dir =
                e.key === "ArrowRight" || e.key === "ArrowUp"
                  ? 1
                  : e.key === "ArrowLeft" || e.key === "ArrowDown"
                    ? -1
                    : 0;
              if (!dir) return;
              e.preventDefault();
              const h = Math.min(0.99, Math.max(0.01, sa.hint + dir * (e.shiftKey ? 0.1 : 0.01)));
              editStops((s) => setHint(s, owner, geometry.reverse ? 1 - h : h), MIDPOINT_LABEL);
            }}
          >
            <span class="stop-diamond__mark" />
          </span>
        );
      })}
      {stops.map((stop, i) => {
        const occurrence = seen.get(stop.id) ?? 0;
        seen.set(stop.id, occurrence + 1);
        const storedStop = stored.find((s) => s.id === stop.id);
        return (
          <span
            // The id repeats in a mirrored gradient.
            key={`${stop.id}-${occurrence}`}
            class="stop-handle"
            role="slider"
            tabIndex={0}
            data-stop-id={stop.id}
            data-testid="stop-handle"
            aria-label={nameOf(stop.id, i)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct(stop.position)}
            aria-valuetext={`${pct(stop.position)}%`}
            data-selected={stop.id === selected ? "" : undefined}
            data-dragging={dragging === stop.id ? "" : undefined}
            data-locked={storedStop?.locked ? "" : undefined}
            data-user-content=""
            style={{ left: `${stop.position * 100}%`, background: oklchToHex(stop.color) }}
            onFocus={() => selectStop(stop.id)}
            onPointerDown={(e) => {
              selectStop(stop.id);
              if (!storedStop?.locked) startDrag(e, "stop", stop.id);
              else e.stopPropagation();
            }}
            onPointerMove={moveDrag}
            onPointerUp={upDrag}
            onPointerCancel={cancelDrag}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => onKey(e, i)}
          />
        );
      })}
      <p class="visually-hidden" role="status" aria-live="polite" data-testid="stop-bar-note">
        {note}
      </p>
    </fieldset>
  );
}
