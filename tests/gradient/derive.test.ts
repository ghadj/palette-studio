import { describe, expect, it } from "vitest";
import { inGamut } from "../../src/color/gamut";
import { derivedStops, deriveStops } from "../../src/gradient/derive";
import { resolveStops } from "../../src/gradient/model";
import { DEFAULT_TECHNIQUE } from "../../src/state/defaults";
import type { Gradient, Oklch, Swatch } from "../../src/types";

const base: Oklch = { l: 0.6, c: 0.1, h: 30 };
const flat = { geometry: { reverse: false, mirror: false } } as Gradient;

function swatch(id: string, color: Oklch): Swatch {
  return { id, color, alpha: 1, point: null } as Swatch;
}

function colorsOf(kind: Parameters<typeof deriveStops>[0], color: Oklch = base): Oklch[] {
  const stops = deriveStops(kind, "a", color);
  return resolveStops(flat, stops, [swatch("a", color)]).map((r) => r.color);
}

describe("deriveStops (plan D17)", () => {
  it("analogous: H 0, 30, 60", () => {
    expect(colorsOf("analogous").map((c) => c.h)).toEqual([0, 30, 60]);
  });
  it("complementary: H 30, 210", () => {
    expect(colorsOf("complementary").map((c) => c.h)).toEqual([30, 210]);
  });
  it("monochrome: L 0.322, 0.466, 0.61, 0.754, 0.898 at H 30", () => {
    const colors = colorsOf("monochrome");
    expect(colors.map((c) => Number(c.l.toFixed(3)))).toEqual([0.322, 0.466, 0.61, 0.754, 0.898]);
    for (const c of colors) expect(c.h).toBe(30);
  });
  it("warm-cool: H 45, 30, 315", () => {
    const hs = colorsOf("warm-cool").map((c) => c.h);
    expect(hs[0]).toBeCloseTo(45, 9);
    expect(hs[1]).toBeCloseTo(30, 9);
    expect(hs[2]).toBeCloseTo(315, 9);
  });
  it("every color is in gamut", () => {
    // Offsets keep the base chroma; gamut handling for rich colors is the renderer's (D12).
    for (const kind of ["analogous", "complementary", "monochrome", "warm-cool"] as const) {
      for (const c of colorsOf(kind, { ...base, c: 0.04 })) {
        expect(inGamut(c), `${kind} ${JSON.stringify(c)}`).toBe(true);
      }
    }
  });
  it("positions are even and the stops are linked", () => {
    const stops = deriveStops("analogous", "a", base);
    expect(stops.map((s) => s.position)).toEqual([0, 0.5, 1]);
    expect(stops.every((s) => s.color.kind === "swatch" && s.color.id === "a")).toBe(true);
  });
  it("resolveStops follows an edit of the base swatch", () => {
    const stops = deriveStops("analogous", "a", base);
    const edited = resolveStops(flat, stops, [swatch("a", { l: 0.6, c: 0.1, h: 100 })]);
    expect(edited.map((r) => r.color.h)).toEqual([70, 100, 130]);
  });
});

describe("derivedStops (the seam)", () => {
  const palette = [swatch("a", base), swatch("b", { l: 0.5, c: 0.1, h: 200 })];
  it("uses technique.derive.from, or the first swatch when null or gone", () => {
    const t = { ...DEFAULT_TECHNIQUE, kind: "derived" as const };
    const ids = (from: string | null) =>
      derivedStops({ ...t, derive: { from, kind: "complementary" } }, palette).map((x) =>
        x.color.kind === "swatch" ? x.color.id : "",
      );
    expect(ids("b")).toEqual(["b", "b"]);
    expect(ids(null)).toEqual(["a", "a"]);
    expect(ids("zzz")).toEqual(["a", "a"]);
    expect(derivedStops(t, [])).toEqual([]);
  });
});
