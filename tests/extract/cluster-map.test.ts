import { describe, expect, it } from "vitest";
import { hexToOklab } from "../../src/color/convert";
import {
  assignPixels,
  EDGE_INNER,
  EDGE_OUTER,
  FILTERED,
  OUTLINE_DARK,
  OUTLINE_LIGHT,
  OVERLAY_ALPHA,
  OVERLAY_GRAY,
  outlinedOverlayPixels,
  overlayPixels,
  regionBoundary,
} from "../../src/extract/cluster-map";
import { filterPixels } from "../../src/extract/filters";
import { DEFAULT_SETTINGS } from "../../src/state/defaults";
import type { WorkingSpace } from "../../src/types";
import { image, pixels, row } from "./helpers";

const SPACES: readonly WorkingSpace[] = ["oklab", "cielab", "linear-srgb", "srgb"];
const keepAll = (count: number) => new Uint8Array(count).fill(1);

describe("cluster map (spec 2.6; M2 decision 13a)", () => {
  it("a two-color image with palette [A, B] labels every pixel exactly", () => {
    // Left half #E8693A, right half #14386B.
    const img = image(10, 4, (x) => (x < 5 ? "#E8693A" : "#14386B"));
    for (const space of SPACES) {
      const map = assignPixels(
        img,
        keepAll(40),
        [hexToOklab("#E8693A"), hexToOklab("#14386B")],
        space,
      );
      expect(map.width).toBe(10);
      expect(map.height).toBe(4);
      expect(map.labels).toBeInstanceOf(Uint8Array);
      expect(map.labels).toHaveLength(40);
      for (let y = 0; y < 4; y += 1) {
        for (let x = 0; x < 10; x += 1) {
          expect(map.labels[y * 10 + x], `${space} (${x}, ${y})`).toBe(x < 5 ? 0 : 1);
        }
      }
      expect(map.shares).toEqual([0.5, 0.5]);
      // Swapping the palette order swaps the labels.
      const swapped = assignPixels(
        img,
        keepAll(40),
        [hexToOklab("#14386B"), hexToOklab("#E8693A")],
        space,
      );
      expect(swapped.labels[0]).toBe(1);
      expect(swapped.labels[9]).toBe(0);
    }
  });

  it("filtered pixels are 255", () => {
    // Two opaque pixels, two below the alpha cutoff, one too dark.
    const data = pixels([
      ["#E8693A", 1],
      ["#E8693A", 2, 0],
      ["#14386B", 1],
      ["#000000", 1],
    ]);
    const { mask } = filterPixels(data, {
      ...DEFAULT_SETTINGS,
      ignoreDark: { on: true, threshold: 0.2 },
    });
    const map = assignPixels(
      row(data),
      mask,
      [hexToOklab("#E8693A"), hexToOklab("#14386B")],
      "oklab",
    );
    expect(FILTERED).toBe(255);
    expect([...map.labels]).toEqual([0, 255, 255, 1, 255]);
    expect(map.shares).toEqual([0.5, 0.5]);
  });

  it("shares over kept pixels sum to 1 within 1e-9", () => {
    // A noisy image, a third of it masked out, against a six-color palette.
    let state = 7;
    const rand = () => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state / 2147483648;
    };
    const hexes = ["#E8693A", "#1DB07A", "#14386B", "#D4527F", "#1E8A2E", "#5039B0"];
    const data = new Uint8ClampedArray(97 * 31 * 4);
    for (let i = 0; i < data.length; i += 4) {
      data.set([rand() * 256, rand() * 256, rand() * 256, 255], i);
    }
    const mask = new Uint8Array(97 * 31).map((_, i) => (i % 3 === 0 ? 0 : 1));
    const kept = mask.reduce((n, m) => n + m, 0);
    for (const space of SPACES) {
      const map = assignPixels({ width: 97, height: 31, data }, mask, hexes.map(hexToOklab), space);
      expect(map.shares).toHaveLength(6);
      expect(Math.abs(map.shares.reduce((a, b) => a + b, 0) - 1)).toBeLessThan(1e-9);
      // Each share is that swatch's count of kept pixels over all kept pixels.
      for (const [i, share] of map.shares.entries()) {
        const count = map.labels.reduce((n, l) => n + (l === i ? 1 : 0), 0);
        expect(share).toBeCloseTo(count / kept, 12);
      }
      expect(map.labels.filter((l) => l === 255)).toHaveLength(97 * 31 - kept);
    }
    // No kept pixels: every share is 0 and every label is 255.
    const none = assignPixels(
      { width: 97, height: 31, data },
      new Uint8Array(97 * 31),
      hexes.map(hexToOklab),
      "oklab",
    );
    expect(none.shares).toEqual([0, 0, 0, 0, 0, 0]);
    expect(none.labels.every((l) => l === 255)).toBe(true);
  });

  it("uses the working space of the settings", () => {
    // #707070 against [black, white]: OKLab L is about 0.55, so it is nearer white in OKLab; in
    // sRGB (0.44), linear sRGB (0.16) and CIELAB (L* 47) it is nearer black.
    const img = row(pixels([["#707070", 1]]));
    const palette = [hexToOklab("#000000"), hexToOklab("#FFFFFF")];
    const label = (space: WorkingSpace) => assignPixels(img, keepAll(1), palette, space).labels[0];
    expect(label("oklab")).toBe(1);
    expect(label("srgb")).toBe(0);
    expect(label("linear-srgb")).toBe(0);
    expect(label("cielab")).toBe(0);
  });
});

