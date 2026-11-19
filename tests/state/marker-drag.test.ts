import { describe, expect, it } from "vitest";
import { hexToOklab, oklchToHex } from "../../src/color/convert";
import { createSwatch } from "../../src/palette/model";
import {
  MarkerDrag,
  MOVE_LABEL,
  nudgePoint,
  pointerToPoint,
  type Sampled,
} from "../../src/state/marker-drag";
import type { ImagePoint, Swatch } from "../../src/types";

const START: ImagePoint = { x: 0.77, y: 0.17 };

function setup() {
  const a = createSwatch(hexToOklab("#14386B"), { point: START });
  const b = createSwatch(hexToOklab("#FF0000"), { point: { x: 0.1, y: 0.1 } });
  let palette: Swatch[] = [a, b];
  const initial = palette;
  const frames: Array<() => void> = [];
  const requests: Array<{
    point: ImagePoint;
    resolve: (hex: string) => void;
    reject: () => void;
  }> = [];
  const log: string[] = [];
  const drag = new MarkerDrag<string>({
    frame: (cb) => frames.push(cb),
    cancelFrame: () => {
      frames.length = 0;
    },
    sample: (point) =>
      new Promise<Sampled<string>>((resolve, reject) => {
        requests.push({
          point,
          resolve: (hex) => resolve({ color: hexToOklab(hex), crop: hex }),
          reject: () => reject(new Error("fail")),
        });
      }),
    getPalette: () => palette,
    setPalette: (next) => {
      palette = next;
    },
    begin: () => log.push("begin"),
    end: (label) => log.push(`end:${label ?? ""}`),
  });
  const runFrame = () => {
    const cb = frames.shift();
    cb?.();
  };
  const flush = () => new Promise((r) => setTimeout(r, 0));
  return {
    a,
    initial,
    drag,
    log,
    frames,
    requests,
    runFrame,
    flush,
    get palette() {
      return palette;
    },
  };
}

describe("MarkerDrag (spec 3.7)", () => {
  it("a move updates at most once per frame", async () => {
    const t = setup();
    expect(t.drag.start(t.a.id)).toBe(true);
    t.drag.move({ x: 0.5, y: 0.5 });
    t.drag.move({ x: 0.6, y: 0.6 });
    t.drag.move({ x: 0.7, y: 0.7 });
    expect(t.frames).toHaveLength(1);
    expect(t.palette[0]?.point).toEqual(START);
    t.runFrame();
    expect(t.palette[0]?.point).toEqual({ x: 0.7, y: 0.7 });
    expect(t.requests).toHaveLength(1);
    expect(t.requests[0]?.point).toEqual({ x: 0.7, y: 0.7 });
    // A reply, then a move in the next frame, asks again.
    t.requests[0]?.resolve("#1E8A2E");
    await t.flush();
    expect(oklchToHex((t.palette[0] as Swatch).color)).toBe("#1E8A2E");
    t.drag.move({ x: 0.8, y: 0.8 });
    t.runFrame();
    expect(t.requests).toHaveLength(2);
  });

  it("one sample is out at a time; a move meanwhile is sampled after the reply", async () => {
    const t = setup();
    t.drag.start(t.a.id);
    t.drag.move({ x: 0.5, y: 0.5 });
    t.runFrame();
    t.drag.move({ x: 0.6, y: 0.6 });
    t.runFrame();
    expect(t.requests).toHaveLength(1);
    t.requests[0]?.resolve("#112233");
    await t.flush();
    expect(t.requests).toHaveLength(2);
    expect(t.requests[1]?.point).toEqual({ x: 0.6, y: 0.6 });
  });

  it("cancel restores color and point, and records no step", async () => {
    const t = setup();
    t.drag.start(t.a.id);
    t.drag.move({ x: 0.5, y: 0.5 });
    t.runFrame();
    t.requests[0]?.resolve("#1E8A2E");
    await t.flush();
    expect(t.palette[0]?.locked).toBe(true);
    t.drag.cancel();
    expect(t.palette).toBe(t.initial);
    expect(t.palette[0]?.locked).toBe(false);
    expect(t.log).toEqual(["begin", "end:"]);
    expect(t.drag.active).toBe(false);
    // A move after the cancel belongs to no drag.
    t.drag.move({ x: 0.9, y: 0.9 });
    expect(t.frames).toHaveLength(0);
  });

  it("release commits exactly one step, with the sample of the final point, picked and locked", async () => {
    const t = setup();
    t.drag.start(t.a.id);
    t.drag.move({ x: 0.5, y: 0.5 });
    t.runFrame();
    t.drag.move({ x: 0.889, y: 0.778 });
    const released = t.drag.release();
    // The sample of the first point is still out when the final one is needed.
    t.requests[0]?.resolve("#111111");
    await t.flush();
    expect(t.requests).toHaveLength(2);
    expect(t.requests[1]?.point).toEqual({ x: 0.889, y: 0.778 });
    t.requests[1]?.resolve("#1E8A2E");
    await released;
    const s = t.palette[0] as Swatch;
    expect(s.point).toEqual({ x: 0.889, y: 0.778 });
    expect(oklchToHex(s.color)).toBe("#1E8A2E");
    expect(s.origin).toBe("picked");
    expect(s.locked).toBe(true);
    expect(t.log).toEqual(["begin", `end:${MOVE_LABEL}`]);
    expect(t.palette[1]).toBe(t.initial[1]);
  });

  it("a failed sample puts everything back", async () => {
    const t = setup();
    t.drag.start(t.a.id);
    t.drag.move({ x: 0.5, y: 0.5 });
    const released = t.drag.release();
    t.requests[0]?.reject();
    await released;
    expect(t.palette).toBe(t.initial);
    expect(t.log).toEqual(["begin", "end:"]);
  });

  it("a swatch without a point can't be dragged", () => {
    const t = setup();
    expect(t.drag.start("nope")).toBe(false);
    expect(t.log).toEqual([]);
  });
});

describe("marker drag geometry", () => {
  const box = { left: 100, top: 50, width: 400, height: 200 };
  const fit = { x: 0, y: 0, scale: 1 };

  it("maps a pointer through the view, keeping the grab offset, and clamps to the image", () => {
    expect(pointerToPoint({ x: 300, y: 150 }, { x: 0, y: 0 }, box, fit)).toEqual({
      x: 0.5,
      y: 0.5,
    });
    expect(pointerToPoint({ x: 310, y: 150 }, { x: 10, y: 0 }, box, fit)).toEqual({
      x: 0.5,
      y: 0.5,
    });
    // At zoom 2 with the image shifted left and up by a whole well, the well middle is 0.75.
    expect(
      pointerToPoint({ x: 300, y: 150 }, { x: 0, y: 0 }, box, { x: -1, y: -1, scale: 2 }),
    ).toEqual({ x: 0.75, y: 0.75 });
    expect(pointerToPoint({ x: 0, y: 0 }, { x: 0, y: 0 }, box, fit)).toEqual({ x: 0, y: 0 });
  });

  it("nudges by master pixels and stays inside the image", () => {
    const master = { width: 1600, height: 800 };
    expect(nudgePoint({ x: 0.5, y: 0.5 }, 10, 0, master).x).toBeCloseTo(0.50625, 10);
    expect(nudgePoint({ x: 0.5, y: 0.5 }, 0, -1, master).y).toBeCloseTo(0.49875, 10);
    expect(nudgePoint({ x: 0.9999, y: 0 }, 10, -10, master)).toEqual({ x: 1, y: 0 });
  });
});
