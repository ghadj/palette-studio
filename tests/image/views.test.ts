/**
 * The Palette and Values image views (spec 3.8, plan M3-T11, D18, D19). Reference values come from
 * `docs/design/mockup-state.md` ("Expected image views") and from spec 3.8's band middles.
 */
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hexToOklab, hexToRgb, oklabToHex } from "../../src/color/convert";
import type { AnalysisImage } from "../../src/extract/pipeline";
import { type DrawnView, paletteView, valuesView, viewKey } from "../../src/image/views";
import { TWO_COLOR } from "../../tools/fixture-colors";
import { image } from "../extract/helpers";
import { readPng } from "./decode-png";

const root = resolve(import.meta.dirname, "../..");

/** The hex of each opaque pixel of a drawn view, with how many pixels have it. */
function histogram(view: DrawnView): Map<string, number> {
  const counts = new Map<string, number>();
  for (let o = 0; o < view.data.length; o += 4) {
    if (view.data[o + 3] !== 255) continue;
    const hex = `#${[0, 1, 2]
      .map((k) => (view.data[o + k] ?? 0).toString(16).padStart(2, "0"))
      .join("")}`.toUpperCase();
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  return counts;
}

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

/** Every 8-bit sRGB gray, each as a column 4 px tall: the full OKLab L range, 0 to 1. */
const grayRamp = (): AnalysisImage =>
  image(256, 4, (x) => `#${x.toString(16).padStart(2, "0").repeat(3)}`);

const MOCKUP = ["#E8693A", "#1DB07A", "#14386B", "#D4527F", "#1E8A2E", "#5039B0"];

describe("Palette view (spec 3.8)", () => {
  it("on a two-color image with palette [A, B], every pixel is A or B and shares sum to 1 within 1e-9", () => {
    const img = readPng(resolve(root, "tests/fixtures/two-color.png"));
    const view = paletteView(
      img,
      [hexToOklab(TWO_COLOR.major), hexToOklab(TWO_COLOR.minor)],
      false,
    );
    expect(view.width).toBe(img.width);
    expect(view.height).toBe(img.height);
    expect(view.data.length).toBe(img.width * img.height * 4);
    const counts = histogram(view);
    expect([...counts.keys()].sort()).toEqual([TWO_COLOR.major, TWO_COLOR.minor].sort());
    expect(sum([...counts.values()])).toBe(img.width * img.height);
    expect(Math.abs(sum(view.shares) - 1)).toBeLessThan(1e-9);
    // two-color.png is 75% major, 25% minor (tools/make-fixtures.ts).
    expect(view.shares[0]).toBeCloseTo(0.75, 9);
    expect(view.shares[1]).toBeCloseTo(0.25, 9);
    expect(view.bandShares).toEqual([]);
  });

  it("each pixel takes its nearest palette color in OKLab, ties to the lower index", () => {
    const img = image(3, 1, (x) => ["#FF0000", "#808080", "#0000FF"][x] ?? "#000000");
    const view = paletteView(img, [hexToOklab("#E8693A"), hexToOklab("#14386B")], false);
    expect(hexOf(view, 0)).toBe("#E8693A");
    expect(hexOf(view, 2)).toBe("#14386B");
    // A duplicate color: every pixel goes to the first of the two.
    const twins = paletteView(img, [hexToOklab("#808080"), hexToOklab("#808080")], false);
    expect(twins.shares).toEqual([1, 0]);
  });

  it("shares count only opaque pixels, and transparent pixels stay transparent", () => {
    const img = image(4, 1, (x) =>
      x === 0 ? ["#FF0000", 0] : x === 1 ? ["#FF0000", 100] : "#0000FF",
    );
    const view = paletteView(img, [hexToOklab("#FF0000"), hexToOklab("#0000FF")], false);
    expect(view.shares).toEqual([0, 1]);
    expect([...view.data.subarray(0, 8)]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(view.data[11]).toBe(255);
  });

  it("with dither on, every pixel is still a palette color", () => {
    // A smooth two-axis gradient, so the error diffusion has something to spread.
    const img = image(64, 48, (x, y) => {
      const r = Math.round((x / 63) * 255);
      const g = Math.round((y / 47) * 255);
      return `#${[r, g, 128].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    });
    const palette = ["#E8693A", "#1DB07A", "#14386B", "#FFFFFF"];
    const view = paletteView(img, palette.map(hexToOklab), true);
    const counts = histogram(view);
    for (const hex of counts.keys()) expect(palette).toContain(hex);
    expect(sum([...counts.values()])).toBe(64 * 48);
    expect(Math.abs(sum(view.shares) - 1)).toBeLessThan(1e-9);
  });

  it("a 50% gray area over a [black, white] palette dithers to 50% ± 2% black", () => {
    // 50% gray in OKLab lightness (L 0.5), where the error diffusion runs (plan D18).
    const gray = oklabToHex({ l: 0.5, a: 0, b: 0 });
    const img = image(64, 64, () => gray);
    const flat = paletteView(img, [hexToOklab("#000000"), hexToOklab("#FFFFFF")], false);
    expect(flat.shares).toEqual([1, 0]);
    const view = paletteView(img, [hexToOklab("#000000"), hexToOklab("#FFFFFF")], true);
    expect(view.shares[0]).toBeGreaterThan(0.48);
    expect(view.shares[0]).toBeLessThan(0.52);
    expect(Math.abs(sum(view.shares) - 1)).toBeLessThan(1e-9);
  });

  it("an empty palette draws nothing", () => {
    const view = paletteView(
      image(2, 2, () => "#808080"),
      [],
      false,
    );
    expect(view.shares).toEqual([]);
    expect(view.data.every((v) => v === 0)).toBe(true);
  });

  it("mockup-scene.png: shares 83.2% (swatch 2), 14.7% (swatch 1) and 0.5% each (3 to 6), ± 0.3 pp; band 5 is 96.8%", () => {
    const img = readPng(resolve(root, "public/samples/mockup-scene.png"));
    expect([img.width, img.height]).toEqual([1600, 800]);
    const view = paletteView(img, MOCKUP.map(hexToOklab), false);
    const expected = [0.147, 0.832, 0.005, 0.005, 0.005, 0.005];
    for (const [i, share] of expected.entries()) {
      expect(Math.abs((view.shares[i] ?? 0) - share)).toBeLessThanOrEqual(0.003);
    }
    expect(Math.abs(sum(view.shares) - 1)).toBeLessThan(1e-9);
    const counts = histogram(view);
    for (const hex of counts.keys()) expect(MOCKUP).toContain(hex);

    const values = valuesView(img, 5);
    expect(Math.abs((values.bandShares[4] ?? 0) - 0.968)).toBeLessThanOrEqual(0.003);
    expect(values.bandShares[0]).toBe(0);
  });
});

/** The hex of the pixel at (x, 0). */
function hexOf(view: DrawnView, x: number): string {
  const o = x * 4;
  const hex = [0, 1, 2].map((k) => (view.data[o + k] ?? 0).toString(16).padStart(2, "0"));
  return `#${hex.join("")}`.toUpperCase();
}

describe("Values view (spec 3.8)", () => {
  it("5 bands over a full L ramp give exactly #030303, #2E2E2E, #636363, #9E9E9E and #DEDEDE", () => {
    const view = valuesView(grayRamp(), 5);
    const counts = histogram(view);
    expect([...counts.keys()].sort()).toEqual([
      "#030303",
      "#2E2E2E",
      "#636363",
      "#9E9E9E",
      "#DEDEDE",
    ]);
    // The grays sit at the band middles, L 0.1, 0.3, 0.5, 0.7 and 0.9 (spec 3.8).
    for (const [i, hex] of ["#030303", "#2E2E2E", "#636363", "#9E9E9E", "#DEDEDE"].entries()) {
      expect(hexToOklab(hex).l).toBeCloseTo(0.1 + 0.2 * i, 2);
    }
    expect(view.bandShares).toHaveLength(5);
    expect(Math.abs(sum(view.bandShares) - 1)).toBeLessThan(1e-9);
    expect(view.shares).toEqual([]);
  });

  it("3 bands give grays at L 1/6, 1/2 and 5/6", () => {
    const view = valuesView(grayRamp(), 3);
    const expected = [1 / 6, 1 / 2, 5 / 6].map((l) => oklabToHex({ l, a: 0, b: 0 }));
    expect([...histogram(view).keys()].sort()).toEqual([...expected].sort());
    expect(view.bandShares).toHaveLength(3);
    expect(Math.abs(sum(view.bandShares) - 1)).toBeLessThan(1e-9);
  });

  it("a pixel falls in the band of its OKLab L; white goes in the top band", () => {
    // #14386B (L 0.345) is band 2 of 5; #FFFFFF (L 1) is band 5; #000000 (L 0) is band 1.
    const img = image(3, 1, (x) => ["#14386B", "#FFFFFF", "#000000"][x] ?? "#000000");
    const view = valuesView(img, 5);
    expect(hexOf(view, 0)).toBe("#2E2E2E");
    expect(hexOf(view, 1)).toBe("#DEDEDE");
    expect(hexOf(view, 2)).toBe("#030303");
    expect(view.bandShares).toEqual([1, 1, 0, 0, 1].map((n) => expect.closeTo(n / 3, 9)));
  });

  it("continuous keeps each pixel's OKLab L as a gray", () => {
    const img = image(4, 1, (x) => ["#E8693A", "#14386B", "#808080", "#FFFFFF"][x] ?? "#000000");
    const view = valuesView(img, "continuous");
    for (const [x, hex] of ["#E8693A", "#14386B", "#808080", "#FFFFFF"].entries()) {
      const gray = hexOf(view, x);
      const { r, g, b } = hexToRgb(gray);
      expect(r).toBe(g);
      expect(g).toBe(b);
      // Within one 8-bit step of the source's lightness.
      expect(Math.abs(hexToOklab(gray).l - hexToOklab(hex).l)).toBeLessThan(0.006);
    }
    expect(hexOf(view, 2)).toBe("#808080");
    expect(view.bandShares).toEqual([]);
  });

  it("transparent pixels stay transparent and don't count", () => {
    const img = image(2, 1, (x) => (x === 0 ? ["#FFFFFF", 0] : "#000000"));
    const view = valuesView(img, 5);
    expect(view.bandShares).toEqual([1, 0, 0, 0, 0]);
    expect(view.data[3]).toBe(0);
  });
});

describe("the user's alpha cutoff (spec 2.4; decision 30)", () => {
  // Left half alpha 100, right half alpha 200.
  const half = () => image(2, 1, (x) => ["#E8693A", x === 0 ? 100 : 200] as const);
  const colors = [hexToOklab("#E8693A")];

  it("the Palette view leaves out pixels below the cutoff", () => {
    const at128 = paletteView(half(), colors, false, 128);
    expect(at128.data[3]).toBe(0);
    expect(at128.data[7]).toBe(255);
    const at50 = paletteView(half(), colors, false, 50);
    expect(at50.data[3]).toBe(255);
    expect(at50.data[7]).toBe(255);
    const at250 = paletteView(half(), colors, false, 250);
    expect(at250.shares).toEqual([0]);
  });

  it("the Values view leaves out pixels below the cutoff, and band shares follow it", () => {
    expect(valuesView(half(), 5, 128).data[3]).toBe(0);
    expect(valuesView(half(), 5, 50).data[3]).toBe(255);
    expect(sum(valuesView(half(), 5, 50).bandShares)).toBeCloseTo(1, 9);
  });

  it("the cache key includes the cutoff", () => {
    expect(viewKey(1, "values", [], 5, false, 128)).not.toBe(
      viewKey(1, "values", [], 5, false, 64),
    );
    expect(viewKey(1, "palette", colors, 5, false, 128)).not.toBe(
      viewKey(1, "palette", colors, 5, false, 64),
    );
  });
});
