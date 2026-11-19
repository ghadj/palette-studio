/**
 * Sample-point markers (spec 3.7, ui-contract "Marker"; M3-T2 slot, M3-T12). The layer sits in the
 * image well outside the transformed layer, over the whole well, so markers keep their on-screen
 * size at any zoom: it maps each normalized point through `imageView` (well fractions: `view.x +
 * point.x × view.scale`, and the same for y). M3-T15 adds dragging.
 *
 * Each swatch with a point gets a ring in its base color (the color found in the image; the palette
 * swatch shows the adjusted result, spec 3.7), a light outer and a dark inner stroke, and its
 * number beside it. The selected marker has an accent ring and sits on top (z-index, so the tab order stays by swatch). Rings closer than the
 * 44 px hit area fan their labels out around the group (plan D9). Pointer enter and keyboard focus
 * set `hoveredSwatchId`, and a marker whose swatch is that one carries `data-linked`; a tap or
 * click selects the swatch. Markers show only in the Image view, and only while
 * `markersVisible` is on.
 *
 * Dragging (M3-T15, spec 3.7, 6.1): a pointer on a marker, with pointer capture, drags it once it
 * has moved a few pixels; `MarkerDrag` (src/state/marker-drag.ts) does the sampling and history.
 * Esc and `pointercancel` restore, and a second finger cancels and joins the pinch (`markerPress`
 * and the well's `Gesture`). The arrow keys nudge a focused marker by 1 master pixel, 10 with
 * Shift, one undo step each; a live region announces the new HEX.
 *
 * Every marker's hit area carries `data-marker`: the well's pan and pinch ignore a pointerdown on
 * one, and its arrow keys don't pan (see `pointerRouting.ts`).
 */
import { signal } from "@preact/signals";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { imageClient } from "../extract/client";
import { masterSize } from "../image/tiers";
import { swatchHex } from "../palette/model";
import * as history from "../state/history";
import {
  MarkerDrag,
  MOVE_LABEL,
  nudgePoint,
  pointerToPoint,
  withPoint,
  withSample,
} from "../state/marker-drag";
import {
  eyedropperMode,
  hoveredSwatchId,
  imageMeta,
  imageSrc,
  imageView,
  initialLoupe,
  markersVisible,
  palette,
  selectedSwatchId,
  selectSwatch,
  viewSettings,
} from "../state/signals";
import type { ImagePoint, Swatch } from "../types";
import { cropFromImage, Loupe, type LoupePixels } from "./Loupe";
import { markerPress } from "./markerPress";

/** Rings closer than this on screen (the hit area, `--touch-target`) fan their labels out. */
const CLOSE = 44;
/** Distance from a ring's center to its label's center, in px. */
const LABEL_RADIUS = 22;

interface Placed {
  swatch: Swatch;
  /** 1-based swatch number. */
  n: number;
  point: ImagePoint;
  /** Position in the well, in px. */
  x: number;
  y: number;
  /** Label direction, in radians (0 is right). */
  angle: number;
}

/** Groups rings within CLOSE px of each other and gives each ring of a group its own direction. */
export function fanOut(rings: ReadonlyArray<{ x: number; y: number }>): number[] {
  const angles = rings.map(() => 0);
  const seen = new Set<number>();
  rings.forEach((_, start) => {
    if (seen.has(start)) return;
    const group: number[] = [];
    const queue = [start];
    seen.add(start);
    while (queue.length > 0) {
      const i = queue.pop() as number;
      group.push(i);
      rings.forEach((other, j) => {
        const ring = rings[i];
        if (seen.has(j) || !ring) return;
        if (Math.hypot(ring.x - other.x, ring.y - other.y) < CLOSE) {
          seen.add(j);
          queue.push(j);
        }
      });
    }
    group.sort((a, b) => a - b);
    group.forEach((index, rank) => {
      angles[index] = group.length > 1 ? (rank * 2 * Math.PI) / group.length : 0;
    });
  });
  return angles;
}

/** A press must move this far, in px, before it is a drag; a tap or click only selects. */
const DRAG_SLOP = 4;

/** The loupe while a marker is dragged, and what the live region says. */
const dragLoupe = signal<{ id: string; crop: LoupePixels | null; touch: boolean } | null>(null);
const announcement = signal("");

const announce = (id: string): void => {
  const list = palette.peek();
  const swatch = list.find((s) => s.id === id);
  if (swatch) {
    announcement.value = `Swatch ${list.indexOf(swatch) + 1} marker moved, ${swatchHex(swatch)}`;
  }
};

const drag = new MarkerDrag<LoupePixels>({
  frame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (handle) => cancelAnimationFrame(handle),
  // The worker reads the patch from its master; the UI thread never loops over pixels (spec 7.4).
  sample: (point, radius, stat) => imageClient().sample(point, radius, stat),
  getPalette: () => palette.peek(),
  setPalette: (next) => {
    palette.value = next;
  },
  begin: history.begin,
  end: history.end,
  onSample: ({ id, crop }) => {
    const current = dragLoupe.peek();
    if (current?.id === id) dragLoupe.value = { ...current, crop };
  },
  onEnd: () => {
    dragLoupe.value = null;
  },
});

