import { describe, expect, it } from "vitest";
import { hexToOklab, hexToOklch, oklchToHex } from "../../src/color/convert";
import {
  addStop,
  detachRemoved,
  MAX_STOPS,
  MIN_STOPS,
  makeStop,
  moveStop,
  relinkStop,
  removeStop,
  resolveStops,
  setAlpha,
  setHint,
  setLocked,
  setStopColor,
  swatchStops,
} from "../../src/gradient/model";
import { buildStops } from "../../src/gradient/sources";
import { createSwatch } from "../../src/palette/model";
import { DEFAULT_GRADIENT } from "../../src/state/defaults";
import { buildMockupState } from "../../src/state/mockup";
import type { Gradient, GradientStop } from "../../src/types";

const value = (id: string, position: number, hex: string): GradientStop =>
  makeStop(position, { kind: "value", color: hexToOklch(hex), from: null }, { id });

const hexes = (list: readonly { color: Parameters<typeof oklchToHex>[0] }[]) =>
  list.map((s) => oklchToHex(s.color));

describe("gradient stops (spec 4.3; plan M4-T1)", () => {
  it("addStop at 0.25 between #000000@0 and #FFFFFF@1 inserts a value stop and keeps order", () => {
    const stops = [value("a", 0, "#000000"), value("b", 1, "#FFFFFF")];
    const next = addStop(stops, 0.25, hexToOklch("#404040"), { id: "new" });
    expect(next.map((s) => s.id)).toEqual(["a", "new", "b"]);
    expect(next[1]).toMatchObject({
      position: 0.25,
      alpha: 1,
      hint: 0.5,
      locked: false,
      color: { kind: "value", from: null },
    });
    // The other stops keep their identity.
    expect(next[0]).toBe(stops[0]);
    expect(next[2]).toBe(stops[1]);
  });

  it("removeStop refuses below 2; addStop refuses at 32", () => {
    const two = [value("a", 0, "#000000"), value("b", 1, "#FFFFFF")];
    expect(MIN_STOPS).toBe(2);
    expect(removeStop(two, "a")).toBe(two);
    const three = addStop(two, 0.5, hexToOklch("#808080"), { id: "m" });
    expect(removeStop(three, "m").map((s) => s.id)).toEqual(["a", "b"]);

    let many = two;
    for (let i = 0; i < MAX_STOPS - 2; i++)
      many = addStop(many, (i + 1) / 40, hexToOklch("#808080"));
    expect(many).toHaveLength(MAX_STOPS);
    expect(addStop(many, 0.99, hexToOklch("#808080"))).toBe(many);
  });

  it("moving the 50% stop to 0.95, past the 100% stop, re-sorts and keeps ids", () => {
    const stops = [value("a", 0, "#1DB07A"), value("b", 0.5, "#D4527F"), value("c", 1, "#5039B0")];
    // The bar clamps to 0 to 1, so "past the 100% stop" means onto the last one's side at 0.95 of a
    // list whose last stop sits at 0.9.
    const near = [
      stops[0] as GradientStop,
      stops[1] as GradientStop,
      { ...(stops[2] as GradientStop), position: 0.9 },
    ];
    const moved = moveStop(near, "b", 0.95);
    expect(moved.map((s) => s.id)).toEqual(["a", "c", "b"]);
    expect(moved.map((s) => s.position)).toEqual([0, 0.9, 0.95]);
    expect(moveStop(stops, "b", 2).map((s) => s.position)).toEqual([0, 1, 1]);
  });

  it("a locked stop doesn't move or go", () => {
    const stops = [value("a", 0, "#000000"), value("b", 0.5, "#808080"), value("c", 1, "#FFFFFF")];
    const locked = setLocked(stops, "b", true);
    expect(moveStop(locked, "b", 0.7)).toBe(locked);
    expect(removeStop(locked, "b")).toBe(locked);
  });

  it("setStopColor detaches with from = the swatch id; relinkStop restores the link", () => {
    const stops: GradientStop[] = [
      makeStop(0, { kind: "swatch", id: "s2" }, { id: "a" }),
      makeStop(1, { kind: "swatch", id: "s4" }, { id: "b" }),
    ];
    const typed = setStopColor(stops, "b", hexToOklch("#112233"));
    expect(typed[1]?.color).toMatchObject({ kind: "value", from: "s4" });
    // Typing again keeps the swatch it came from.
    const again = setStopColor(typed, "b", hexToOklch("#445566"));
    expect(again[1]?.color).toMatchObject({ kind: "value", from: "s4" });
    const back = relinkStop(typed, "b");
    expect(back[1]?.color).toEqual({ kind: "swatch", id: "s4" });
    // Relink is disabled when the swatch is gone, and for a stop that never had one.
    expect(relinkStop(typed, "b", () => false)).toBe(typed);
    expect(relinkStop(addStop(stops, 0.5, hexToOklch("#000000"), { id: "n" }), "n")).toHaveLength(
      3,
    );
  });

  it("alpha and midpoint are clamped", () => {
    const stops = [value("a", 0, "#000000"), value("b", 1, "#FFFFFF")];
    expect(setAlpha(stops, "a", 2)[0]?.alpha).toBe(1);
    expect(setAlpha(stops, "a", 0.4)[0]?.alpha).toBe(0.4);
    expect(setHint(stops, "a", 0.3)[0]?.hint).toBe(0.3);
    expect(setHint(stops, "a", 0)[0]?.hint).toBeGreaterThan(0);
  });

  it("detachRemoved turns a removed swatch's stops into value stops with its last output color", () => {
    const g: Gradient = {
      ...DEFAULT_GRADIENT,
      custom: true,
      stops: [
        makeStop(0, { kind: "swatch", id: "s2" }, { id: "a" }),
        makeStop(0.5, { kind: "swatch", id: "s4" }, { id: "b" }),
        makeStop(1, { kind: "swatch", id: "s6", derive: { hueShift: 180 } }, { id: "c" }),
      ],
    };
    const pink = hexToOklch("#D4527F");
    const violet = hexToOklch("#5039B0");
    const next = detachRemoved(
      g,
      ["s4", "s6"],
      new Map([
        ["s4", pink],
        ["s6", violet],
      ]),
    );
    expect(next.stops[0]).toBe(g.stops[0]);
    expect(next.stops[1]?.color).toEqual({ kind: "value", color: pink, from: "s4" });
    expect(next.stops[2]?.color).toMatchObject({ kind: "value", from: "s6" });
    // A derived stop keeps its offset color.
    const c = next.stops[2]?.color;
    expect(c?.kind === "value" ? c.color.h : null).toBeCloseTo((violet.h + 180) % 360, 6);
    expect(detachRemoved(g, ["zzz"], new Map())).toBe(g);
  });

  it("detachRemoved drops removed swatches from the Colors picks", () => {
    const g: Gradient = {
      ...DEFAULT_GRADIENT,
      technique: {
        ...DEFAULT_GRADIENT.technique,
        colors: { mode: "picked", count: 3, ids: ["a", "b"] },
      },
    };
    expect(detachRemoved(g, ["b"], new Map()).technique.colors.ids).toEqual(["a"]);
  });
});