describe("cluster map overlay pixels (spec 2.6; M2 decision 13b)", () => {
  it("the swatch's pixels are clear and every other pixel is neutral mid-gray at 70%", () => {
    const labels = Uint8Array.from([0, 1, 2, FILTERED, 1]);
    const rgba = overlayPixels(labels, 1);
    expect(rgba).toBeInstanceOf(Uint8ClampedArray);
    expect(rgba).toHaveLength(20);
    const dim = [OVERLAY_GRAY, OVERLAY_GRAY, OVERLAY_GRAY, OVERLAY_ALPHA];
    expect([...rgba]).toEqual([...dim, 0, 0, 0, 0, ...dim, ...dim, 0, 0, 0, 0]);
    // Neutral mid-gray at about 70%, the same in both themes.
    expect(OVERLAY_GRAY).toBe(128);
    expect(OVERLAY_ALPHA / 255).toBeCloseTo(0.7, 2);
  });

  it("filtered pixels are always dimmed, and an index with no pixels dims everything", () => {
    const labels = Uint8Array.from([FILTERED, FILTERED]);
    const alphas = [...overlayPixels(labels, 0)].filter((_, i) => i % 4 === 3);
    expect(alphas).toEqual([OVERLAY_ALPHA, OVERLAY_ALPHA]);
  });
});

describe("cluster map outline (spec 2.6; M3 decision 61)", () => {
  // 5 x 4; swatch 1 is the 3 x 2 block at columns 1 to 3, rows 1 to 2.
  const labels = Uint8Array.from([0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0]);
  const at = (x: number, y: number) => y * 5 + x;

  it("marks region pixels that touch the outside as inner and outside pixels that touch it as outer", () => {
    const edges = regionBoundary(labels, 5, 4, 1);
    // Every region pixel of a 3 x 2 block is on its boundary.
    for (const [x, y] of [
      [1, 1],
      [2, 1],
      [3, 1],
      [1, 2],
      [2, 2],
      [3, 2],
    ] as const) {
      expect(edges[at(x, y)], `inner ${x},${y}`).toBe(EDGE_INNER);
    }
    // The ring around it, by 4-neighbours: corners (0,0) and (4,0) don't touch it.
    expect(edges[at(1, 0)]).toBe(EDGE_OUTER);
    expect(edges[at(0, 1)]).toBe(EDGE_OUTER);
    expect(edges[at(4, 2)]).toBe(EDGE_OUTER);
    expect(edges[at(2, 3)]).toBe(EDGE_OUTER);
    expect(edges[at(0, 0)]).toBe(0);
    expect(edges[at(4, 3)]).toBe(0);
  });

  it("leaves the interior of a larger region unmarked, and the map's border is not an edge", () => {
    const big = new Uint8Array(25).fill(1);
    expect([...regionBoundary(big, 5, 5, 1)].every((v) => v === 0)).toBe(true);
    const inner = regionBoundary(
      big.map((_, i) => (i === 12 ? 0 : 1)),
      5,
      5,
      1,
    );
    expect(inner[12]).toBe(EDGE_OUTER);
    expect(inner[7]).toBe(EDGE_INNER);
    expect(inner[0]).toBe(0);
    // Filtered pixels count as outside.
    const f = regionBoundary(Uint8Array.from([1, FILTERED]), 2, 1, 1);
    expect([...f]).toEqual([EDGE_INNER, EDGE_OUTER]);
  });

  it("draws a light line outside and a dark line inside; interior and far outside differ from both", () => {
    const wide = Uint8Array.from([
      0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0,
      0, 0, 0, 0,
    ]);
    const rgba = outlinedOverlayPixels(wide, 7, 5, 1);
    const px = (x: number, y: number) => [...rgba.slice((y * 7 + x) * 4, (y * 7 + x) * 4 + 4)];
    expect(px(3, 2), "interior stays clear").toEqual([0, 0, 0, 0]);
    expect(px(0, 0), "far outside stays dimmed").toEqual([
      OVERLAY_GRAY,
      OVERLAY_GRAY,
      OVERLAY_GRAY,
      OVERLAY_ALPHA,
    ]);
    expect(px(3, 1), "inner line").toEqual([...OUTLINE_DARK]);
    expect(px(3, 0), "outer line").toEqual([...OUTLINE_LIGHT]);
    expect(px(3, 1)).not.toEqual(px(3, 2));
    expect(px(3, 0)).not.toEqual(px(0, 0));
    // The dimming alone is unchanged.
    expect([...overlayPixels(wide, 1)].slice(0, 4)).toEqual([...px(0, 0)]);
  });
});
