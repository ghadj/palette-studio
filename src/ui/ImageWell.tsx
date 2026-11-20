/**
 * The image well (ui-contract column 1 item 1). The image is user content: it keeps its own colors
 * in both themes (spec 6.2). With no image yet it holds the drop zone (spec 6.3).
 *
 * M3 slots (plan M3-T2), each its own component and file:
 * - `ViewLayer` in the transformed layer: the Palette and Values views (M3-T14).
 * - `MarkerLayer` over the well, untransformed, so markers keep their size (M3-T12, M3-T15).
 * - `EyedropperLayer` over the well (M3-T16).
 * - `ImageToolbar` (Markers, Eyedropper, zoom) is a row under the well, not in it (decision 42).
 * Pan and pinch ignore a pointerdown on a marker and every one while the eyedropper is on, and the
 * arrow keys don't pan from a marker (`pointerRouting.ts`).
 *
 * Zoom and pan (spec 6 "Image view"; M2 decision 15): the image sits in a transformed layer.
 * Ctrl/Cmd + wheel and trackpad pinch zoom about the pointer, while a plain wheel scrolls the page
 * (15f). Dragging pans once zoomed. The focused well takes + and − to zoom, 0 to fit and the arrow
 * keys to pan by 10% of the visible area (15d). Zoom is view state (spec 3.6). The cluster-map
 * overlay (spec 2.6) shares the layer, so it follows zoom and pan.
 *
 * Touch (spec 6.1 "Gestures"): two fingers pinch-zoom and one finger pans once zoomed. At Fit the
 * well's touch-action lets a one-finger swipe scroll the page (15h); above Fit it is none.
 */
import type { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { isFit, type Point, panBy, pinch, type View, zoomAt } from "../image/viewport";
import {
  displayImage,
  eyedropperMode,
  imageLoading,
  imageMessage,
  imageMeta,
  imageSrc,
  imageView,
  masterThread,
  surround,
} from "../state/signals";
import { ClusterOverlay } from "./ClusterOverlay";
import { DropZone } from "./DropZone";
import { EyedropperLayer } from "./EyedropperLayer";
import { MarkerLayer } from "./MarkerLayer";
import { takeMarkerPress } from "./markerPress";
import { keysIgnored, panIgnores, panIgnoresExceptMarkers } from "./pointerRouting";
import { ViewLayer } from "./ViewLayer";
import { UNIT_WELL, zoomFit, zoomStep } from "./ZoomControls";

function DisplayCanvas({ bitmap, label }: { bitmap: ImageBitmap; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    ctx.clearRect(0, 0, el.width, el.height);
    ctx.drawImage(bitmap, 0, 0);
  }, [bitmap]);
  return (
    <canvas
      ref={canvas}
      class="image-well__image"
      width={bitmap.width}
      height={bitmap.height}
      role="img"
      aria-label={label}
      data-user-content=""
    />
  );
}

/** Pan step for the arrow keys: 10% of the visible area (decision 15d). */
const KEY_PAN = 0.1;
/** Wheel distance, in pixels, that doubles or halves the zoom. */
const WHEEL_PER_DOUBLING = 100;

/** The well's content box on screen; `imageView` measures offsets in fractions of it. */
function geometry(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return {
    left: r.left + el.clientLeft,
    top: r.top + el.clientTop,
    width: el.clientWidth || 1,
    height: el.clientHeight || 1,
  };
}

function toUnit(el: HTMLElement, clientX: number, clientY: number): Point {
  const g = geometry(el);
  return { x: (clientX - g.left) / g.width, y: (clientY - g.top) / g.height };
}

/** A pointer gesture in progress. The view reaches `imageView` once per animation frame. */
class Gesture {
  /** Pointers down on the well, by id, in client coordinates. */
  readonly pointers = new Map<number, Point>();
  /** The pinch's two pointers, and the view and their positions (well fractions) at its start. */
  pinch: { ids: [number, number]; view: View; start: [Point, Point] } | null = null;
  private pending: View | null = null;
  private frame = 0;

  /** The newest view, including one still waiting for its frame. */
  latest(): View {
    return this.pending ?? imageView.peek();
  }

  schedule(view: View): void {
    this.pending = view;
    if (!this.frame) this.frame = requestAnimationFrame(() => this.commit());
  }

  /** Commits a waiting view now. */
  flush(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.commit();
  }

  /** Drops a waiting view, for example when the well goes away. */
  cancel(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.pending = null;
  }

