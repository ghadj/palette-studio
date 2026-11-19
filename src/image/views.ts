/**
 * The Palette and Values image views (spec 3.8). The worker's `view` handler calls them on the
 * working master at display size, made in the worker or sent once per image by the main-thread
 * fallback (spec 7.4). Pure; they loop over pixels, so they run only in the worker.
 */
import { hexToRgb, type Oklab, oklabToHex, srgbToLinear } from "../color/convert";
import { rgb8ToWorking } from "../color/working-space";
import type { AnalysisImage } from "../extract/pipeline";
import type { ViewSettings } from "../types";

/** A drawn view: RGBA pixels at the image's size, and what the rows under the image show. */
export interface DrawnView {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
  /** Palette view: each color's share of the opaque pixels, in palette order; else empty. */
  shares: number[];
  /** Values view: each band's share, dark to light; else empty. */
  bandShares: number[];
}

/**
 * Pixels with alpha below this aren't part of the image a view shows: they are drawn transparent
 * and left out of the shares. It is the default alpha cutoff (spec 2.4), since a view request
 * carries no extraction settings.
 */
export const VIEW_ALPHA_CUTOFF = 128;

/** The 8-bit sRGB bytes of a color as the strip shows it: its hex, clamped to sRGB. */
function displayedBytes(color: Oklab): [number, number, number] {
  const { r, g, b } = hexToRgb(oklabToHex(color));
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/** The index of the nearest color in `centers` (OKLab, 3 per color); ties go to the lower index. */
function nearest(centers: Float64Array, l: number, a: number, b: number): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let j = 0; j < centers.length; j += 3) {
    const dl = l - (centers[j] ?? 0);
    const da = a - (centers[j + 1] ?? 0);
    const db = b - (centers[j + 2] ?? 0);
    const d = dl * dl + da * da + db * db;
    if (d < bestDistance) {
      bestDistance = d;
      best = j / 3;
    }
  }
  return best;
}

/**
 * Floyd–Steinberg: spreads one channel's error at `e` (an index into this row's errors) to the
 * pixel on the right (7/16) and to the three below (3/16, 5/16, 1/16).
 */
function spread(here: Float64Array, below: Float64Array, e: number, err: number): void {
  here[e + 3] = (here[e + 3] ?? 0) + (err * 7) / 16;
  below[e - 3] = (below[e - 3] ?? 0) + (err * 3) / 16;
  below[e] = (below[e] ?? 0) + (err * 5) / 16;
  below[e + 3] = (below[e + 3] ?? 0) + err / 16;
}

/**
 * Each pixel takes its nearest palette color in OKLab (spec 3.8). Colors are compared and drawn as
 * the strip shows them, by their hex, so every opaque pixel equals one palette color. With dither,
 * Floyd–Steinberg runs left to right, top to bottom, with the error diffused in OKLab (plan D18).
 */
export function paletteView(
  image: AnalysisImage,
  colors: readonly Oklab[],
  dither: boolean,
): DrawnView {
  const { width, height, data } = image;
  const count = width * height;
  const out = new Uint8ClampedArray(count * 4);
  const k = colors.length;
  if (k === 0) return { width, height, data: out, shares: [], bandShares: [] };

  const toOklab = rgb8ToWorking("oklab");
  const bytes = colors.map(displayedBytes);
  const centers = new Float64Array(k * 3);
  for (const [i, [r, g, b]] of bytes.entries()) toOklab(r, g, b, centers, i * 3);
  const counts = new Float64Array(k);
  const p = new Float64Array(3);
  let opaque = 0;

  // Floyd–Steinberg error for this row and the next, with one spare entry at each end.
  const errors = dither
    ? [new Float64Array((width + 2) * 3), new Float64Array((width + 2) * 3)]
    : [];
  // Consecutive pixels often share a color, so the last conversion (and, without dither, the
  // last answer) is reused.
  let lastKey = -1;
  let lastLabel = 0;

  for (let y = 0; y < height; y += 1) {
    const here = errors[y % 2];
    const below = errors[(y + 1) % 2];
    below?.fill(0);
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const o = i * 4;
      if ((data[o + 3] ?? 0) < VIEW_ALPHA_CUTOFF) continue;
      const r = data[o] ?? 0;
      const g = data[o + 1] ?? 0;
      const b = data[o + 2] ?? 0;
      const key = (r << 16) | (g << 8) | b;
      if (key !== lastKey) {
        toOklab(r, g, b, p, 0);
        lastKey = key;
        if (!dither) lastLabel = nearest(centers, p[0] ?? 0, p[1] ?? 0, p[2] ?? 0);
      }
      let label = lastLabel;
      if (here && below) {
        const e = (x + 1) * 3;
        const l = (p[0] ?? 0) + (here[e] ?? 0);
        const a = (p[1] ?? 0) + (here[e + 1] ?? 0);
        const bb = (p[2] ?? 0) + (here[e + 2] ?? 0);
        label = nearest(centers, l, a, bb);
        const c = label * 3;
        spread(here, below, e, l - (centers[c] ?? 0));
        spread(here, below, e + 1, a - (centers[c + 1] ?? 0));
        spread(here, below, e + 2, bb - (centers[c + 2] ?? 0));
      }
      const color = bytes[label] ?? [0, 0, 0];
      out[o] = color[0];
      out[o + 1] = color[1];
      out[o + 2] = color[2];
      out[o + 3] = 255;
      counts[label] = (counts[label] ?? 0) + 1;
      opaque += 1;
    }
  }
  const shares = Array.from(counts, (n) => (opaque > 0 ? n / opaque : 0));
  return { width, height, data: out, shares, bandShares: [] };
}

