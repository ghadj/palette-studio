/**
 * Marker placement at extraction (spec 3.7, plan M3-T10): each swatch's marker goes on the densest
 * patch of its assigned pixels, after a box blur of about 3% of the shorter side.
 */
import { describe, expect, it } from "vitest";
import { hexToOklab } from "../../src/color/convert";
import { assignPixels, FILTERED } from "../../src/extract/assign";
import { blurRadius, placeMarkers } from "../../src/extract/markers";
import { keepPixels } from "../../src/extract/pipeline";
import { analysisSize } from "../../src/image/tiers";
import { DEFAULT_SETTINGS } from "../../src/state/defaults";
import type { ImagePoint } from "../../src/types";
import { image } from "./helpers";
import { areaResample, mockupScene } from "./markers-scene";

const GRAY = "#808080";
const RED = "#FF0000";

const inBox = (x: number, y: number, left: number, top: number, size: number) =>
  x >= left && x < left + size && y >= top && y < top + size;

/** Places markers for `hexes` with every pixel kept and labelled by its nearest color. */
function place(img: ReturnType<typeof image>, hexes: string[]): ImagePoint[] {
  const colors = hexes.map(hexToOklab);
  const keep = new Uint8Array(img.width * img.height).fill(1);
  const map = assignPixels(img, keep, colors, "oklab");
  return placeMarkers(map.labels, img.width, img.height, colors, img);
}

/** The analysis pixel a normalized point falls in. */
const pixelOf = (p: ImagePoint, w: number, h: number) => ({
  x: Math.floor(p.x * w),
  y: Math.floor(p.y * h),
});

describe("blurRadius (spec 3.7)", () => {
  it("is 3% of the shorter side, rounded, at least 1 px", () => {
    expect(blurRadius(64, 64)).toBe(2);
    expect(blurRadius(256, 128)).toBe(4);
    expect(blurRadius(10, 10)).toBe(1);
  });
});

