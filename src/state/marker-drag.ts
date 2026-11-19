/**
 * The marker drag (spec 3.7 "Dragging", plan M3-T15), as a state machine with no DOM and no
 * signals. Pointer moves reach it as normalized points. Once per animation frame it writes the
 * newest point to the swatch and asks for a sample of the patch there; each reply sets the swatch
 * to the sampled color. Release waits for the sample of the final point, then ends the history
 * group, so the whole drag is one undo step. Cancel (Esc, `pointercancel`, a second finger) puts
 * the palette back exactly as it was and records nothing.
 *
 * Sampling happens in the worker (spec 7.4); this module only calls the `sample` it is given.
 */
import { type Oklab, oklabToOklch } from "../color/convert";
import type { ImagePoint, SampleRadius, SampleStat, Swatch } from "../types";

/** What a sample returns: the patch's color, and whatever the caller shows in its loupe. */
export interface Sampled<Crop = unknown> {
  color: Oklab;
  crop: Crop;
}

export interface DragDeps<Crop = unknown> {
  /** Runs `callback` before the next paint (requestAnimationFrame); returns a handle. */
  frame(callback: () => void): number;
  cancelFrame(handle: number): void;
  sample(point: ImagePoint, radius: SampleRadius, stat: SampleStat): Promise<Sampled<Crop>>;
  getPalette(): Swatch[];
  setPalette(palette: Swatch[]): void;
  /** Starts and ends the history group (`begin`, `end`). */
  begin(): void;
  end(label?: string): void;
  /** Called after each sample lands, for the loupe. */
  onSample?(info: { id: string; point: ImagePoint; color: Oklab; crop: Crop }): void;
  /** Called when the drag is over, committed or cancelled. */
  onEnd?(): void;
}

/** The history label of a marker drag or nudge (plan D16). */
export const MOVE_LABEL = "Move marker";

export const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** The swatch with a new point. Other swatches keep their identity. */
export function withPoint(palette: Swatch[], id: string, point: ImagePoint): Swatch[] {
  return palette.map((s) => (s.id === id ? { ...s, point } : s));
}

/** The swatch set to the sampled color, picked and pinned (spec 3.7; decision 24). */
export function withSample(palette: Swatch[], id: string, color: Oklab): Swatch[] {
  return palette.map((s) =>
    s.id === id ? { ...s, color: oklabToOklch(color), origin: "picked", pinned: true } : s,
  );
}

/** A point moved by a distance in master pixels, kept inside the image. */
export function nudgePoint(
  point: ImagePoint,
  dxPx: number,
  dyPx: number,
  master: { width: number; height: number },
): ImagePoint {
  return {
    x: clamp01(point.x + dxPx / Math.max(1, master.width)),
    y: clamp01(point.y + dyPx / Math.max(1, master.height)),
  };
}

/**
 * The image point a pointer is over, from the well's box on screen and the view (offsets and scale
 * in well fractions, as `imageView` holds them). `grab` is where the pointer sat from the marker's
 * center at pointerdown, so the marker doesn't jump under the pointer.
 */
export function pointerToPoint(
  client: { x: number; y: number },
  grab: { x: number; y: number },
  box: { left: number; top: number; width: number; height: number },
  view: { x: number; y: number; scale: number },
): ImagePoint {
  const fx = (client.x - grab.x - box.left) / Math.max(1, box.width);
  const fy = (client.y - grab.y - box.top) / Math.max(1, box.height);
  return { x: clamp01((fx - view.x) / view.scale), y: clamp01((fy - view.y) / view.scale) };
}

interface Run {
  id: string;
  /** The palette before the drag, put back whole on cancel. */
  start: Swatch[];
  /** The newest point, and the one the swatch holds. */
  point: ImagePoint;
  written: ImagePoint;
  /** The point whose sample has been applied. */
  sampled: ImagePoint | null;
  frame: number;
  inflight: Promise<void> | null;
  releasing: boolean;
}

export class MarkerDrag<Crop = unknown> {
  private run: Run | null = null;

  constructor(private readonly deps: DragDeps<Crop>) {}

  get active(): boolean {
    return this.run !== null;
  }

  /** Starts dragging the swatch's marker. False when the swatch has no point or one is active. */
  start(id: string): boolean {
    if (this.run) return false;
    const palette = this.deps.getPalette();
    const point = palette.find((s) => s.id === id)?.point;
    if (!point) return false;
    this.deps.begin();
    this.run = {
      id,
      start: palette,
      point,
      written: point,
      sampled: point,
      frame: 0,
      inflight: null,
      releasing: false,
    };
    return true;
  }

  /** The pointer moved. The swatch and the sample catch up at most once per frame. */
  move(point: ImagePoint): void {
    const run = this.run;
    if (!run || run.releasing) return;
    run.point = point;
    if (!run.frame) {
      run.frame = this.deps.frame(() => {
        run.frame = 0;
        if (this.run !== run) return;
        this.write(run);
        this.sampleLatest(run);
      });
    }
  }

  /** The pointer lifted: the swatch takes the sample at the final point, and one step is made. */
  async release(): Promise<void> {
    const run = this.run;
    if (!run) return;
    run.releasing = true;
    if (run.frame) {
      this.deps.cancelFrame(run.frame);
      run.frame = 0;
    }
    this.write(run);
    while (this.run === run && run.sampled !== run.point) {
      this.sampleLatest(run);
      await run.inflight;
    }
    if (this.run !== run) return;
    this.run = null;
    this.deps.end(MOVE_LABEL);
    this.deps.onEnd?.();
  }

  /** Esc, `pointercancel` or a second finger: everything goes back and no step is recorded. */
  cancel(): void {
    const run = this.run;
    if (!run) return;
    if (run.frame) this.deps.cancelFrame(run.frame);
    this.run = null;
    this.deps.setPalette(run.start);
    this.deps.end();
    this.deps.onEnd?.();
  }

  private write(run: Run): void {
    if (run.written === run.point) return;
    run.written = run.point;
    this.deps.setPalette(withPoint(this.deps.getPalette(), run.id, run.point));
  }

  /** Asks for a sample of the newest point, unless one is already out. */
  private sampleLatest(run: Run): void {
    if (run.inflight || run.sampled === run.point) return;
    const point = run.point;
    const swatch = this.deps.getPalette().find((s) => s.id === run.id);
    if (!swatch) {
      this.cancel();
      return;
    }
    const request = this.deps.sample(point, swatch.sampleRadius, swatch.sampleStat).then(
      (result) => {
        run.inflight = null;
        if (this.run !== run) return;
        run.sampled = point;
        this.deps.setPalette(withSample(this.deps.getPalette(), run.id, result.color));
        this.deps.onSample?.({ id: run.id, point, color: result.color, crop: result.crop });
        // The pointer moved on while this was out: sample where it is now.
        if (!run.releasing && run.sampled !== run.point && !run.frame) this.sampleLatest(run);
      },
      () => {
        run.inflight = null;
        // A sample that can't be made leaves nothing half-moved.
        if (this.run === run) this.cancel();
      },
    );
    run.inflight = request;
  }
}