interface Press {
  pointerId: number;
  id: string;
  startX: number;
  startY: number;
  /** Where the pointer sat from the marker's center at pointerdown. */
  grab: { x: number; y: number };
  touch: boolean;
  dragging: boolean;
}

/** The marker press in progress, if any. */
let press: Press | null = null;

const onEscape = (event: KeyboardEvent): void => {
  if (event.key !== "Escape" || !press) return;
  event.preventDefault();
  event.stopPropagation();
  cancelPress();
};

function endPress(): void {
  press = null;
  markerPress.set(null);
  window.removeEventListener("keydown", onEscape, true);
}

/** Esc, pointercancel or a second finger: the swatch goes back to how it was. */
function cancelPress(): void {
  drag.cancel();
  endPress();
}

type MarkerPointerEvent = PointerEvent & { currentTarget: HTMLButtonElement };

function beginPress(event: MarkerPointerEvent, id: string): void {
  if (drag.active || press || eyedropperMode.peek() !== "off") return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  const box = event.currentTarget.getBoundingClientRect();
  press = {
    pointerId: event.pointerId,
    id,
    startX: event.clientX,
    startY: event.clientY,
    grab: {
      x: event.clientX - (box.left + box.width / 2),
      y: event.clientY - (box.top + box.height / 2),
    },
    touch: event.pointerType !== "mouse",
    dragging: false,
  };
  markerPress.set({
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    cancel: cancelPress,
  });
  window.addEventListener("keydown", onEscape, true);
  try {
    event.currentTarget.setPointerCapture(event.pointerId);
  } catch {
    // Without capture the drag still follows the pointer while it stays over the marker.
  }
}

function movePress(event: MarkerPointerEvent): void {
  if (!press || press.pointerId !== event.pointerId) return;
  const held = markerPress.current;
  if (held) {
    held.x = event.clientX;
    held.y = event.clientY;
  }
  if (!press.dragging) {
    if (Math.hypot(event.clientX - press.startX, event.clientY - press.startY) < DRAG_SLOP) return;
    if (!drag.start(press.id)) {
      endPress();
      return;
    }
    press.dragging = true;
    selectSwatch(press.id);
    dragLoupe.value = { id: press.id, crop: null, touch: press.touch };
  }
  const layer = event.currentTarget.closest(".marker-layer");
  if (!layer) return;
  const box = layer.getBoundingClientRect();
  drag.move(
    pointerToPoint(
      { x: event.clientX, y: event.clientY },
      press.grab,
      { left: box.left, top: box.top, width: layer.clientWidth, height: layer.clientHeight },
      imageView.peek(),
    ),
  );
}

function releasePress(event: MarkerPointerEvent): void {
  if (!press || press.pointerId !== event.pointerId) return;
  const { id, dragging } = press;
  endPress();
  if (dragging) void drag.release().then(() => announce(id));
}

/** The working master's size, which the arrow keys count their pixels in (plan D9). */
function masterDims(): { width: number; height: number } | null {
  let width = imageMeta.peek()?.width;
  let height = imageMeta.peek()?.height;
  if (!width || !height) {
    const img = document.querySelector<HTMLImageElement>("img.image-well__image");
    width = img?.naturalWidth;
    height = img?.naturalHeight;
  }
  return width && height ? masterSize(width, height) : null;
}

/** Nudges run one after another, so each is its own undo step with its own sample. */
let nudges: Promise<void> = Promise.resolve();

async function nudgeOnce(id: string, dx: number, dy: number): Promise<void> {
  const list = palette.peek();
  const swatch = list.find((s) => s.id === id);
  const master = masterDims();
  if (!swatch?.point || !master || drag.active) return;
  const point = nudgePoint(swatch.point, dx, dy, master);
  if (point.x === swatch.point.x && point.y === swatch.point.y) return;
  history.begin();
  palette.value = withPoint(list, id, point);
  try {
    const result = await imageClient().sample(point, swatch.sampleRadius, swatch.sampleStat);
    palette.value = withSample(palette.peek(), id, result.color);
    history.end(MOVE_LABEL);
    announce(id);
  } catch {
    palette.value = list;
    history.end();
  }
}

