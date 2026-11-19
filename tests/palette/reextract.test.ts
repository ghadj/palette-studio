import { describe, expect, it } from "vitest";
import { createSwatch } from "../../src/palette/model";
import { mergeLocked } from "../../src/palette/reextract";

const sw = (l: number, init: Parameters<typeof createSwatch>[1] = {}) =>
  createSwatch({ l, a: 0, b: 0 }, init);
const ls = (list: ReturnType<typeof sw>[]) => list.map((s) => Math.round(s.color.l * 100));

describe("mergeLocked (spec 3.6; M3 decisions 2a to 2c)", () => {
  it("previous [A, B*, C] (B locked) and extracted [X, Y, Z] with Y nearest B give [X, B, Z]", () => {
    const [a, b, c] = [sw(0.2), sw(0.5, { locked: true }), sw(0.8)];
    const [x, y, z] = [sw(0.1), sw(0.52), sw(0.9)];
    const out = mergeLocked([a, b, c], [x, y, z], "ok");
    expect(out).toEqual([x, b, z]);
    expect(out[1]).toBe(b);
    expect(out).not.toContain(y);
  });

  it("with no locked swatch, the extracted list is returned", () => {
    const x = [sw(0.1), sw(0.9)];
    expect(mergeLocked([sw(0.5), sw(0.6)], x, "ok")).toEqual(x);
  });

  it("with one locked swatch, the total stays and it keeps its position or the last slot", () => {
    const b = sw(0.5, { locked: true });
    const out = mergeLocked([sw(0.2), sw(0.3), sw(0.4), b], [sw(0.1), sw(0.5), sw(0.9)], "ok");
    expect(out).toHaveLength(3);
    // Position 3 doesn't exist any more: it takes the last slot.
    expect(out[2]).toBe(b);
    expect(ls(out)).toEqual([10, 90, 50]);
  });

  it("with locked >= Colors, all locked are kept and none added", () => {
    const prev = [sw(0.2, { locked: true }), sw(0.5, { locked: true }), sw(0.8, { locked: true })];
    const out = mergeLocked(prev, [sw(0.1), sw(0.9)], "ok");
    expect(out).toHaveLength(3);
    expect(out.every((s, i) => s === prev[i])).toBe(true);
  });

  it("with all swatches locked and as many colors, nothing is replaced", () => {
    const prev = [sw(0.2, { locked: true }), sw(0.8, { locked: true })];
    const out = mergeLocked(prev, [sw(0.1), sw(0.9)], "ok");
    expect(out.every((s, i) => s === prev[i])).toBe(true);
  });

  it("locked keep id, point, origin and extracted", () => {
    const b = sw(0.5, {
      locked: true,
      origin: "picked",
      point: { x: 0.3, y: 0.4 },
      extracted: { color: { l: 0.4, c: 0, h: 0 }, point: { x: 0.9, y: 0.9 } },
    });
    const out = mergeLocked([sw(0.2), b], [sw(0.1), sw(0.5), sw(0.9)], "ok");
    const kept = out.find((s) => s.id === b.id);
    expect(kept).toBe(b);
    expect(kept?.point).toEqual({ x: 0.3, y: 0.4 });
    expect(kept?.origin).toBe("picked");
    expect(kept?.extracted?.point).toEqual({ x: 0.9, y: 0.9 });
  });

  it("unlocked manual swatches are replaced", () => {
    const manual = sw(0.5, { origin: "manual" });
    const out = mergeLocked([manual, sw(0.7, { locked: true })], [sw(0.1), sw(0.9)], "ok");
    expect(out).not.toContain(manual);
    expect(out).toHaveLength(2);
  });

  it("uses the given distance metric to choose which new color drops", () => {
    const b = sw(0.5, { locked: true });
    const out = mergeLocked([b], [sw(0.45), sw(0.9)], "ciede2000");
    expect(ls(out)).toEqual([50, 90]);
  });
});