let grayBounds: Float64Array | null = null;
/**
 * The OKLab L at which the 8-bit gray rounds up from v to v + 1, for v = 0 to 254: the L of the
 * sRGB value v + 0.5 (a gray has a = b = 0, so linear R = G = B = L³).
 */
function bounds(): Float64Array {
  if (!grayBounds) {
    grayBounds = new Float64Array(255);
    for (let v = 0; v < 255; v += 1) {
      grayBounds[v] = Math.cbrt(srgbToLinear({ r: (v + 0.5) / 255, g: 0, b: 0 }).r);
    }
  }
  return grayBounds;
}

/** The 8-bit sRGB gray with OKLab lightness `l` (a = b = 0), clamped to 0 to 255. */
function grayByte(l: number): number {
  const b = bounds();
  // The number of bounds at or below l, by binary search.
  let lo = 0;
  let hi = b.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((b[mid] ?? 0) <= l) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * The image in grayscale by OKLab lightness (spec 3.8). Continuous keeps each pixel's L. With 3 or
 * 5 bands, L splits into equal steps and each band is drawn as the gray at its middle (with 5
 * bands: L 0.1, 0.3, 0.5, 0.7 and 0.9); L 1 goes in the top band.
 */
export function valuesView(image: AnalysisImage, bands: ViewSettings["bands"]): DrawnView {
  const { width, height, data } = image;
  const count = width * height;
  const out = new Uint8ClampedArray(count * 4);
  const toOklab = rgb8ToWorking("oklab");
  const p = new Float64Array(3);
  const n = bands === "continuous" ? 0 : bands;
  const grays = Array.from({ length: n }, (_, i) => grayByte((i + 0.5) / n));
  const counts = new Float64Array(n);
  let opaque = 0;
  let lastKey = -1;
  let lastGray = 0;
  let lastBand = 0;
  for (let i = 0; i < count; i += 1) {
    const o = i * 4;
    if ((data[o + 3] ?? 0) < VIEW_ALPHA_CUTOFF) continue;
    const r = data[o] ?? 0;
    const g = data[o + 1] ?? 0;
    const b = data[o + 2] ?? 0;
    const key = (r << 16) | (g << 8) | b;
    if (key !== lastKey) {
      toOklab(r, g, b, p, 0);
      const l = p[0] ?? 0;
      lastKey = key;
      if (n === 0) {
        lastGray = grayByte(l);
      } else {
        lastBand = Math.min(n - 1, Math.max(0, Math.floor(l * n)));
        lastGray = grays[lastBand] ?? 0;
      }
    }
    out[o] = lastGray;
    out[o + 1] = lastGray;
    out[o + 2] = lastGray;
    out[o + 3] = 255;
    if (n > 0) counts[lastBand] = (counts[lastBand] ?? 0) + 1;
    opaque += 1;
  }
  const bandShares = Array.from(counts, (c) => (opaque > 0 ? c / opaque : 0));
  return { width, height, data: out, shares: [], bandShares };
}

/**
 * What a drawn view depends on, as a cache key (plan M3-T11): the image version and the mode, and
 * for the Palette view the palette's hexes (it draws colors by their hex) and dither, or for the
 * Values view the bands.
 */
export function viewKey(
  version: number,
  mode: "palette" | "values",
  colors: readonly Oklab[],
  bands: ViewSettings["bands"],
  dither: boolean,
): string {
  return mode === "palette"
    ? `${version}|palette|${colors.map(oklabToHex).join(",")}|${dither ? "dither" : "flat"}`
    : `${version}|values|${bands}`;
}
