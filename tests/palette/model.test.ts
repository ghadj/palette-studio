import { describe, expect, it } from "vitest";
import { hexToOklab, hexToOklch, oklabToOklch } from "../../src/color/convert";
import {
  addSwatch,
  canAdd,
  createSwatch,
  deleteSwatch,
  duplicateSwatch,
  MAX_SWATCHES,
  moveSwatch,
  renameSwatch,
  resetToExtracted,
  selectedSwatch,
  setLocked,
  setSwatchColor,
  setSwatchPoint,
  swatchHex,
  swatchLabel,
  swatchOklab,
} from "../../src/palette/model";
import type { Swatch } from "../../src/types";

describe("palette model (spec 3.1)", () => {
  it("swatch from OKLab stores OKLCH and round-trips to the same hex", () => {
    for (const hex of [
      "#E8693A",
      "#1DB07A",
      "#14386B",
      "#D4527F",
      "#1E8A2E",
      "#5039B0",
      "#808080",
    ]) {
      const lab = hexToOklab(hex);
      const swatch = createSwatch(lab, { population: 0.25 });
      expect(swatch.color).toEqual(oklabToOklch(lab));
      expect(swatchHex(swatch)).toBe(hex);
      const back = swatchOklab(swatch);
      expect(back.l).toBeCloseTo(lab.l, 12);
      expect(back.a).toBeCloseTo(lab.a, 12);
      expect(back.b).toBeCloseTo(lab.b, 12);
      expect(swatch).toMatchObject({
        alpha: 1,
        name: "",
        locked: false,
        origin: "extracted",
        population: 0.25,
        point: null,
        sampleRadius: "auto",
        sampleStat: "mean",
        extracted: null,
      });
    }
  });

  it("gives unique ids and finds the selection", () => {
    const a = createSwatch(hexToOklab("#000000"));
    const b = createSwatch(hexToOklab("#FFFFFF"));
    expect(a.id).not.toBe(b.id);
    expect(selectedSwatch([a, b], b.id)).toBe(b);
    expect(selectedSwatch([a, b], null)).toBeNull();
    expect(selectedSwatch([a, b], "missing")).toBeNull();
    expect(swatchLabel([a, b], b.id)).toBe("Swatch 2");
    expect(swatchLabel([a, { ...b, name: "Sky" }], b.id)).toBe("Sky");
  });
});

const make = (hex: string, init: Partial<Omit<Swatch, "color">> = {}) =>
  createSwatch(hexToOklab(hex), init);

describe("palette operations (spec 3.2, 3.7; plan D12, Q4a)", () => {
  it("moveSwatch(0, 2) on [A, B, C] gives [B, C, A]", () => {
    const [a, b, c] = [make("#E8693A"), make("#1DB07A"), make("#14386B")];
    const list = [a, b, c];
    const moved = moveSwatch(list, 0, 2);
    expect(moved).toEqual([b, c, a]);
    expect(moved[0]).toBe(b);
    expect(list).toEqual([a, b, c]);
    expect(moveSwatch(list, 2, 0)).toEqual([c, a, b]);
    expect(moveSwatch(list, 1, 1)).toBe(list);
    expect(moveSwatch(list, 0, 5)).toBe(list);
  });

  it("duplicate inserts after the source with a new id, origin manual, unlocked, point null (D12)", () => {
    const source = make("#E8693A", {
      locked: true,
      origin: "picked",
      point: { x: 0.2, y: 0.5 },
      name: "Rust",
      population: 0.4,
    });
    const other = make("#1DB07A");
    const list = [source, other];
    const next = duplicateSwatch(list, source.id);
    expect(next).toHaveLength(3);
    expect(next[0]).toBe(source);
    expect(next[2]).toBe(other);
    const copy = next[1] as Swatch;
    expect(copy.id).not.toBe(source.id);
    expect(copy.color).toEqual(source.color);
    expect(copy).toMatchObject({
      origin: "manual",
      locked: false,
      point: null,
      extracted: null,
      name: "Rust",
    });
    expect(duplicateSwatch(list, "missing")).toBe(list);
  });

  it("add and duplicate refuse at 12 (Q4a)", () => {
    expect(MAX_SWATCHES).toBe(12);
    const eleven = Array.from({ length: 11 }, () => make("#808080"));
    expect(canAdd(eleven)).toBe(true);
    const twelve = addSwatch(eleven, make("#E8693A", { origin: "manual" }));
    expect(twelve).toHaveLength(12);
    expect(twelve[11]?.origin).toBe("manual");
    expect(canAdd(twelve)).toBe(false);
    expect(addSwatch(twelve, make("#1DB07A"))).toBe(twelve);
    expect(duplicateSwatch(twelve, twelve[0]?.id ?? "")).toBe(twelve);
  });

  it("delete keeps the other swatch objects' identity", () => {
    const [a, b, c] = [make("#E8693A"), make("#1DB07A"), make("#14386B")];
    const next = deleteSwatch([a, b, c], b.id);
    expect(next).toHaveLength(2);
    expect(next[0]).toBe(a);
    expect(next[1]).toBe(c);
  });

  it("lock, rename, color and point change only their swatch", () => {
    const [a, b] = [make("#E8693A"), make("#1DB07A")];
    const list = [a, b];
    const locked = setLocked(list, b.id, true);
    expect(locked[0]).toBe(a);
    expect(locked[1]?.locked).toBe(true);
    expect(renameSwatch(list, a.id, "Rust")[0]?.name).toBe("Rust");
    expect(setSwatchPoint(list, a.id, { x: 0.3, y: 0.4 })[0]?.point).toEqual({ x: 0.3, y: 0.4 });
    expect(setSwatchPoint(list, a.id, { x: 0.3, y: 0.4 })[1]).toBe(b);
  });

  it("resetToExtracted restores color and point, sets origin extracted and unlocks", () => {
    const extracted = { color: hexToOklch("#E8693A"), point: { x: 0.204, y: 0.519 } };
    const moved = make("#1DB07A", {
      origin: "picked",
      locked: true,
      point: { x: 0.5, y: 0.5 },
      extracted,
    });
    const other = make("#14386B");
    const next = resetToExtracted([moved, other], moved.id);
    expect(next[1]).toBe(other);
    expect(next[0]).toMatchObject({
      id: moved.id,
      color: extracted.color,
      point: extracted.point,
      origin: "extracted",
      locked: false,
      extracted,
    });
    // A swatch that was never extracted has nothing to go back to.
    const manual = make("#808080", { origin: "manual" });
    const list = [manual];
    expect(resetToExtracted(list, manual.id)).toBe(list);
  });

  it("setSwatchColor keeps `extracted`", () => {
    const extracted = { color: hexToOklch("#E8693A"), point: { x: 0.2, y: 0.5 } };
    const swatch = make("#E8693A", { extracted, point: extracted.point });
    const color = hexToOklch("#5039B0");
    const next = setSwatchColor([swatch], swatch.id, color);
    expect(next[0]?.color).toEqual(color);
    expect(next[0]?.extracted).toBe(extracted);
    expect(next[0]?.point).toBe(extracted.point);
  });
});
