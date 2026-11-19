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
 * Every marker's hit area carries `data-marker`: the well's pan and pinch ignore a pointerdown on
 * one, and its arrow keys don't pan (see `pointerRouting.ts`).
 */
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { swatchHex } from "../palette/model";
import {
  hoveredSwatchId,
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
              aria-pressed={isSelected}
              aria-label={`Swatch ${p.n} marker, ${Math.round(p.point.x * 100)}%, ${Math.round(p.point.y * 100)}%`}
              style={{
                left: `${(view.x + p.point.x * view.scale) * 100}%`,
                top: `${(view.y + p.point.y * view.scale) * 100}%`,
              }}
              onClick={() => selectSwatch(p.swatch.id)}
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
