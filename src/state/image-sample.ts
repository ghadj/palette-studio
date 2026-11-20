/**
 * Live Image sample (spec 4.2, 3.7, 7.4; plan M4-T11, D18). The colors are read through the worker
 * (the UI thread never loops over pixels), one request per scan point, with job ids so a result
 * that a newer edit has overtaken is dropped. A result is stored in `technique.sample.colors` and
 * committed as "Image sample". A technique edit that causes a scan stays uncommitted until the
 * scan lands, so the edit and its colors are one undo step. A new image samples again.
 */
import { effect, signal } from "@preact/signals";
import type { Oklab } from "../color/convert";
import { imageClient } from "../extract/client";
import { ringStops, type SamplingClient, sampleStops, scanPoints } from "../gradient/image-sample";
import type { ImagePoint, Oklch, SampleRadius, SampleStat, Technique } from "../types";
import { applyTechnique } from "./gradient";
import { effectiveStops } from "./gradient-stops";
import { canUndo, clear, commit, onRestore } from "./history";
import { displayImage, gradient, imageMeta, imageSrc, masterThread } from "./signals";

type Sample = Technique["sample"];

let override: SamplingClient | null = null;
/** Tests inject a fake client; null restores the worker's. */
export function setSamplingClient(client: SamplingClient | null): void {
  override = client;
}

const workerClient: SamplingClient = {
  sample: (point: ImagePoint, radius: SampleRadius, stat: SampleStat): Promise<{ color: Oklab }> =>
    imageClient().sample(point, radius, stat),
  ring: (center, r0, r1) => imageClient().ring(center, r0, r1),
};

/** True while a scan is running, for the thumbnail's busy mark. */
export const sampling = signal(false);

/** Whether an image is on screen, so there is something to sample (the demo's fixture counts). */
export function imageReady(): boolean {
  return displayImage.peek() !== null || masterThread.peek() !== null || imageSrc.peek() !== null;
}

/** The marker modes read the swatches' own points, so they need no scan. */
export const isMarkerMode = (mode: Sample["mode"]): boolean =>
  mode === "markers-x" || mode === "markers-y";

/** True when the technique reads colors from the image by scanning. */
export const needsScan = (t: Technique): boolean =>
  t.kind === "image-sample" && !isMarkerMode(t.sample.mode);

let job = 0;
let idleWaiters: Array<() => void> = [];

function settle(): void {
  sampling.value = false;
  const waiting = idleWaiters;
  idleWaiters = [];
  for (const resolve of waiting) resolve();
}

/** Resolves once no scan is running (at once if none is). */
export function whenIdle(): Promise<void> {
  if (!sampling.peek()) return Promise.resolve();
  return new Promise((resolve) => idleWaiters.push(resolve));
}

/** Drops the running scan's result, for example on undo or when a scan is no longer needed. */
export function cancelSampling(): void {
  job += 1;
  settle();
}

const sameSample = (a: Sample, b: Sample): boolean =>
  a.mode === b.mode &&
  a.count === b.count &&
  a.line.a.x === b.line.a.x &&
  a.line.a.y === b.line.a.y &&
  a.line.b.x === b.line.b.x &&
  a.line.b.y === b.line.b.y;

/** Reads the colors a sample setting names. */
export async function scanColors(
  sample: Sample,
  aspect: number,
  client: SamplingClient,
): Promise<Oklch[]> {
  if (sample.mode === "radial") return ringStops(client, sample.count, aspect);
  return sampleStops(client, scanPoints(sample.mode, sample.count, sample.line));
}

class Stale extends Error {}

/**
 * Scans the current technique's sample setting and stores the colors, committing `label` (unless a
 * drag holds the step open). With no scan to make, it only settles.
 */
export function requestSampling(label = "Image sample", fromImage = false): void {
  const technique = gradient.peek().technique;
  if (!needsScan(technique) || !imageReady()) {
    cancelSampling();
    return;
  }
  job += 1;
  const id = job;
  const started = technique.sample;
  sampling.value = true;
  const base = override ?? workerClient;
  const guard = (): void => {
    if (id !== job) throw new Stale();
  };
  const client: SamplingClient = {
    sample: async (p, r, s) => {
      guard();
      const result = await base.sample(p, r, s);
      guard();
      return result;
    },
    ring: async (c, r0, r1) => {
      guard();
      const result = await base.ring(c, r0, r1);
      guard();
      return result;
    },
  };
  const meta = imageMeta.peek();
  const aspect = meta && meta.width > 0 ? meta.height / meta.width : 1;
  scanColors(started, aspect, client).then(
    (colors) => {
      if (id !== job) return;
      const g = gradient.peek();
      if (!needsScan(g.technique) || !sameSample(g.technique.sample, started)) {
        settle();
        return;
      }
      const clean = !canUndo.peek();
      gradient.value = {
        ...g,
        technique: { ...g.technique, sample: { ...g.technique.sample, colors } },
      };
      // A scan after a new image, with nothing to undo, is not an undoable edit.
      if (fromImage && clean) clear();
      else commit(label);
      settle();
    },
    () => {
      if (id === job) settle();
    },
  );
}

/**
 * Chooses a technique or changes its settings as one undo step. When that makes a scan, the step is
 * committed once the colors have landed, so the edit and its colors undo together.
 */
export function changeTechnique(next: Technique, label: string): void {
  const g = gradient.peek();
  // A change that leaves a live technique as it is records nothing.
  if (!g.custom && JSON.stringify(next) === JSON.stringify(g.technique)) return;
  if (needsScan(next) && imageReady()) {
    const kept = effectiveStops.peek().filter((s) => s.locked);
    gradient.value = { ...gradient.peek(), technique: next, custom: false, stops: kept };
    requestSampling(label);
    return;
  }
  cancelSampling();
  applyTechnique(next, label);
}

/** Ends a drag's undo step once any scan it started has landed. */
export function endWhenIdle(end: (label: string) => void, label: string): void {
  void whenIdle().then(() => end(label));
}

let started = false;

/** Call once at startup: a new image scans again, and undo cancels a scan under way. */
export function startImageSampling(): void {
  if (started) return;
  started = true;
  onRestore(cancelSampling);
  effect(() => {
    displayImage.value;
    masterThread.value;
    imageSrc.value;
    if (needsScan(gradient.peek().technique) && imageReady()) requestSampling("Image sample", true);
  });
}
