import { describe, expect, it } from "vitest";
import { makeStop } from "../../src/gradient/model";
import {
  dragStop,
  hintFromPointer,
  positionFromPointer,
  toStoredPosition,
} from "../../src/gradient/stop-drag";

const color = { kind: "value", color: { l: 0.5, c: 0.1, h: 10 }, from: null } as const;
const stops = [
  makeStop(0, color, { id: "a" }),
  makeStop(0.5, color, { id: "b" }),
  makeStop(1, color, { id: "c" }),
];
const rect = { left: 100, width: 200 };

describe("stop drag (spec 4.3)", () => {
  it("clamps to 0 and 1", () => {
    expect(positionFromPointer(50, rect)).toBe(0);
    expect(positionFromPointer(400, rect)).toBe(1);
    expect(positionFromPointer(160, rect)).toBeCloseTo(0.3);
  });

  it("crossing re-sorts and keeps the dragged id", () => {
    const next = dragStop(stops, "a", 0.75);
    expect(next.map((s) => s.id)).toEqual(["b", "a", "c"]);
    expect(next[1]?.position).toBe(0.75);
  });

  it("the start position is restored on cancel", () => {
    const moved = dragStop(stops, "b", 0.2);
    expect(moved).not.toBe(stops);
    // Cancel drags back to the start position, from the start list, and gets the same list.
    expect(dragStop(stops, "b", 0.5)).toBe(stops);
  });

  it("maps a displayed position back through reverse and mirror", () => {
    expect(toStoredPosition(0.3, { reverse: false, mirror: false })).toBeCloseTo(0.3);
    expect(toStoredPosition(0.3, { reverse: true, mirror: false })).toBeCloseTo(0.7);
    expect(toStoredPosition(0.25, { reverse: false, mirror: true })).toBeCloseTo(0.5);
    expect(toStoredPosition(0.75, { reverse: false, mirror: true })).toBeCloseTo(0.5);
  });

  it("the midpoint is the pointer's place in the segment, kept inside 1 to 99%", () => {
    expect(hintFromPointer(0.3, 0.2, 0.6)).toBeCloseTo(0.25);
    expect(hintFromPointer(0, 0.2, 0.6)).toBe(0.01);
    expect(hintFromPointer(1, 0.2, 0.6)).toBe(0.99);
    expect(hintFromPointer(0.3, 0.3, 0.3)).toBe(0.5);
  });
});
