/**
 * The eyedropper's layer over the image well (spec 3.2 "Eyedropper", 3.7; M3 decisions 5c and
 * D11). While `eyedropperMode` is on, the well's pan and pinch ignore every pointerdown (see
 * `pointerRouting.ts`), so this layer takes them: a press shows the loupe, a move updates it and
 * release samples the working master through the worker's `sample` (spec 7.4). In Add mode the
 * pick becomes a new picked, locked swatch with its point; in Replace mode it retargets the
 * selected swatch. Each pick is one undo step. Esc cancels a press in progress, or else turns the
 * eyedropper off. Nothing here uses the browser's EyeDropper API (spec 6.1).
 *
 * Also here: `EyedropperHint`, the hint row under the image with the "Replace swatch N" chip.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { oklabToHex } from "../color/convert";
import { imageClient } from "../extract/client";
import { canAdd, MAX_SWATCHES, selectedSwatch } from "../palette/model";
import { addPicked, pointFromWell, replaceWithPick } from "../state/eyedropper";
import { commit } from "../state/history";
import {
  eyedropperMode,
  imageMessage,
  imageView,
  palette,
  selectedSwatchId,
  selectSwatch,
  viewSettings,
} from "../state/signals";
import type { ImagePoint, SampleRadius, SampleStat } from "../types";
import { Loupe, type LoupePixels } from "./Loupe";

/** What a pick does now: add a swatch, or retarget the selected one (decision 5c). */
type Target = { kind: "add" } | { kind: "replace"; id: string };

/** Replace mode needs a selected swatch; without one a pick adds. */
function currentTarget(): Target {
  const selected = selectedSwatchId.value;
  if (eyedropperMode.value === "replace" && selectedSwatch(palette.value, selected)) {
    return { kind: "replace", id: selected as string };
  }
  return { kind: "add" };
}

interface Press {
  pointerId: number;
  touch: boolean;
  /** Position in the well, px. */
  at: { x: number; y: number };
  point: ImagePoint;
  hex: string;
  crop: LoupePixels | null;
  /** True once the first sample has arrived, so the loupe doesn't show an empty frame. */
  ready: boolean;
}

