/**
 * The Image sample thumbnail (ui-contract "Not drawn"; spec 4.2, 3.7; plan M4-T11, D18): the image
 * with the sample line or scan drawn on it, and a dot at each sample point. In Line mode the two
 * endpoints are handles (44 px, pointer capture, arrow keys 1%, Shift+arrow 10%); a drag is one undo
 * step, taken once the scan it started has landed. It is user content (the image is never themed).
 */
import { useEffect, useRef } from "preact/hooks";
import { markerOrder, scanPoints } from "../gradient/image-sample";
import { begin, end } from "../state/history";
import { changeTechnique, endWhenIdle, sampling } from "../state/image-sample";
import { displayImage, gradient, imageMeta, imageSrc, outputPalette } from "../state/signals";
import type { ImagePoint } from "../types";

const LABEL = "Sample line";
const STEP = 0.01;
const BIG_STEP = 0.1;
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
const pct = (n: number): number => Math.round(n * 100);

type Line = { a: ImagePoint; b: ImagePoint };
type End = "a" | "b";
type PEvent = PointerEvent & { currentTarget: HTMLElement };

function setLine(line: Line): void {
  const t = gradient.peek().technique;
  const { a, b } = t.sample.line;
  if (a.x === line.a.x && a.y === line.a.y && b.x === line.b.x && b.y === line.b.y) return;
  changeTechnique({ ...t, sample: { ...t.sample, line } }, LABEL);
}

/** The image drawn small, from the display copy (a canvas) or, in the demo, its file (an img). */
function Picture({ aspect }: { aspect: number }) {
  const bitmap = displayImage.value;
  const src = imageSrc.value;
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el || !bitmap) return;
    const w = 320;
    el.width = w;
    el.height = Math.max(1, Math.round(w * aspect));
    el.getContext("2d")?.drawImage(bitmap, 0, 0, el.width, el.height);
  }, [bitmap, aspect]);
  if (bitmap) return <canvas ref={canvas} class="sample-thumb__image" data-user-content="" />;
  if (src)
    return (
      <img class="sample-thumb__image" src={src} alt="" draggable={false} data-user-content="" />
    );
  return null;
}

interface Drag {
  pointerId: number;
  end: End;
  frame: number;
  at: ImagePoint;
}

export function ImageSampleThumb() {
  const t = gradient.value.technique;
  const { mode, count, line } = t.sample;
  const meta = imageMeta.value;
  const aspect = meta && meta.width > 0 ? meta.height / meta.width : 1;
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  const palette = outputPalette.value;
  const markers = mode === "markers-x" || mode === "markers-y";
  const points: ImagePoint[] = markers
    ? markerOrder(palette, mode === "markers-x" ? "x" : "y").flatMap((s) => s.point ?? [])
    : scanPoints(mode, count, line);
  const half = 0.5 * Math.hypot(1, aspect);

  const pointAt = (e: { clientX: number; clientY: number }): ImagePoint => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: clamp01((e.clientX - rect.left) / rect.width),
      y: clamp01((e.clientY - rect.top) / rect.height),
    };
  };

  const apply = (d: Drag): void => {
    const current = gradient.peek().technique.sample.line;
    setLine({ ...current, [d.end]: d.at });
  };

  const finish = (): void => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (d.frame) cancelAnimationFrame(d.frame);
    apply(d);
    endWhenIdle(end, LABEL);
  };

  useEffect(
    () => () => {
      const d = drag.current;
      if (d?.frame) cancelAnimationFrame(d.frame);
    },
    [],
  );

  const startDrag = (e: PEvent, which: End): void => {
    if (drag.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    begin();
    drag.current = { pointerId: e.pointerId, end: which, frame: 0, at: pointAt(e) };
  };

  const moveDrag = (e: PEvent): void => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    d.at = pointAt(e);
    if (d.frame) return;
    d.frame = requestAnimationFrame(() => {
      d.frame = 0;
      apply(d);
    });
  };

  const keyMove = (e: KeyboardEvent, which: End): void => {
    const dx = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const dy = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (dx === 0 && dy === 0) return;
    e.preventDefault();
    const step = e.shiftKey ? BIG_STEP : STEP;
    const current = gradient.peek().technique.sample.line;
    const p = current[which];
    const next = {
      x: clamp01(Math.round((p.x + dx * step) * 1000) / 1000),
      y: clamp01(Math.round((p.y + dy * step) * 1000) / 1000),
    };
    setLine({ ...current, [which]: next });
  };

  const handle = (which: End, name: string) => {
    const p = line[which];
    return (
      <button
        key={which}
        type="button"
        class="sample-handle"
        data-testid="sample-handle"
        data-end={which}
        data-dragging={drag.current?.end === which ? "" : undefined}
        aria-label={`${name}, x ${pct(p.x)}%, y ${pct(p.y)}%`}
        aria-describedby="sample-handle-keys"
        style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
        onPointerDown={(e) => startDrag(e as PEvent, which)}
        onPointerMove={(e) => moveDrag(e as PEvent)}
        onPointerUp={finish}
        onPointerCancel={finish}
        onLostPointerCapture={finish}
        onKeyDown={(e) => keyMove(e, which)}
      />
    );
  };

  return (
    <div class="sample-thumb-row">
      <div
        ref={box}
        class="sample-thumb"
        data-testid="sample-thumb"
        data-busy={sampling.value || undefined}
        style={{ "--sample-aspect": String(aspect) }}
      >
        <Picture aspect={aspect} />
        <svg
          class="sample-thumb__lines"
          viewBox={`0 0 1 ${aspect}`}
          aria-hidden="true"
          focusable="false"
        >
          {mode === "line" && (
            <line
              class="sample-thumb__line"
              x1={line.a.x}
              y1={line.a.y * aspect}
              x2={line.b.x}
              y2={line.b.y * aspect}
            />
          )}
          {mode === "radial" &&
            Array.from({ length: count }, (_, i) => (
              <circle
                key={i}
                class="sample-thumb__ring"
                cx={0.5}
                cy={0.5 * aspect}
                r={(half * (i + 1)) / count}
              />
            ))}
        </svg>
        {points.map((p, i) => (
          <span
            key={i}
            class="sample-dot"
            data-testid="sample-dot"
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          />
        ))}
        {mode === "line" && (
          <>
            {handle("a", "Line start")}
            {handle("b", "Line end")}
          </>
        )}
      </div>
      {mode === "line" && (
        <span id="sample-handle-keys" class="visually-hidden">
          Drag a handle, or use the arrow keys to move it 1%, with Shift 10%.
        </span>
      )}
    </div>
  );
}