  private commit(): void {
    this.frame = 0;
    if (this.pending) imageView.value = this.pending;
    this.pending = null;
  }
}

/** Safari's trackpad pinch on macOS (non-standard GestureEvent). */
interface SafariGestureEvent extends UIEvent {
  scale: number;
  clientX: number;
  clientY: number;
}

interface WellAttributes {
  "data-testid": "image-well";
  "data-busy"?: true | undefined;
  "data-width"?: number | undefined;
  "data-height"?: number | undefined;
  "data-master-thread"?: "worker" | "main" | undefined;
}

function ZoomableWell({
  attributes,
  children,
}: {
  attributes: WellAttributes;
  children: ComponentChildren;
}) {
  const well = useRef<HTMLDivElement>(null);
  const [gesture] = useState(() => ({ current: new Gesture() }));
  const view = imageView.value;
  const zoomed = !isFit(view);

  // Ctrl/Cmd + wheel (and trackpad pinch, which arrives as a wheel event with ctrlKey) zooms about
  // the pointer. A plain wheel is left alone, so the page and the desktop columns still scroll.
  useEffect(() => {
    const el = well.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? el.clientHeight
            : 1;
      const delta = Math.max(
        -WHEEL_PER_DOUBLING,
        Math.min(WHEEL_PER_DOUBLING, event.deltaY * unit),
      );
      imageView.value = zoomAt(
        imageView.peek(),
        2 ** (-delta / WHEEL_PER_DOUBLING),
        toUnit(el, event.clientX, event.clientY),
        UNIT_WELL,
      );
    };
    // Safari on macOS sends a trackpad pinch as gesture events, not as a wheel with ctrlKey. On
    // touch screens they come with pointers too, so there the pointer pinch below handles them.
    const g = gesture.current;
    let trackpad: { view: View; anchor: Point } | null = null;
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      if (g.pointers.size > 0) return;
      const { clientX, clientY } = event as SafariGestureEvent;
      const anchor = toUnit(el, clientX, clientY);
      trackpad = {
        view: imageView.peek(),
        anchor: Number.isFinite(anchor.x + anchor.y) ? anchor : { x: 0.5, y: 0.5 },
      };
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      const scale = (event as SafariGestureEvent).scale;
      if (!trackpad || g.pointers.size > 0 || !(scale > 0)) return;
      imageView.value = zoomAt(trackpad.view, scale, trackpad.anchor, UNIT_WELL);
    };
    const onGestureEnd = (event: Event) => {
      event.preventDefault();
      trackpad = null;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", onGestureStart);
    el.addEventListener("gesturechange", onGestureChange);
    el.addEventListener("gestureend", onGestureEnd);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
      el.removeEventListener("gestureend", onGestureEnd);
      g.cancel();
    };
  }, [gesture]);

  // Pointer gestures (spec 6.1 "Gestures"): one pointer pans once zoomed, two pinch-zoom. Pointers
  // are captured, the view updates once per animation frame, and pointercancel ends the gesture
  // with the last valid view.
  const onPointerDown = (event: PointerEvent) => {
    const el = well.current;
    const g = gesture.current;
    if (!el || g.pointers.size >= 2) return;
    const eyedropper = eyedropperMode.peek();
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // A second finger during a marker drag cancels the drag and pinches with the marker's finger
    // (plan D10). The well never saw that finger, since it ignores a pointerdown on a marker.
    if (g.pointers.size === 0 && !panIgnoresExceptMarkers(event.target, eyedropper)) {
      const held = takeMarkerPress(event.pointerId);
      if (held) {
        g.pointers.set(held.pointerId, { x: held.x, y: held.y });
        try {
          el.setPointerCapture(held.pointerId);
        } catch {
          // The pinch still works without capture.
        }
      }
    }
    if (g.pointers.size === 0 && panIgnores(event.target, eyedropper)) return;
    g.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try {
      el.setPointerCapture(event.pointerId);
    } catch {
      // A pointer that is no longer active can't be captured; the gesture still works without it.
    }
    if (g.pointers.size === 2) {
      const [a, b] = [...g.pointers.entries()] as [[number, Point], [number, Point]];
      g.pinch = {
        ids: [a[0], b[0]],
        view: g.latest(),
        start: [toUnit(el, a[1].x, a[1].y), toUnit(el, b[1].x, b[1].y)],
      };
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    const el = well.current;
    const g = gesture.current;
    const last = g.pointers.get(event.pointerId);
    if (!el || !last) return;
    g.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (g.pinch) {
      const [a, b] = g.pinch.ids.map((id) => g.pointers.get(id)) as [Point, Point];
      g.schedule(
        pinch(g.pinch.view, g.pinch.start, [toUnit(el, a.x, a.y), toUnit(el, b.x, b.y)], UNIT_WELL),
      );
      return;
    }
    const current = g.latest();
    if (isFit(current)) return;
    const box = geometry(el);
    g.schedule(
      panBy(
        current,
        (event.clientX - last.x) / box.width,
        (event.clientY - last.y) / box.height,
        UNIT_WELL,
      ),
    );
  };

  const onPointerUp = (event: PointerEvent) => {
    const g = gesture.current;
    if (!g.pointers.delete(event.pointerId)) return;
    // Lifting one finger of a pinch carries on as a one-finger pan from where the other one is.
    if (g.pinch?.ids.includes(event.pointerId)) g.pinch = null;
    if (g.pointers.size === 0) g.flush();
  };

  const onPointerCancel = () => {
    const g = gesture.current;
    g.pointers.clear();
    g.pinch = null;
    g.flush();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const current = imageView.peek();
    switch (event.key) {
      case "+":
      case "=":
        zoomStep(1);
        break;
      case "-":
      case "_":
        zoomStep(-1);
        break;
      case "0":
        zoomFit();
        break;
      case "ArrowLeft":
      case "ArrowRight":
      case "ArrowUp":
      case "ArrowDown": {
        // At Fit there is nothing to pan, so the arrows keep scrolling the page.
        if (isFit(current) || keysIgnored(event.target)) return;
        const dx = event.key === "ArrowLeft" ? KEY_PAN : event.key === "ArrowRight" ? -KEY_PAN : 0;
        const dy = event.key === "ArrowUp" ? KEY_PAN : event.key === "ArrowDown" ? -KEY_PAN : 0;
        imageView.value = panBy(current, dx, dy, UNIT_WELL);
        break;
      }
      default:
        return;
    }
    event.preventDefault();
  };

  const transform = zoomed
    ? `translate(${view.x * 100}%, ${view.y * 100}%) scale(${view.scale})`
    : "";

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset can't hold the transformed image layer
    <div
      {...attributes}
      ref={well}
      class="image-well image-well--image"
      data-surround={surround.value}
      role="group"
      aria-label="Image view"
      aria-describedby="image-view-keys"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the image view is keyboard-operable (decision 15d)
      tabIndex={0}
      data-zoomed={zoomed || undefined}
      data-scale={view.scale}
      data-x={view.x}
      data-y={view.y}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onPointerUp}
    >
      <div class="image-well__layer" style={{ transform }}>
        {children}
        <ViewLayer />
        <ClusterOverlay />
      </div>
      <MarkerLayer />
      <EyedropperLayer />
      <span id="image-view-keys" class="visually-hidden">
        Press + or − to zoom, 0 to fit, and the arrow keys to pan.
      </span>
    </div>
  );
}

