import { describe, expect, it } from "vitest";
import { hexToOklch } from "../../src/color/convert";
import { markerOrder, sampledStops, scanPoints } from "../../src/gradient/image-sample";
import { DEFAULT_TECHNIQUE } from "../../src/state/defaults";
import { MOCKUP_SWATCHES } from "../../src/state/mockup-fixture";
import type { Swatch } from "../../src/types";

const line = { a: { x: 0.05, y: 0.05 }, b: { x: 0.95, y: 0.95 } };
const near = (points: Array<{ x: number; y: number }>) =>
  points.map((p) => [Number(p.x.toFixed(6)), Number(p.y.toFixed(6))]);

const palette = MOCKUP_SWATCHES.map(
  ({ hex, point }, i) =>
    ({ id: `s${i + 1}`, color: hexToOklch(hex), alpha: 1, point }) as unknown as Swatch,
);

describe("scanPoints (plan D18)", () => {
  it("line (0.05, 0.05)→(0.95, 0.95), count 3 → (0.05, 0.05), (0.5, 0.5), (0.95, 0.95)", () => {
    expect(near(scanPoints("line", 3, line))).toEqual([
      [0.05, 0.05],
      [0.5, 0.5],
      [0.95, 0.95],
    ]);
  });
  it("horizontal, count 5 → x 0.05, 0.275, 0.5, 0.725, 0.95 at y 0.5; vertical likewise in y", () => {
    expect(near(scanPoints("horizontal", 5, line))).toEqual(
      [0.05, 0.275, 0.5, 0.725, 0.95].map((x) => [x, 0.5]),
    );
    expect(near(scanPoints("vertical", 5, line))).toEqual(
      [0.05, 0.275, 0.5, 0.725, 0.95].map((y) => [0.5, y]),
    );
  });
  it("radial and marker modes read no scan points", () => {
    expect(scanPoints("radial", 5, line)).toEqual([]);
    expect(scanPoints("markers-x", 5, line)).toEqual([]);
  });
});

describe("markerOrder", () => {
  const ids = (list: Swatch[]) => list.map((s) => Number(s.id.slice(1)));
  it("markers by x on the fixture: swatches 6, 1, 4, 2, 3, 5; by y: 3, 6, 2, 1, 5, 4", () => {
    expect(ids(markerOrder(palette, "x"))).toEqual([6, 1, 4, 2, 3, 5]);
    expect(ids(markerOrder(palette, "y"))).toEqual([3, 6, 2, 1, 5, 4]);
  });
  it("a swatch without a point is skipped (M3 decision 65)", () => {
    const edited = palette.map((s, i) => (i === 0 ? { ...s, point: null } : s));
    expect(ids(markerOrder(edited, "x"))).toEqual([6, 4, 2, 3, 5]);
  });
});

describe("sampledStops", () => {
  const technique = { ...DEFAULT_TECHNIQUE, kind: "image-sample" as const };
  it("marker modes give linked stops in marker order, evenly spread", () => {
    const stops = sampledStops(
      { ...technique, sample: { ...technique.sample, mode: "markers-x" } },
      palette,
    );
    expect(stops.map((s) => (s.color.kind === "swatch" ? s.color.id : ""))).toEqual([
      "s6",
      "s1",
      "s4",
      "s2",
      "s3",
      "s5",
    ]);
    expect(stops.map((s) => s.position)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });
  it("scan modes give fixed stops from the stored colors", () => {
    const colors = [hexToOklch("#FF0000"), hexToOklch("#0000FF"), hexToOklch("#00FF00")];
    const stops = sampledStops(
      { ...technique, sample: { ...technique.sample, mode: "line", colors } },
      palette,
    );
    expect(stops.map((s) => s.position)).toEqual([0, 0.5, 1]);
    expect(stops.every((s) => s.color.kind === "value")).toBe(true);
  });
  it("nothing sampled yet falls back to palette order", () => {
    const stops = sampledStops(
      { ...technique, sample: { ...technique.sample, mode: "line", colors: [] } },
      palette,
    );
    expect(stops).toHaveLength(6);
  });
});
