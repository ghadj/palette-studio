/**
 * A runtime test image for ring sampling (M4-T5): a red disk, a green ring and blue outside, with
 * the boundaries at fractions of the half-diagonal. Generated here, not committed (plan: runtime
 * fixtures live in a helper the task owns).
 */
import { deflateSync } from "node:zlib";

export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** Red inside `diskFraction` of the half-diagonal, green up to `ringFraction`, blue beyond. */
export function ringImagePixels(
  width: number,
  height: number,
  diskFraction: number,
  ringFraction: number,
): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  const half = Math.hypot(width, height) / 2;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const d = Math.hypot(x + 0.5 - width / 2, y + 0.5 - height / 2) / half;
      const rgb = d < diskFraction ? [255, 0, 0] : d < ringFraction ? [0, 255, 0] : [0, 0, 255];
      data.set([...rgb, 255], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

function crc32(bytes: Uint8Array): number {
  let c = ~0;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, body: Buffer): Buffer {
  const out = Buffer.alloc(12 + body.length);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, "ascii");
  body.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
  return out;
}

/** The image as an 8-bit RGBA PNG, for loading through a file input. */
export function ringImagePng(image: RgbaImage): Buffer {
  const { width, height, data } = image;
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0);
  head.writeUInt32BE(height, 4);
  head[8] = 8;
  head[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    Buffer.from(data.buffer, y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", head),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
