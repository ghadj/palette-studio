/**
 * The image well (ui-contract column 1 item 1). The image is user content: it keeps its own colors
 * in both themes (spec 6.2). With no image yet it holds the drop zone (spec 6.3). Sample-point
 * markers arrive in M3.
 */
import { useLayoutEffect, useRef } from "preact/hooks";
import {
  displayImage,
  imageLoading,
  imageMessage,
  imageMeta,
  imageSrc,
  masterThread,
} from "../state/signals";
import { DropZone } from "./DropZone";

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

export function ImageWell() {
  const bitmap = displayImage.value;
  const src = imageSrc.value;
  const meta = imageMeta.value;
  const label = meta ? `Source image, ${meta.name}` : "Source image";
  let content = <DropZone />;
  if (bitmap) content = <DisplayCanvas bitmap={bitmap} label={label} />;
  else if (src)
    content = (
      <img
        class="image-well__image"
        src={src}
        alt={label}
        width={meta?.width}
        height={meta?.height}
        draggable={false}
        data-user-content=""
      />
    );
  return (
    <div
      class="image-well"
      data-testid="image-well"
      data-busy={imageLoading.value || undefined}
      data-width={meta?.width}
      data-height={meta?.height}
      data-master-thread={masterThread.value ?? undefined}
    >
      {content}
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
