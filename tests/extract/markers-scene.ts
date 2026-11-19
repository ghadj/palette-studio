/**
 * Test helper for M3-T10: decodes `public/samples/mockup-scene.png` (8-bit RGB, not interlaced)
 * and makes its analysis copy by area averaging, which approximates the app's smooth resampling
 * (src/image/tiers.ts) without a canvas.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inflateSync } from "node:zlib";
import type { AnalysisImage } from "../../src/extract/pipeline";

/** Decodes an 8-bit RGB or RGBA, non-interlaced PNG into RGBA bytes. */
export function decodePng(bytes: Buffer): AnalysisImage {
  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Buffer[] = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const depth = body[8];
      const color = body[9];
      if (depth !== 8 || (color !== 2 && color !== 6) || body[12] !== 0) {
        throw new Error("Only 8-bit, non-interlaced RGB or RGBA PNGs are supported");
      }
      channels = color === 2 ? 3 : 4;
    } else if (type === "IDAT") {
      idat.push(body);
    }
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rows = new Uint8Array(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i += 1) {
      const a = i >= channels ? (rows[y * stride + i - channels] ?? 0) : 0;
      const b = y > 0 ? (rows[(y - 1) * stride + i] ?? 0) : 0;
      const c = y > 0 && i >= channels ? (rows[(y - 1) * stride + i - channels] ?? 0) : 0;
      const x = line[i] ?? 0;
      let value: number;
      switch (filter) {
        case 0:
          value = x;
          break;
        case 1:
          value = x + a;
          break;
        case 2:
          value = x + b;
          break;
        case 3:
          value = x + ((a + b) >> 1);
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          value = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default:
          throw new Error(`Unknown PNG filter ${filter}`);
      }
      rows[y * stride + i] = value & 0xff;
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

/** Area-average downsampling to `width` × `height`, with fractional pixel coverage. */
export function areaResample(source: AnalysisImage, width: number, height: number): AnalysisImage {
  const sx = source.width / width;
  const sy = source.height / height;
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const y0 = y * sy;
    const y1 = y0 + sy;
    for (let x = 0; x < width; x += 1) {
      const x0 = x * sx;
      const x1 = x0 + sx;
      const sum = [0, 0, 0, 0];
      let total = 0;
      for (let v = Math.floor(y0); v < Math.ceil(y1); v += 1) {
        const wy = Math.min(y1, v + 1) - Math.max(y0, v);
        for (let u = Math.floor(x0); u < Math.ceil(x1); u += 1) {
          const w = wy * (Math.min(x1, u + 1) - Math.max(x0, u));
          const o = (v * source.width + u) * 4;
          for (let c = 0; c < 4; c += 1) sum[c] = (sum[c] ?? 0) + w * (source.data[o + c] ?? 0);
          total += w;
        }
      }
      for (let c = 0; c < 4; c += 1) out[(y * width + x) * 4 + c] = (sum[c] ?? 0) / total;
    }
  }
  return { width, height, data: out };
}

/** mockup-scene.png at full size (1600 × 800). */
export function mockupScene(): AnalysisImage {
  return decodePng(readFileSync(resolve(__dirname, "../../public/samples/mockup-scene.png")));
}
