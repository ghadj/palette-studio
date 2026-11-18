import { describe, expect, it } from "vitest";
import { oklabToHex } from "../../src/color/convert";
import { workingToOklab } from "../../src/color/working-space";
import { buildHistogram } from "../../src/extract/histogram";
import { medianCut } from "../../src/extract/median-cut";
import { wu } from "../../src/extract/wu";
import type { HistogramBits, WorkingSpace } from "../../src/types";
import { TWELVE_COLORS } from "../../tools/fixture-colors";
import { image, pixels } from "./helpers";

const hexes = (clusters: ReturnType<typeof wu>, space: WorkingSpace = "oklab") =>
  clusters.map((c) => oklabToHex(workingToOklab(space, c.color[0], c.color[1], c.color[2])));

describe("Wu quantizer (Wu 1992; spec 2.2, 7.6, 8)", () => {
  it("single color with N=6 gives one cluster with population 1", () => {
    const out = wu(buildHistogram(pixels([["#14386B", 64]])), 6);
    expect(out).toHaveLength(1);
    expect(out[0]?.population).toBe(1);
    expect(hexes(out)).toEqual(["#14386B"]);
  });

  it("two-color 75/25 with N=2 gives both exact colors at 0.75 and 0.25", () => {
    const out = wu(
      buildHistogram(
        pixels([
          ["#1DB07A", 75],
          ["#5039B0", 25],
        ]),
      ),
      2,
    );
    const byHex = new Map(hexes(out).map((h, i) => [h, out[i]?.population]));
    expect(byHex).toEqual(
      new Map([
        ["#1DB07A", 0.75],
        ["#5039B0", 0.25],
      ]),
    );
  });

  it("fully transparent gives an empty result without throwing (spec 8)", () => {
    expect(wu(buildHistogram(pixels([["#123456", 50, 0]])), 6)).toEqual([]);
  });

  it("the 12 TWELVE_COLORS pixels with N=12 give exactly those 12 hexes", () => {
    const h = buildHistogram(pixels(TWELVE_COLORS.map((hex) => [hex, 1] as [string, number])));
    const out = wu(h, 12);
    expect(new Set(hexes(out))).toEqual(new Set(TWELVE_COLORS));
    expect(out).toHaveLength(12);
  });

  it("N larger than the distinct colors returns at most the distinct count", () => {
    const h = buildHistogram(
      pixels([
        ["#E8693A", 4],
        ["#14386B", 3],
        ["#1DB07A", 2],
      ]),
    );
    const out = wu(h, 12);
    expect(out.length).toBeLessThanOrEqual(3);
    expect(new Set(hexes(out))).toEqual(new Set(["#E8693A", "#14386B", "#1DB07A"]));
  });

  it("same input twice gives identical output", () => {
    const img = image(64, 48, (x, y) => {
      const r = (x * 4).toString(16).padStart(2, "0");
      const g = (y * 5).toString(16).padStart(2, "0");
      const b = ((x + y) * 2).toString(16).padStart(2, "0");
      return `#${r}${g}${b}`;
    });
    const a = wu(buildHistogram(img.data), 8);
    const b = wu(buildHistogram(img.data), 8);
    expect(a).toEqual(b);
    expect(a).toHaveLength(8);
    expect(Math.abs(a.reduce((n, c) => n + c.population, 0) - 1)).toBeLessThan(1e-9);
  });

  it("works at 4, 5 and 6 bits", () => {
    const data = pixels([
      ["#1DB07A", 30],
      ["#5039B0", 20],
      ["#E8693A", 10],
    ]);
    for (const bits of [4, 5, 6] as HistogramBits[]) {
      for (const space of ["oklab", "cielab", "linear-srgb", "srgb"] as WorkingSpace[]) {
        const out = wu(buildHistogram(data, { bits, space }), 3);
        expect(new Set(hexes(out, space)), `${bits} bits, ${space}`).toEqual(
          new Set(["#1DB07A", "#5039B0", "#E8693A"]),
        );
        expect(out.map((c) => c.population).sort(), `${bits} bits`).toEqual([
          10 / 60,
          20 / 60,
          30 / 60,
        ]);
      }
    }
  });

  it("logs Wu next to median cut at 256 px and 6 colors on the generated 12 MP image (informational)", () => {
    // The e2e 12 MP gradient (4000 × 3000) at its 256 px analysis size, 256 × 192.
    const w = 256;
    const hgt = 192;
    const data = new Uint8ClampedArray(w * hgt * 4);
    for (let y = 0; y < hgt; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        data[i] = (x * 255) / w;
        data[i + 1] = (y * 255) / hgt;
        data[i + 2] = ((x + y) * 127) / (w + hgt);
        data[i + 3] = 255;
      }
    }
    const h = buildHistogram(data);
    const time = (fn: () => unknown) => {
      const start = performance.now();
      for (let i = 0; i < 5; i += 1) fn();
      return (performance.now() - start) / 5;
    };
    const wuMs = time(() => wu(h, 6));
    const mcMs = time(() => medianCut(h, 6));
    console.log(
      `[informational] 256 px, 6 colors: Wu ${wuMs.toFixed(2)} ms, median cut ${mcMs.toFixed(2)} ms (quantizer only, ${h.size} bins)`,
    );
    expect(wu(h, 6)).toHaveLength(6);
  });
});
