/**
 * The loupe (spec 3.7 "Dragging", M3-T12): a crop of the working master drawn at 8×, a crosshair on
 * the sampled pixel and the live HEX. It sits above the point on touch, so the finger doesn't hide
 * it, and beside the pointer with a mouse. M3-T15's marker drag and M3-T16's eyedropper feed it
 * the crop that `ExtractClient.sample` returns; the demo's `loupe=<n>` parameter builds one from the
 * fixture image (`cropFromImage`).
 */
import { useLayoutEffect, useRef } from "preact/hooks";
import { CROP_SIZE } from "../image/sample";
import type { ImagePoint } from "../types";

/** Magnification of the crop. */
export const LOUPE_ZOOM = 8;
/** The loupe's crop on screen: CROP_SIZE source pixels at LOUPE_ZOOM. */
export const LOUPE_SIZE = CROP_SIZE * LOUPE_ZOOM;
/** Space between the point and the loupe, and the least space to a well edge. */
const GAP = 24;
const EDGE = 4;
/** The HEX line under the crop. */
const HEX_HEIGHT = 28;

/** RGBA pixels with their size, as `ExtractClient.sample` returns them. */
export interface LoupePixels {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
}

export interface LoupeProps {
  /** The sampled color, uppercase `#RRGGBB`. */
  hex: string;
  /** The crop to draw; null shows an empty frame until the first sample arrives. */
  crop: LoupePixels | null;
  /** The point's position in the well, in px. */
  at: { x: number; y: number };
  /** The well's size, in px, to keep the loupe inside it. */
  well: { width: number; height: number };
  /** True when the pointer is a finger. */
  touch: boolean;
}

/** Where the loupe's top-left corner goes: above the point on touch, beside it with a mouse. */
export function loupePosition(
  at: { x: number; y: number },
  well: { width: number; height: number },
  touch: boolean,
): { left: number; top: number } {
  const height = LOUPE_SIZE + HEX_HEIGHT;
  let left = touch ? at.x - LOUPE_SIZE / 2 : at.x + GAP;
  let top = touch ? at.y - GAP - height : at.y - height / 2;
  if (touch && top < EDGE) top = at.y + GAP; // no room above: go below
  if (!touch && left + LOUPE_SIZE > well.width - EDGE) left = at.x - GAP - LOUPE_SIZE;
  left = Math.max(EDGE, Math.min(left, well.width - LOUPE_SIZE - EDGE));
  top = Math.max(EDGE, Math.min(top, well.height - height - EDGE));
  return { left, top };
}

export function Loupe({ hex, crop, at, well, touch }: LoupeProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx || !crop) return;
    el.width = crop.width;
    el.height = crop.height;
    ctx.putImageData(new ImageData(crop.data, crop.width, crop.height), 0, 0);
  }, [crop]);
  const { left, top } = loupePosition(at, well, touch);
  return (
    <div
      class="loupe"
      data-testid="loupe"
      data-touch={touch || undefined}
      style={{ left: `${left}px`, top: `${top}px` }}
      role="img"
      aria-label={`Loupe, ${hex}`}
    >
      <div class="loupe__frame">
        <canvas
          ref={canvas}
          class="loupe__canvas"
          width={CROP_SIZE}
          height={CROP_SIZE}
          data-user-content=""
        />
        <span class="loupe__cross loupe__cross--h" />
        <span class="loupe__cross loupe__cross--v" />
      </div>
      <span class="loupe__hex">{hex}</span>
    </div>
  );
}

/**
 * Reads the crop around a normalized point from an image URL, for the demo's `loupe=<n>`. The real
 * loupe reads the working master through the extraction client (spec 3.7). Null when the image
 * can't be read.
 */
export async function cropFromImage(src: string, point: ImagePoint): Promise<LoupePixels | null> {
  try {
    const image = new Image();
    image.src = src;
    await image.decode();
    const half = (CROP_SIZE - 1) / 2;
    const cx = Math.min(image.naturalWidth - 1, Math.floor(point.x * image.naturalWidth));
    const cy = Math.min(image.naturalHeight - 1, Math.floor(point.y * image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = CROP_SIZE;
    canvas.height = CROP_SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, cx - half, cy - half, CROP_SIZE, CROP_SIZE, 0, 0, CROP_SIZE, CROP_SIZE);
    const { data } = ctx.getImageData(0, 0, CROP_SIZE, CROP_SIZE);
    return { width: CROP_SIZE, height: CROP_SIZE, data: new Uint8ClampedArray(data) };
  } catch {
    return null;
  }
}