export function ImageWell() {
  const bitmap = displayImage.value;
  const src = imageSrc.value;
  const meta = imageMeta.value;
  const label = meta ? `Source image, ${meta.name}` : "Source image";
  const attributes: WellAttributes = {
    "data-testid": "image-well",
    "data-busy": imageLoading.value || undefined,
    "data-width": meta?.width,
    "data-height": meta?.height,
    "data-master-thread": masterThread.value ?? undefined,
  };
  if (bitmap)
    return (
      <ZoomableWell attributes={attributes}>
        <DisplayCanvas bitmap={bitmap} label={label} />
      </ZoomableWell>
    );
  if (src)
    return (
      <ZoomableWell attributes={attributes}>
        <img
          class="image-well__image"
          src={src}
          alt={label}
          width={meta?.width}
          height={meta?.height}
          draggable={false}
          data-user-content=""
        />
      </ZoomableWell>
    );
  return (
    <div class="image-well" {...attributes}>
      <DropZone />
    </div>
  );
}

/** The inline message under the image (spec 6.3), heard through a live region. */
export function ImageMessageBanner() {
  const message = imageMessage.value;
  return (
    <div class="message-region" role="status" aria-live="polite" data-testid="image-message">
      {message && (
        <p
          class={`message message--${message.kind}`}
          role={message.kind === "error" ? "alert" : undefined}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
