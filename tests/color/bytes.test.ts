import { describe, expect, it } from "vitest";
import { bytesToOklch, hslIntsToOklch, oklchToBytes, oklchToHslInts } from "../../src/color/bytes";
import { hexToOklch, hexToRgb, hslToRgb, rgbToHsl } from "../../src/color/convert";

describe("hslToRgb", () => {
  it("matches reference colors", () => {
    expect(hslToRgb({ h: 0, s: 1, l: 0.5 })).toEqual({ r: 1, g: 0, b: 0 });
    const gray = hslToRgb({ h: 0, s: 0, l: 0.502 });
    expect(gray.r).toBeCloseTo(0.502, 12);
    expect(gray.g).toBeCloseTo(0.502, 12);
    const green = hslToRgb({ h: 120, s: 1, l: 0.5 });
    expect(green.r).toBeCloseTo(0, 12);
    expect(green.g).toBeCloseTo(1, 12);
    const blue = hslToRgb({ h: 240, s: 1, l: 0.5 });
    expect(blue.b).toBeCloseTo(1, 12);
    expect(blue.r).toBeCloseTo(0, 12);
    // hsl(210, 50%, 40%) is #336699.
    const steel = hslToRgb({ h: 210, s: 0.5, l: 0.4 });
    expect(steel.r * 255).toBeCloseTo(51, 9);
    expect(steel.g * 255).toBeCloseTo(102, 9);
    expect(steel.b * 255).toBeCloseTo(153, 9);
    expect(hslToRgb({ h: 360, s: 1, l: 0.5 }).r).toBeCloseTo(1, 12);
  });

  it("round-trips with rgbToHsl", () => {
    for (const hex of [
      "#FF0000",
      "#808080",
      "#14386B",
      "#1DB07A",
      "#5039B0",
      "#D1A9A9",
      "#000000",
    ]) {
      const rgb = hexToRgb(hex);
      const back = hslToRgb(rgbToHsl(rgb));
      expect(back.r, hex).toBeCloseTo(rgb.r, 9);
      expect(back.g, hex).toBeCloseTo(rgb.g, 9);
      expect(back.b, hex).toBeCloseTo(rgb.b, 9);
    }
  });

  it("#808080 is hsl(0, 0%, 50.2%)", () => {
    const hsl = rgbToHsl(hexToRgb("#808080"));
    expect(hsl.s).toBe(0);
    expect(hsl.l * 100).toBeCloseTo(50.2, 1);
  });
});

describe("whole-number views", () => {
  it("#FF0000 is rgb(255, 0, 0) and hsl(0, 100, 50)", () => {
    const red = hexToOklch("#FF0000");
    expect(oklchToBytes(red)).toEqual([255, 0, 0]);
    expect(oklchToHslInts(red)).toEqual([0, 100, 50]);
  });

  it("#14386B is hsl(215, 69, 25)", () => {
    expect(oklchToHslInts(hexToOklch("#14386B"))).toEqual([215, 69, 25]);
  });

  it("#808080 is hsl(0, 0, 50)", () => {
    expect(oklchToHslInts(hexToOklch("#808080"))).toEqual([0, 0, 50]);
  });

  it("whole-number HSL and bytes come back as the right colors", () => {
    expect(oklchToBytes(hslIntsToOklch([0, 100, 50]))).toEqual([255, 0, 0]);
    expect(oklchToBytes(hslIntsToOklch([120, 100, 50]))).toEqual([0, 255, 0]);
    expect(oklchToBytes(hslIntsToOklch([210, 50, 40]))).toEqual([51, 102, 153]);
    expect(oklchToBytes(bytesToOklch([20, 56, 107]))).toEqual([20, 56, 107]);
  });
});