describe("placeMarkers (spec 3.7)", () => {
  it("a 20 × 20 #FF0000 block plus 5 stray red pixels on #808080 (64 × 64) puts red at the block center ± 1 px", () => {
    const strays = new Set(["3,50", "10,60", "60,3", "55,55", "5,5"]);
    const img = image(64, 64, (x, y) =>
      inBox(x, y, 30, 10, 20) || strays.has(`${x},${y}`) ? RED : GRAY,
    );
    const [, red] = place(img, [GRAY, RED]);
    if (!red) throw new Error("no point");
    // The block spans 30 to 50 by 10 to 30 in pixel coordinates: its center is (40, 20).
    expect(Math.abs(red.x * 64 - 40)).toBeLessThanOrEqual(1);
    expect(Math.abs(red.y * 64 - 20)).toBeLessThanOrEqual(1);
  });

  it("ties follow ΔE, then y, then x", () => {
    // ΔE: two red blocks of the same size and density; the exact color wins over a near one,
    // even though the near one comes first in reading order.
    const near = "#FE0000";
    const byDeltaE = image(64, 64, (x, y) =>
      inBox(x, y, 4, 4, 8) ? near : inBox(x, y, 48, 48, 8) ? RED : GRAY,
    );
    const [, a] = place(byDeltaE, [GRAY, RED]);
    if (!a) throw new Error("no point");
    const pa = pixelOf(a, 64, 64);
    expect(inBox(pa.x, pa.y, 48, 48, 8)).toBe(true);

    // y before x: identical blocks top-right and bottom-left, equally far from their middle.
    const byY = image(64, 64, (x, y) =>
      inBox(x, y, 40, 4, 8) || inBox(x, y, 8, 40, 8) ? RED : GRAY,
    );
    const [, b] = place(byY, [GRAY, RED]);
    if (!b) throw new Error("no point");
    const pb = pixelOf(b, 64, 64);
    expect(inBox(pb.x, pb.y, 40, 4, 8)).toBe(true);

    // x last: identical blocks side by side on the same rows; the left one wins.
    const byX = image(64, 64, (x, y) =>
      inBox(x, y, 8, 20, 8) || inBox(x, y, 40, 20, 8) ? RED : GRAY,
    );
    const [, c] = place(byX, [GRAY, RED]);
    if (!c) throw new Error("no point");
    const pc = pixelOf(c, 64, 64);
    expect(inBox(pc.x, pc.y, 8, 20, 8)).toBe(true);
  });

  it("points lie in [0, 1]", () => {
    const hexes = ["#000000", "#FFFFFF", RED, "#00FF00", "#0000FF"];
    // Patches touching each edge and corner, and noise.
    const img = image(37, 23, (x, y) => {
      if (x < 3 && y < 3) return "#000000";
      if (x > 33 && y > 19) return "#FFFFFF";
      if (y === 0 && x > 20) return RED;
      if (x === 36 && y < 10) return "#00FF00";
      return hexes[(x * 7 + y * 13) % hexes.length] ?? GRAY;
    });
    const points = place(img, hexes);
    expect(points).toHaveLength(hexes.length);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
    // The corner patches keep their markers at their corners.
    const black = pixelOf(points[0] as ImagePoint, 37, 23);
    expect(black.x < 3 && black.y < 3).toBe(true);
  });

  it("mockup-scene.png at 256 px: all six points within 0.02 of the fixture points", () => {
    const fixture: Array<[string, number, number]> = [
      ["#E8693A", 0.204, 0.519],
      ["#1DB07A", 0.463, 0.241],
      ["#14386B", 0.769, 0.167],
      ["#D4527F", 0.38, 0.796],
      ["#1E8A2E", 0.889, 0.778],
      ["#5039B0", 0.102, 0.185],
    ];
    const full = mockupScene();
    const size = analysisSize(full.width, full.height, 256);
    const img = areaResample(full, size.width, size.height);
    const colors = fixture.map(([hex]) => hexToOklab(hex));
    const keep = keepPixels(img, DEFAULT_SETTINGS);
    const map = assignPixels(img, keep.mask, colors, DEFAULT_SETTINGS.workingSpace);
    const points = placeMarkers(map.labels, img.width, img.height, colors, img);
    expect(points).toHaveLength(6);
    for (const [i, [, x, y]] of fixture.entries()) {
      const p = points[i] as ImagePoint;
      expect(Math.abs(p.x - x), `swatch ${i + 1} x`).toBeLessThanOrEqual(0.02);
      expect(Math.abs(p.y - y), `swatch ${i + 1} y`).toBeLessThanOrEqual(0.02);
    }
  });

  it("a swatch with no pixels gets its closest pixel", () => {
    const GREEN = "#00FF00";
    const greenest = { x: 50, y: 41 };
    const img = image(64, 64, (x, y) => {
      if (x === greenest.x && y === greenest.y) return "#40A040";
      if (x === 12 && y === 12) return "#607060";
      return inBox(x, y, 20, 20, 10) ? RED : GRAY;
    });
    const colors = [GRAY, RED, GREEN].map(hexToOklab);
    // Labels by hand: no pixel belongs to green, and one pixel is filtered.
    const labels = new Uint8Array(64 * 64);
    for (let y = 0; y < 64; y += 1) {
      for (let x = 0; x < 64; x += 1) labels[y * 64 + x] = inBox(x, y, 20, 20, 10) ? 1 : 0;
    }
    labels[0] = FILTERED;
    const points = placeMarkers(labels, 64, 64, colors, img);
    const green = points[2] as ImagePoint;
    expect(pixelOf(green, 64, 64)).toEqual(greenest);
    // The point is the pixel's center.
    expect(green.x).toBeCloseTo((greenest.x + 0.5) / 64, 12);
    expect(green.y).toBeCloseTo((greenest.y + 0.5) / 64, 12);
  });

  it("a filtered-out image still gives every swatch a point", () => {
    const img = image(8, 8, () => GRAY);
    const labels = new Uint8Array(64).fill(FILTERED);
    const points = placeMarkers(labels, 8, 8, [GRAY, RED].map(hexToOklab), img);
    expect(points).toEqual([
      { x: 0.5 / 8, y: 0.5 / 8 },
      { x: 0.5 / 8, y: 0.5 / 8 },
    ]);
  });
});