describe("resolveStops (plan D21)", () => {
  const state = buildMockupState();
  const { gradient } = state.project;
  const palette = state.project.palette;
  const stops = buildStops(gradient.technique, palette);

  it("resolveStops of the fixture gives #1DB07A@0, #D4527F@0.5, #5039B0@1", () => {
    const resolved = resolveStops(gradient, stops, palette);
    expect(hexes(resolved)).toEqual(["#1DB07A", "#D4527F", "#5039B0"]);
    expect(resolved.map((s) => s.position)).toEqual([0, 0.5, 1]);
    expect(resolved.map((s) => s.link)).toEqual(["swatch", "swatch", "swatch"]);
  });

  it("reverse gives #5039B0@0, #D4527F@0.5, #1DB07A@1", () => {
    const g = { ...gradient, geometry: { ...gradient.geometry, reverse: true } };
    const resolved = resolveStops(g, stops, palette);
    expect(hexes(resolved)).toEqual(["#5039B0", "#D4527F", "#1DB07A"]);
    expect(resolved.map((s) => s.position)).toEqual([0, 0.5, 1]);
  });

  it("mirror gives #1DB07A@0, #D4527F@0.25, #5039B0@0.5, #D4527F@0.75, #1DB07A@1, with the hints mirrored", () => {
    const withHints = setHint(setHint(stops, stops[0]?.id ?? "", 0.3), stops[1]?.id ?? "", 0.7);
    const g = { ...gradient, geometry: { ...gradient.geometry, mirror: true } };
    const resolved = resolveStops(g, withHints, palette);
    expect(hexes(resolved)).toEqual(["#1DB07A", "#D4527F", "#5039B0", "#D4527F", "#1DB07A"]);
    expect(resolved.map((s) => s.position)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    // Segment 0 to 1 keeps 0.3 and 1 to 2 keeps 0.7; the mirrored segments run the other way.
    expect(resolved.map((s) => s.hint)).toEqual([0.3, 0.7, 1 - 0.7, 1 - 0.3, 0.5]);
  });

  it("reverse flips each segment's midpoint", () => {
    const withHints = setHint(stops, stops[0]?.id ?? "", 0.3);
    const g = { ...gradient, geometry: { ...gradient.geometry, reverse: true } };
    expect(resolveStops(g, withHints, palette).map((s) => s.hint)).toEqual([0.5, 0.7, 0.5]);
  });

  it("a stop whose swatch is missing is skipped; a swatch's alpha is the stop's", () => {
    const only = [createSwatch(hexToOklab("#FF0000"), { id: "x", alpha: 0.5 })];
    const list = swatchStops(only);
    expect(list).toHaveLength(2);
    expect(list.map((s) => s.alpha)).toEqual([0.5, 0.5]);
    expect(resolveStops(gradient, list, [])).toEqual([]);
  });
});
