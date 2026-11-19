/**
 * A minimal PNG decoder for tests (M3-T11): 8-bit RGB or RGBA, not interlaced, which covers the
 * images `tools/png.ts` writes, such as `public/samples/mockup-scene.png`. Returns RGBA pixels.
 */
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import type { AnalysisImage } from "../../src/extract/pipeline";

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
};

export function decodePng(bytes: Uint8Array): AnalysisImage {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Uint8Array[] = [];
  for (let at = 8; at < bytes.length; ) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    const body = bytes.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = view.getUint32(at + 8);
      height = view.getUint32(at + 12);
      const [depth, colorType, , , interlace] = body.subarray(8, 13);
      if (depth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
        throw new Error("decodePng reads 8-bit RGB or RGBA without interlacing only");
      }
      channels = colorType === 6 ? 4 : 3;
    } else if (type === "IDAT") {
      idat.push(body);
    }
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rows = new Uint8Array(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)] ?? 0;
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    for (let i = 0; i < stride; i += 1) {
      const x = raw[src + i] ?? 0;
      const a = i >= channels ? (rows[row + i - channels] ?? 0) : 0;
      const b = y > 0 ? (rows[row - stride + i] ?? 0) : 0;
      const c = y > 0 && i >= channels ? (rows[row - stride + i - channels] ?? 0) : 0;
      let v = x;
      if (filter === 1) v = x + a;
      else if (filter === 2) v = x + b;
      else if (filter === 3) v = x + ((a + b) >> 1);
      else if (filter === 4) v = x + paeth(a, b, c);
      rows[row + i] = v & 0xff;
    }
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p += 1) {
    data[p * 4] = rows[p * channels] ?? 0;
    data[p * 4 + 1] = rows[p * channels + 1] ?? 0;
    data[p * 4 + 2] = rows[p * channels + 2] ?? 0;
    data[p * 4 + 3] = channels === 4 ? (rows[p * channels + 3] ?? 0) : 255;
  }
  return { width, height, data };
}

export const readPng = (path: string): AnalysisImage => decodePng(readFileSync(path));
