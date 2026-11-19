/**
 * Patch sampling under a marker (spec 3.7, plan M3-T10 and D8): the mean in OKLab or the
 * per-channel median within the radius, and the loupe's 15 × 15 crop.
 */
import { describe, expect, it } from "vitest";
import { hexToOklab, oklabToHex } from "../../src/color/convert";
import { deltaEOK } from "../../src/color/delta-e";
import { autoRadius, CROP_SIZE, samplePatch } from "../../src/image/sample";
import type { MasterWindow } from "../../src/image/tiers";

/** A whole master of width × height as one window, with pixel (x, y) = fn(x, y) as RGBA. */
function master(
  width: number,
  height: number,
  fn: (x: number, y: number) => [number, number, number, number?],
): MasterWindow {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a = 255] = fn(x, y);
      data.set([r, g, b, a], (y * width + x) * 4);
    }
  }
  return {
    left: 0,
    top: 0,
    width,
    height,
    masterWidth: width,
    masterHeight: height,
    data: data.buffer,
  };
}

/** The part of a whole-master window from (left, top), `width` × `height`. */
function crop(whole: MasterWindow, left: number, top: number, width: number, height: number) {
  const src = new Uint8ClampedArray(whole.data);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const start = ((top + y) * whole.width + left) * 4;
    data.set(src.subarray(start, start + width * 4), y * width * 4);
  }
  return { ...whole, left, top, width, height, data: data.buffer };
}

const halves = () =>
  master(100, 100, (x) => (x < 50 ? [255, 0, 0] : [0, 0, 255]) as [number, number, number]);

/** The RGBA of crop pixel (cx, cy). */
const at = (data: Uint8ClampedArray, cx: number, cy: number) =>
  Array.from(data.subarray((cy * CROP_SIZE + cx) * 4, (cy * CROP_SIZE + cx) * 4 + 4));

describe("autoRadius (spec 3.7)", () => {
  it("Auto is 4 px on 1600 × 800 and 2 px on 300 × 200", () => {
    expect(autoRadius(1600, 800)).toBe(4);
    expect(autoRadius(300, 200)).toBe(2);
    expect(autoRadius(4096, 4096)).toBe(20);
  });
});

describe("samplePatch (spec 3.7, D8)", () => {
  it("on a half #FF0000, half #0000FF 100 × 100, the mean at (0.25, 0.5) with radius 3 is #FF0000", () => {
    const { color } = samplePatch(halves(), { x: 0.25, y: 0.5 }, 3, "mean");
    expect(oklabToHex(color)).toBe("#FF0000");
    expect(deltaEOK(color, hexToOklab("#FF0000"))).toBeLessThan(1e-9);
  });

  it("on the boundary, the mean mixes and the median returns one of the two", () => {
    const red = hexToOklab("#FF0000");
    const blue = hexToOklab("#0000FF");
    const point = { x: 0.5, y: 0.5 };
    const mean = samplePatch(halves(), point, 3, "mean").color;
    expect(deltaEOK(mean, red)).toBeGreaterThan(0.1);
    expect(deltaEOK(mean, blue)).toBeGreaterThan(0.1);
    // Pixel (50, 50) is blue; the radius-3 disc holds 11 red and 18 blue pixels, so the mean in
    // OKLab is 11/29 red plus 18/29 blue.
    expect(mean.l).toBeCloseTo((11 * red.l + 18 * blue.l) / 29, 9);
    expect(mean.a).toBeCloseTo((11 * red.a + 18 * blue.a) / 29, 9);
    expect(mean.b).toBeCloseTo((11 * red.b + 18 * blue.b) / 29, 9);
    const median = samplePatch(halves(), point, 3, "median").color;
    expect(oklabToHex(median)).toBe("#0000FF");
    expect(deltaEOK(median, blue)).toBeLessThan(1e-9);
  });

  it("the patch is the disc of the radius, cut at the image edges", () => {
    // One white pixel just outside the disc's corner, on black: it never counts.
    const img = master(20, 20, (x, y) => (x === 13 && y === 13 ? [255, 255, 255] : [0, 0, 0]));
    const { color } = samplePatch(img, { x: 10.5 / 20, y: 10.5 / 20 }, 3, "mean");
    expect(oklabToHex(color)).toBe("#000000");
    // At a corner, only the pixels inside the image count.
    const corner = master(20, 20, (x, y) => (x < 2 && y < 2 ? [255, 255, 255] : [0, 0, 0]));
    const c = samplePatch(corner, { x: 0, y: 0 }, 1, "mean").color;
    expect(oklabToHex(c)).toBe("#FFFFFF");
  });

  it("transparent pixels don't count while any pixel in the patch is visible", () => {
    const img = master(20, 20, (x) => (x < 10 ? [0, 0, 0, 0] : [0, 128, 0, 255]));
    const { color } = samplePatch(img, { x: 0.5, y: 0.5 }, 3, "mean");
    expect(oklabToHex(color)).toBe("#008000");
  });

  it("the crop is 15 × 15 and clamped at the corners", () => {
    const img = master(100, 100, (x, y) => [x, y, 7]);
    const center = samplePatch(img, { x: 0.5, y: 0.5 }, 3, "mean").crop;
    expect(center.length).toBe(CROP_SIZE * CROP_SIZE * 4);
    expect(at(center, 7, 7)).toEqual([50, 50, 7, 255]);
    expect(at(center, 0, 0)).toEqual([43, 43, 7, 255]);
    expect(at(center, 14, 14)).toEqual([57, 57, 7, 255]);

    // Top-left corner: the point stays at the crop's center, and outside pixels repeat the edge.
    const topLeft = samplePatch(img, { x: 0, y: 0 }, 3, "mean").crop;
    expect(topLeft.length).toBe(CROP_SIZE * CROP_SIZE * 4);
    expect(at(topLeft, 7, 7)).toEqual([0, 0, 7, 255]);
    expect(at(topLeft, 0, 0)).toEqual([0, 0, 7, 255]);
    expect(at(topLeft, 14, 3)).toEqual([7, 0, 7, 255]);
    // Bottom-right corner (x = y = 1 is the last pixel).
    const bottomRight = samplePatch(img, { x: 1, y: 1 }, 3, "mean").crop;
    expect(at(bottomRight, 7, 7)).toEqual([99, 99, 7, 255]);
    expect(at(bottomRight, 14, 14)).toEqual([99, 99, 7, 255]);
    expect(at(bottomRight, 0, 10)).toEqual([92, 99, 7, 255]);
  });

  it("a window of the master gives the same result as the whole master", () => {
    const img = master(200, 120, (x, y) => [(x * 3) % 256, (y * 5) % 256, (x + y) % 256]);
    const point = { x: 0.31, y: 0.62 };
    // The window readWindow would read: 32 px around the point's pixel (62, 74).
    const window = crop(img, 30, 42, 65, 65);
    for (const stat of ["mean", "median"] as const) {
      const whole = samplePatch(img, point, 5, stat);
      const part = samplePatch(window, point, 5, stat);
      expect(part.color).toEqual(whole.color);
      expect(Array.from(part.crop)).toEqual(Array.from(whole.crop));
    }
  });
});
