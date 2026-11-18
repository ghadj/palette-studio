/**
 * A minimal, deterministic PNG encoder (8-bit RGB or RGBA) for generated sample images and test
 * fixtures. Dev tooling only; never shipped.
 */
import { crc32, deflateSync } from "node:zlib";

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, crc]);
}

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
};

/**
 * Encodes pixels (row-major, `channels` bytes per pixel) as PNG. Each row uses the filter with the
 * smallest sum of absolute values, the usual heuristic, so gradients compress well.
 */
export function encodePng(
  width: number,
  height: number,
  pixels: Uint8Array,
  channels: 3 | 4 = 4,
): Buffer {
  const stride = width * channels;
  if (pixels.length !== stride * height) throw new Error("pixel buffer has the wrong size");
  const out = Buffer.alloc((stride + 1) * height);
  const candidate = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    const prev = row - stride;
    let bestFilter = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    let best = Buffer.alloc(stride);
    for (let filter = 0; filter <= 4; filter += 1) {
      let score = 0;
      for (let i = 0; i < stride; i += 1) {
        const x = pixels[row + i] ?? 0;
        const a = i >= channels ? (pixels[row + i - channels] ?? 0) : 0;
        const b = y > 0 ? (pixels[prev + i] ?? 0) : 0;
        const c = y > 0 && i >= channels ? (pixels[prev + i - channels] ?? 0) : 0;
        let v = x;
        if (filter === 1) v = x - a;
        else if (filter === 2) v = x - b;
        else if (filter === 3) v = x - ((a + b) >> 1);
        else if (filter === 4) v = x - paeth(a, b, c);
        v &= 0xff;
        candidate[i] = v;
        score += v < 128 ? v : 256 - v;
      }
      if (score < bestScore) {
        bestScore = score;
        bestFilter = filter;
        best = Buffer.from(candidate);
      }
    }
    out[y * (stride + 1)] = bestFilter;
    best.copy(out, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = channels === 4 ? 6 : 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(out, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** A large single-color RGB PNG, encoded quickly (every row is identical and unfiltered). */
export function encodeSolidPng(width: number, height: number, rgb: [number, number, number]) {
  const row = Buffer.alloc(width * 3 + 1);
  for (let x = 0; x < width; x += 1) row.set(rgb, 1 + x * 3);
  const raw = Buffer.alloc(row.length * height);
  for (let y = 0; y < height; y += 1) row.copy(raw, y * row.length);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 1 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export const hexBytes = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
