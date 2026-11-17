import { hexToRgb } from "../../src/color/convert";

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
