import { describe, expect, it } from "vitest";
import { hexToOklab, oklchToHex } from "../../src/color/convert";
import { createSwatch, MAX_SWATCHES } from "../../src/palette/model";
import { addPicked, pointFromWell, replaceWithPick } from "../../src/state/eyedropper";
import { LOUPE_SIZE, loupePosition } from "../../src/ui/Loupe";

const lab = hexToOklab("#D4527F");
const base = (n: number) =>
  Array.from({ length: n }, (_, i) => createSwatch(hexToOklab("#808080"), { id: `s${i}` }));

describe("pointFromWell (spec 3.7)", () => {
  it("maps a well position through the view to a normalized image point", () => {
    const view = { x: 0, y: 0, scale: 1 };
    expect(pointFromWell({ x: 200, y: 100 }, { width: 400, height: 200 }, view)).toEqual({
      x: 0.5,
      y: 0.5,
    });
  });

  it("follows zoom and pan", () => {
    const view = { x: -0.5, y: -0.25, scale: 2 };
    const p = pointFromWell({ x: 100, y: 100 }, { width: 200, height: 200 }, view);
    expect(p.x).toBeCloseTo(0.5, 9);
    expect(p.y).toBeCloseTo(0.375, 9);
  });

  it("clamps to the image", () => {
    const view = { x: 0, y: 0, scale: 1 };
    expect(pointFromWell({ x: -5, y: 500 }, { width: 100, height: 100 }, view)).toEqual({
      x: 0,
      y: 1,
    });
  });
});

describe("addPicked (decision D11)", () => {
  it("adds a picked, pinned swatch with the point at the end", () => {
    const point = { x: 0.38, y: 0.796 };
    const next = addPicked(base(6), lab, point);
    expect(next).toHaveLength(7);
    const added = next[6];
    expect(added && oklchToHex(added.color)).toBe("#D4527F");
    expect(added?.point).toEqual(point);
    expect(added?.origin).toBe("picked");
    expect(added?.pinned).toBe(true);
  });

  it("refuses at 12", () => {
    const list = base(MAX_SWATCHES);
    expect(addPicked(list, lab, { x: 0, y: 0 })).toBe(list);
  });
});

describe("replaceWithPick (decision D11)", () => {
  it("sets color and point, picks and pins, and keeps what it can reset to", () => {
    const extracted = { color: { l: 0.5, c: 0.1, h: 10 }, point: { x: 0.1, y: 0.1 } };
    const list = base(3).map((s, i) => (i === 1 ? { ...s, extracted } : s));
    const point = { x: 0.102, y: 0.185 };
    const next = replaceWithPick(list, "s1", lab, point);
    const swatch = next[1];
    expect(swatch && oklchToHex(swatch.color)).toBe("#D4527F");
    expect(swatch?.point).toEqual(point);
    expect(swatch?.origin).toBe("picked");
    expect(swatch?.pinned).toBe(true);
    expect(swatch?.extracted).toBe(extracted);
    expect(next[0]).toBe(list[0]);
    expect(next[2]).toBe(list[2]);
  });

  it("returns the list unchanged for an unknown id", () => {
    const list = base(2);
    expect(replaceWithPick(list, "nope", lab, { x: 0, y: 0 })).toBe(list);
  });
});

describe("loupePosition in a short well (spec 3.7, phones)", () => {
  it("goes beside the finger when there is room neither above nor below", () => {
    const well = { width: 390, height: 195 };
    const left = loupePosition({ x: 100, y: 155 }, well, true);
    expect(left.left).toBeGreaterThan(100);
    const right = loupePosition({ x: 300, y: 155 }, well, true);
    expect(right.left + LOUPE_SIZE).toBeLessThan(300);
  });
});
