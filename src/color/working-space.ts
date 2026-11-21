/**
 * Working color spaces for extraction (spec 2.3, 2.4): OKLab (default), CIELAB, linear sRGB and
 * sRGB. `rgb8ToWorking` converts 8-bit sRGB fast enough to run per pixel in the extraction worker;
 * its results match the reference conversions in convert.ts.
 */
import type { WorkingSpace } from "../types";
import {
  labToRgb,
  linearRgbToOklab,
  type Oklab,
  rgbToLab,
  rgbToOklab,
  srgbToLinear,
} from "./convert";

/** Writes the working-space coordinates of an 8-bit sRGB color into out[offset..offset + 2]. */
export type ByteConverter = (
  r: number,
  g: number,
  b: number,
  out: Float64Array,
  offset: number,
) => void;

let linearTable: Float64Array | null = null;
/** Linear-light value of each 8-bit sRGB channel value, from the reference conversion. */
function linear(): Float64Array {
  if (!linearTable) {
    linearTable = new Float64Array(256);
    for (let v = 0; v < 256; v += 1) linearTable[v] = srgbToLinear({ r: v / 255, g: 0, b: 0 }).r;
  }
  return linearTable;
}

// The same coefficients as culori's linear sRGB to OKLab conversion (Ottosson 2020), so the fast
// path agrees with convert.ts (checked in tests/color/working-space.test.ts).
function linearToOklabInto(r: number, g: number, b: number, out: Float64Array, o: number): void {
  const l = Math.cbrt(0.412221469470763 * r + 0.5363325372617348 * g + 0.0514459932675022 * b);
  const m = Math.cbrt(0.2119034958178252 * r + 0.6806995506452344 * g + 0.1073969535369406 * b);
  const s = Math.cbrt(0.0883024591900564 * r + 0.2817188391361215 * g + 0.6299787016738222 * b);
  out[o] = 0.210454268309314 * l + 0.7936177747023054 * m - 0.0040720430116193 * s;
  out[o + 1] = 1.9779985324311684 * l - 2.4285922420485799 * m + 0.450593709617411 * s;
  out[o + 2] = 0.0259040424655478 * l + 0.7827717124575296 * m - 0.8086757549230774 * s;
}

export function rgb8ToWorking(space: WorkingSpace): ByteConverter {
  const lin = linear();
  switch (space) {
    case "oklab":
      return (r, g, b, out, o) => linearToOklabInto(lin[r] ?? 0, lin[g] ?? 0, lin[b] ?? 0, out, o);
    case "linear-srgb":
      return (r, g, b, out, o) => {
        out[o] = lin[r] ?? 0;
        out[o + 1] = lin[g] ?? 0;
        out[o + 2] = lin[b] ?? 0;
      };
    case "srgb":
      return (r, g, b, out, o) => {
        out[o] = r / 255;
        out[o + 1] = g / 255;
        out[o + 2] = b / 255;
      };
    case "cielab": {
      // CIELAB goes through the reference conversion, cached per distinct color.
      const cache = new Map<number, [number, number, number]>();
      return (r, g, b, out, o) => {
        const key = (r << 16) | (g << 8) | b;
        let lab = cache.get(key);
        if (!lab) {
          const c = rgbToLab({ r: r / 255, g: g / 255, b: b / 255 });
          lab = [c.l, c.a, c.b];
          cache.set(key, lab);
        }
        out[o] = lab[0];
        out[o + 1] = lab[1];
        out[o + 2] = lab[2];
      };
    }
  }
}

/** Converts a working-space color (such as a quantizer mean) to OKLab. */
export function workingToOklab(space: WorkingSpace, x: number, y: number, z: number): Oklab {
  switch (space) {
    case "oklab":
      return { l: x, a: y, b: z };
    case "linear-srgb":
      return linearRgbToOklab({ r: x, g: y, b: z });
    case "srgb":
      return rgbToOklab({ r: x, g: y, b: z });
    case "cielab":
      return rgbToOklab(labToRgb({ l: x, a: y, b: z }));
  }
}
