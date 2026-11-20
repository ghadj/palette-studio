/**
 * Image sample stops (spec 4.2, 3.7; plan D18): colors read along a line, a scan or the markers.
 * The sampling itself runs in the worker (spec 7.4) through the client; its result is stored in
 * `technique.sample.colors`, and `sampledStops` builds the stops from that. `sources.ts` calls
 * `sampledStops`.
 */
import { type Oklab, oklabToOklch } from "../color/convert";
import type {
  GradientStop,
  ImagePoint,
  Oklch,
  SampleRadius,
  SampleStat,
  Swatch,
  Technique,
} from "../types";
import { MAX_STOPS, makeStop, swatchStops } from "./model";

type SampleMode = Technique["sample"]["mode"];

/** The two requests this module makes of the image client (spec 7.4). */
export interface SamplingClient {
  sample(point: ImagePoint, radius: SampleRadius, stat: SampleStat): Promise<{ color: Oklab }>;
  ring(center: ImagePoint, r0: number, r1: number): Promise<Oklab>;
}

/**
 * The points a scan reads, `count` of them evenly spaced along the line (from `line.a` to
 * `line.b`), or along y 0.5 from x 0.05 to 0.95 (Horizontal) or x 0.5 from y 0.05 to 0.95
 * (Vertical). The other modes read no points.
 */
export function scanPoints(
  mode: SampleMode,
  count: number,
  line: { a: ImagePoint; b: ImagePoint },
): ImagePoint[] {
  let a: ImagePoint;
  let b: ImagePoint;
  if (mode === "line") [a, b] = [line.a, line.b];
  else if (mode === "horizontal")
    [a, b] = [
      { x: 0.05, y: 0.5 },
      { x: 0.95, y: 0.5 },
    ];
  else if (mode === "vertical")
    [a, b] = [
      { x: 0.5, y: 0.05 },
      { x: 0.5, y: 0.95 },
    ];
  else return [];
  const n = Math.max(2, Math.round(count));
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  });
}

/**
 * The swatches that have a point, ordered by x or by y (ties keep palette order). Swatches without
 * a point, such as those edited by value, are skipped (M3 decision 65).
 */
export function markerOrder(palette: readonly Swatch[], axis: "x" | "y"): Swatch[] {
  return palette
    .map((swatch, index) => ({ swatch, index }))
    .filter(({ swatch }) => swatch.point !== null)
    .sort(
      (p, q) => (p.swatch.point?.[axis] ?? 0) - (q.swatch.point?.[axis] ?? 0) || p.index - q.index,
    )
    .map(({ swatch }) => swatch);
}

/** Reads each point in turn (Auto radius, mean; spec 3.7), one request after the other. */
export async function sampleStops(
  client: SamplingClient,
  points: readonly ImagePoint[],
): Promise<Oklch[]> {
  const colors: Oklch[] = [];
  for (const point of points) {
    const { color } = await client.sample(point, "auto", "mean");
    colors.push(oklabToOklch(color));
  }
  return colors;
}

/**
 * The radial scan: `count` equal rings around the image center, out to the half-diagonal, each
 * ring's mean (computed in the worker). `aspect` is height over width; ring radii are fractions of
 * the width, as `client.ring` takes them.
 */
export async function ringStops(
  client: SamplingClient,
  count: number,
  aspect = 1,
): Promise<Oklch[]> {
  const n = Math.max(2, Math.round(count));
  const halfDiagonal = 0.5 * Math.hypot(1, aspect);
  const center = { x: 0.5, y: 0.5 };
  const colors: Oklch[] = [];
  for (let i = 0; i < n; i += 1) {
    const color = await client.ring(center, (halfDiagonal * i) / n, (halfDiagonal * (i + 1)) / n);
    colors.push(oklabToOklch(color));
  }
  return colors;
}

/**
 * Stops for the Image sample technique: fixed stops from `technique.sample.colors`, evenly spread,
 * or linked stops for the marker modes (plan D18). Before anything is sampled, or when no swatch
 * has a point, the palette order stands in.
 */
export function sampledStops(technique: Technique, swatches: readonly Swatch[]): GradientStop[] {
  const { mode, colors } = technique.sample;
  if (mode === "markers-x" || mode === "markers-y") {
    const ordered = markerOrder(swatches, mode === "markers-x" ? "x" : "y").slice(0, MAX_STOPS);
    return swatchStops(ordered.length > 0 ? ordered : swatches);
  }
  const fixed = colors.slice(0, MAX_STOPS);
  if (fixed.length === 0) return swatchStops(swatches);
  if (fixed.length === 1) {
    const only = fixed[0] as Oklch;
    return [0, 1].map((p) =>
      makeStop(p, { kind: "value", color: only, from: null }, { id: `stop-sample-${p}` }),
    );
  }
  return fixed.map((color, i) =>
    makeStop(
      i / (fixed.length - 1),
      { kind: "value", color, from: null },
      { id: `stop-sample-${i}` },
    ),
  );
}