function nudge(id: string, dx: number, dy: number): void {
  nudges = nudges.then(() => nudgeOnce(id, dx, dy)).catch(() => undefined);
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

function onMarkerKey(event: KeyboardEvent, id: string): void {
  const arrow = ARROWS[event.key];
  if (!arrow || event.ctrlKey || event.metaKey || event.altKey) return;
  event.preventDefault();
  const step = event.shiftKey ? 10 : 1;
  nudge(id, arrow[0] * step, arrow[1] * step);
}

const keyboardFocus = (el: Element): boolean => {
  try {
    return el.matches(":focus-visible");
  } catch {
    return false;
  }
};

export function MarkerLayer() {
  const layer = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [crop, setCrop] = useState<LoupePixels | null>(null);
  const swatches = palette.value;
  const view = imageView.value;
  const selected = selectedSwatchId.value;
  const linked = hoveredSwatchId.value;
  const shown = markersVisible.value && viewSettings.value.mode === "image";
  const loupeIndex = initialLoupe.value;
  const dragging = dragLoupe.value;

  useLayoutEffect(() => {
    const el = layer.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const loupeSwatch = loupeIndex === null ? undefined : swatches[loupeIndex];
  const loupePoint = loupeSwatch?.point ?? null;
  const src = imageSrc.value;
  useEffect(() => {
    if (!loupePoint || !src) return;
    let current = true;
    void cropFromImage(src, loupePoint).then((pixels) => current && setCrop(pixels));
    return () => {
      current = false;
    };
  }, [loupePoint, src]);

  const placed: Placed[] = [];
  swatches.forEach((swatch, i) => {
    if (!swatch.point) return;
    placed.push({
      swatch,
      n: i + 1,
      point: swatch.point,
      x: (view.x + swatch.point.x * view.scale) * size.width,
      y: (view.y + swatch.point.y * view.scale) * size.height,
      angle: 0,
    });
  });
  const angles = fanOut(placed);
  placed.forEach((p, i) => {
    p.angle = angles[i] ?? 0;
  });
  return (
    <div ref={layer} class="marker-layer">
      {shown &&
        size.width > 0 &&
        placed.map((p) => {
          const hex = swatchHex(p.swatch);
          const isSelected = p.swatch.id === selected;
          return (
            <button
              key={p.swatch.id}
              type="button"
              class="marker"
              data-marker={p.n}
              data-swatch-id={p.swatch.id}
              data-linked={p.swatch.id === linked ? "" : undefined}
              data-dragging={dragging?.id === p.swatch.id ? "" : undefined}
              aria-pressed={isSelected}
              aria-label={`Swatch ${p.n} marker, ${Math.round(p.point.x * 100)}%, ${Math.round(p.point.y * 100)}%`}
              style={{
                left: `${(view.x + p.point.x * view.scale) * 100}%`,
                top: `${(view.y + p.point.y * view.scale) * 100}%`,
              }}
              onClick={() => selectSwatch(p.swatch.id)}
              onPointerDown={(e) => beginPress(e, p.swatch.id)}
              onPointerMove={movePress}
              onPointerUp={releasePress}
              onPointerCancel={(e) => {
                if (press?.pointerId === e.pointerId) cancelPress();
              }}
              onKeyDown={(e) => onMarkerKey(e, p.swatch.id)}
              onPointerEnter={(e) => {
                if (e.pointerType !== "touch") hoveredSwatchId.value = p.swatch.id;
              }}
              onPointerLeave={() => {
                if (hoveredSwatchId.peek() === p.swatch.id) hoveredSwatchId.value = null;
              }}
              onFocus={(e) => {
                if (keyboardFocus(e.currentTarget)) hoveredSwatchId.value = p.swatch.id;
              }}
              onBlur={() => {
                if (hoveredSwatchId.peek() === p.swatch.id) hoveredSwatchId.value = null;
              }}
            >
              <span class="marker__ring" data-user-content="" style={{ backgroundColor: hex }}>
                {isSelected && <span class="marker__accent" data-marker-accent="" />}
              </span>
              <span
                class="marker__label"
                aria-hidden="true"
                style={{
                  transform: `translate(calc(-50% + ${Math.cos(p.angle) * LABEL_RADIUS}px), calc(-50% + ${Math.sin(p.angle) * LABEL_RADIUS}px))`,
                }}
              >
                {p.n}
              </span>
            </button>
          );
        })}
      <div class="visually-hidden" role="status" aria-live="polite" data-testid="marker-status">
        {announcement.value}
      </div>
      {shown &&
        size.width > 0 &&
        dragging &&
        (() => {
          const swatch = swatches.find((sw) => sw.id === dragging.id);
          if (!swatch?.point) return null;
          return (
            <Loupe
              hex={swatchHex(swatch)}
              crop={dragging.crop}
              at={{
                x: (view.x + swatch.point.x * view.scale) * size.width,
                y: (view.y + swatch.point.y * view.scale) * size.height,
              }}
              well={size}
              touch={dragging.touch}
            />
          );
        })()}
      {shown && size.width > 0 && loupeSwatch && loupePoint && (
        <Loupe
          hex={swatchHex(loupeSwatch)}
          crop={crop}
          at={{
            x: (view.x + loupePoint.x * view.scale) * size.width,
            y: (view.y + loupePoint.y * view.scale) * size.height,
          }}
          well={size}
          touch={false}
        />
      )}
    </div>
  );
}
