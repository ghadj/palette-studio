import { describe, expect, it } from "vitest";
import {
  clampView,
  fitView,
  MAX_SCALE,
  MIN_SCALE,
  nextZoomStep,
  panBy,
  type View,
  zoomAt,
} from "../../src/image/viewport";

const WELL = { width: 400, height: 200 };

/** The image point (in unzoomed well pixels) that sits under a screen point. */
const imagePointUnder = (view: View, p: { x: number; y: number }) => ({
  x: (p.x - view.x) / view.scale,
  y: (p.y - view.y) / view.scale,
});

describe("viewport (spec 6 'Image view', decision 15c)", () => {
  it("zoomAt from scale 1 to 2 with the anchor at the center of a 400 × 200 well gives offset (−200, −100)", () => {
    const view = zoomAt(fitView(), 2, { x: 200, y: 100 }, WELL);
    expect(view).toEqual({ scale: 2, x: -200, y: -100 });
  });

  it("the anchor point stays under the pointer for any factor", () => {
    const anchors = [
      { x: 0, y: 0 },
      { x: 37, y: 150 },
      { x: 200, y: 100 },
      { x: 399, y: 12 },
      { x: 400, y: 200 },
    ];
    // Zooming in never needs the pan clamp, including when the scale clamps at 8.
    for (const start of [
      fitView(),
      { scale: 2, x: -120, y: -60 },
      { scale: 3.5, x: -900, y: -10 },
    ]) {
      for (const anchor of anchors) {
        for (const factor of [1, 1.01, 1.5, 2, 3.7, 8, 100]) {
          const before = imagePointUnder(start, anchor);
          const after = imagePointUnder(zoomAt(start, factor, anchor, WELL), anchor);
          expect(after.x).toBeCloseTo(before.x, 9);
          expect(after.y).toBeCloseTo(before.y, 9);
        }
      }
    }
    // Zooming out about the center of a centered view stays inside the clamp too.
    const centered: View = { scale: 8, x: -1400, y: -700 };
    const center = { x: 200, y: 100 };
    for (const factor of [0.9, 0.5, 0.25, 0.125]) {
      const after = imagePointUnder(zoomAt(centered, factor, center, WELL), center);
      expect(after.x).toBeCloseTo(200, 9);
      expect(after.y).toBeCloseTo(100, 9);
    }
  });

  it("scale clamps to 1 and 8", () => {
    expect(MIN_SCALE).toBe(1);
    expect(MAX_SCALE).toBe(8);
    expect(zoomAt(fitView(), 0.5, { x: 100, y: 50 }, WELL)).toEqual(fitView());
    expect(zoomAt(fitView(), 20, { x: 100, y: 50 }, WELL).scale).toBe(8);
    expect(zoomAt({ scale: 6, x: -100, y: -100 }, 2, { x: 0, y: 0 }, WELL).scale).toBe(8);
    expect(clampView({ scale: 0.2, x: 30, y: 30 }, WELL)).toEqual(fitView());
    expect(clampView({ scale: 12, x: 0, y: 0 }, WELL).scale).toBe(8);
  });

  it("at scale 2 in a 400 px wide well, x offset clamps to −400 to 0", () => {
    expect(clampView({ scale: 2, x: 50, y: 0 }, WELL).x).toBe(0);
    expect(clampView({ scale: 2, x: -500, y: 0 }, WELL).x).toBe(-400);
    expect(clampView({ scale: 2, x: -123, y: 0 }, WELL).x).toBe(-123);
    // y in a 200 px tall well: −200 to 0, so the image always covers the well.
    expect(clampView({ scale: 2, x: 0, y: -260 }, WELL).y).toBe(-200);
    expect(clampView({ scale: 2, x: 0, y: 10 }, WELL).y).toBe(0);
  });

  it("fit() (fitView) gives scale 1, offset 0", () => {
    expect(fitView()).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it("panBy at scale 1 doesn't move", () => {
    expect(panBy(fitView(), 40, -25, WELL)).toEqual(fitView());
    expect(panBy({ scale: 2, x: -100, y: -50 }, 30, -20, WELL)).toEqual({
      scale: 2,
      x: -70,
      y: -70,
    });
    expect(panBy({ scale: 2, x: -100, y: -50 }, 300, -300, WELL)).toEqual({
      scale: 2,
      x: 0,
      y: -200,
    });
  });

  it("the zoom buttons step through 100%, 200%, 400% and 800%", () => {
    expect(nextZoomStep(1, 1)).toBe(2);
    expect(nextZoomStep(2, 1)).toBe(4);
    expect(nextZoomStep(4, 1)).toBe(8);
    expect(nextZoomStep(8, 1)).toBe(8);
    expect(nextZoomStep(8, -1)).toBe(4);
    expect(nextZoomStep(1, -1)).toBe(1);
    // From a wheel zoom between steps, the next step in that direction.
    expect(nextZoomStep(1.5, 1)).toBe(2);
    expect(nextZoomStep(1.5, -1)).toBe(1);
    expect(nextZoomStep(3, -1)).toBe(2);
    expect(nextZoomStep(5.9, 1)).toBe(8);
  });
});