export function EyedropperLayer() {
  const layer = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [press, setPress] = useState<Press | null>(null);
  /** Bumped when a press ends or is cancelled: a reply for an older one is dropped. */
  const session = useRef(0);
  const latest = useRef<Press | null>(null);
  const frame = useRef(0);
  const mode = eyedropperMode.value;
  const inImageView = viewSettings.value.mode === "image";
  const target = currentTarget();
  const full = target.kind === "add" && !canAdd(palette.value);
  const on = mode !== "off" && inImageView;

  // The eyedropper belongs to the Image view, and goes away with the well.
  useEffect(() => {
    if (mode !== "off" && !inImageView) eyedropperMode.value = "off";
  }, [mode, inImageView]);
  useEffect(
    () => () => {
      eyedropperMode.value = "off";
    },
    [],
  );

  useLayoutEffect(() => {
    const el = layer.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [on]);

  const cancel = () => {
    session.current += 1;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
    latest.current = null;
    setPress(null);
  };

  // Esc cancels a press, or else turns the eyedropper off.
  useEffect(() => {
    if (!on) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (latest.current) cancel();
      else eyedropperMode.value = "off";
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [on]);
  useEffect(() => cancel, []);

  if (!on) return null;

  /** Radius and statistic: the retargeted swatch's own, or the defaults for a new one. */
  const settingsFor = (): { radius: SampleRadius; stat: SampleStat } => {
    const t = currentTarget();
    const swatch = t.kind === "replace" ? palette.peek().find((s) => s.id === t.id) : undefined;
    return { radius: swatch?.sampleRadius ?? "auto", stat: swatch?.sampleStat ?? "mean" };
  };

  const locate = (event: PointerEvent) => {
    const el = layer.current as HTMLDivElement;
    const rect = el.getBoundingClientRect();
    const at = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const well = { width: rect.width || 1, height: rect.height || 1 };
    return { at, point: pointFromWell(at, well, imageView.peek()) };
  };

  const sampleNow = async (point: ImagePoint) => {
    const { radius, stat } = settingsFor();
    return imageClient().sample(point, radius, stat);
  };

  /** Samples for the loupe, at most once per animation frame; a reply for an older press is dropped. */
  const refresh = () => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(async () => {
      frame.current = 0;
      const current = latest.current;
      if (!current) return;
      const mine = session.current;
      try {
        const { color, crop } = await sampleNow(current.point);
        if (session.current !== mine || latest.current !== current) {
          // Newer position meanwhile: sample again for it.
          if (session.current === mine && latest.current) refresh();
          return;
        }
        const next = { ...current, hex: oklabToHex(color), crop, ready: true };
        latest.current = next;
        setPress(next);
      } catch {
        // The release reports a failure; a failed loupe frame is just skipped.
      }
    });
  };

  const onPointerDown = (event: PointerEvent) => {
    if (latest.current || full) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    try {
      layer.current?.setPointerCapture(event.pointerId);
    } catch {
      // The press still works without capture.
    }
    const { at, point } = locate(event);
    const next: Press = {
      pointerId: event.pointerId,
      touch: event.pointerType === "touch",
      at,
      point,
      hex: "",
      crop: null,
      ready: false,
    };
    session.current += 1;
    latest.current = next;
    setPress(next);
    refresh();
  };

  const onPointerMove = (event: PointerEvent) => {
    const current = latest.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault();
    const { at, point } = locate(event);
    const next = { ...current, at, point };
    latest.current = next;
    setPress(next);
    refresh();
  };

  const onPointerUp = async (event: PointerEvent) => {
    const current = latest.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault();
    const { at, point } = locate(event);
    const done = { ...current, at, point };
    const t = currentTarget();
    session.current += 1;
    const mine = session.current;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
    latest.current = null;
    setPress(null);
    try {
      const { color } = await sampleNow(done.point);
      // Esc, or a new press, during the sample: leave the palette alone.
      if (session.current !== mine) return;
      const list = palette.peek();
      const next =
        t.kind === "replace"
          ? replaceWithPick(list, t.id, color, done.point)
          : addPicked(list, color, done.point);
      if (next === list) return;
      palette.value = next;
      if (t.kind === "add") selectSwatch(next[next.length - 1]?.id ?? null);
      commit(t.kind === "add" ? "Add picked color" : "Replace color");
    } catch {
      imageMessage.value = { kind: "error", text: "The color couldn't be picked. Try again." };
    }
  };

  return (
    <div
      ref={layer}
      class="eyedropper-layer"
      data-testid="eyedropper-layer"
      data-disabled={full || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={(event) => {
        if (latest.current?.pointerId === event.pointerId) cancel();
      }}
    >
      {press?.ready && size.width > 0 && (
        <Loupe hex={press.hex} crop={press.crop} at={press.at} well={size} touch={press.touch} />
      )}
    </div>
  );
}

/**
 * The hint row under the image (ui-contract column 1 item 3). With the eyedropper on it says what a
 * pick does, and offers the "Replace swatch N" chip to retarget the selected swatch (decision 5c).
 */
export function EyedropperHint() {
  const list = palette.value;
  const mode = eyedropperMode.value;
  if (viewSettings.value.mode !== "image") return null;
  if (mode === "off") {
    return list.length > 0 ? (
      <p class="hint" data-testid="marker-hint">
        Drag a marker to resample
      </p>
    ) : null;
  }
  const selected = selectedSwatchId.value;
  const index = list.findIndex((s) => s.id === selected);
  const target = currentTarget();
  const text =
    target.kind === "replace"
      ? `Pick a color to replace swatch ${index + 1}`
      : !canAdd(list)
        ? `A palette holds at most ${MAX_SWATCHES} colors. Replace a swatch instead`
        : "Pick a color from the image to add it";
  return (
    <div class="hint-row">
      <p class="hint" data-testid="marker-hint">
        {text}
      </p>
      {index >= 0 && (
        <button
          type="button"
          class="chip"
          aria-pressed={target.kind === "replace"}
          onClick={() => {
            eyedropperMode.value = target.kind === "replace" ? "add" : "replace";
          }}
        >
          {`Replace swatch ${index + 1}`}
        </button>
      )}
    </div>
  );
}
