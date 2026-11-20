import { hexToRgb } from "../../src/color/convert";
import type { AnalysisImage } from "../../src/extract/pipeline";

/** RGBA bytes for a list of [hex, count, alpha] runs. */
export function pixels(runs: Array<[string, number, number?]>): Uint8ClampedArray {
  const total = runs.reduce((n, [, count]) => n + count, 0);
  const out = new Uint8ClampedArray(total * 4);
  let i = 0;
  for (const [hex, count, alpha = 255] of runs) {
    const { r, g, b } = hexToRgb(hex);
    for (let k = 0; k < count; k += 1) {
      out.set([Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), alpha], i);
      i += 4;
    }
  }
  return out;
}

/** A one-row image of the given RGBA bytes. */
export function row(data: Uint8ClampedArray): AnalysisImage {
  return { width: data.length / 4, height: 1, data };
}

/**
 * An image of width × height whose pixel at (x, y) is `fn(x, y)`: a hex string, or a hex and an
 * alpha (0 to 255).
 */
export function image(
  width: number,
  height: number,
  fn: (x: number, y: number) => string | readonly [string, number],
): AnalysisImage {
  const data = new Uint8ClampedArray(width * height * 4);
  const cache = new Map<string, [number, number, number]>();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = fn(x, y);
      const [hex, alpha] = typeof value === "string" ? [value, 255] : value;
      let rgb = cache.get(hex);
      if (!rgb) {
        const c = hexToRgb(hex);
        rgb = [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
        cache.set(hex, rgb);
      }
      data.set([...rgb, alpha], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}
