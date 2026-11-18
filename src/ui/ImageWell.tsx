/**
 * The image well (ui-contract column 1 item 1). The image is user content: it keeps its own colors
 * in both themes (spec 6.2). With no image yet it holds the drop zone (spec 6.3). Sample-point
 * markers arrive in M3.
 *
 * Zoom and pan (spec 6 "Image view"; M2 decision 15): the image sits in a transformed layer.
 * Ctrl/Cmd + wheel and trackpad pinch zoom about the pointer, while a plain wheel scrolls the page
 * (15f). Dragging pans once zoomed. The focused well takes + and − to zoom, 0 to fit and the arrow
 * keys to pan by 10% of the visible area (15d). Zoom is view state (spec 3.6).
 */
import type { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useRef } from "preact/hooks";
import { isFit, type Point, panBy, zoomAt } from "../image/viewport";
import {
  displayImage,
  imageLoading,
  imageMessage,
  imageMeta,
  imageSrc,
  imageView,
  masterThread,
} from "../state/signals";
import { DropZone } from "./DropZone";
import { UNIT_WELL, ZoomControls, zoomFit, zoomStep } from "./ZoomControls";

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

/** True for events that start on the zoom buttons, which handle themselves. */
const onControls = (event: Event): boolean =>
  event.target instanceof Element && event.target.closest(".zoom-controls") !== null;

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
  const drag = useRef<{ id: number; last: Point } | null>(null);
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
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (event: PointerEvent) => {
    const el = well.current;
    if (!el || onControls(event) || !event.isPrimary) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    drag.current = { id: event.pointerId, last: { x: event.clientX, y: event.clientY } };
    try {
      el.setPointerCapture(event.pointerId);
    } catch {
      // A pointer that is no longer active can't be captured; the drag still works without it.
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    const el = well.current;
    const current = drag.current;
    if (!el || !current || current.id !== event.pointerId) return;
    const g = geometry(el);
    const dx = (event.clientX - current.last.x) / g.width;
    const dy = (event.clientY - current.last.y) / g.height;
    current.last = { x: event.clientX, y: event.clientY };
    const before = imageView.peek();
    if (isFit(before)) return;
    imageView.value = panBy(before, dx, dy, UNIT_WELL);
  };

  const onPointerEnd = (event: PointerEvent) => {
    if (drag.current?.id === event.pointerId) drag.current = null;
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
        if (isFit(current) || onControls(event)) return;
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
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
    >
      <div class="image-well__layer" style={{ transform }}>
        {children}
      </div>
      <span id="image-view-keys" class="visually-hidden">
        Press + or − to zoom, 0 to fit, and the arrow keys to pan.
      </span>
      <ZoomControls />
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
