import { describe, expect, it } from "vitest";
import {
  hexToOklab,
  hexToOklch,
  hexToRgb,
  labToRgb,
  linearRgbToOklab,
  linearToSrgb,
  oklabToLinearRgb,
  oklabToOklch,
  oklabToRgb,
  oklabToXyz,
  oklchToHex,
  oklchToOklab,
  rgbToHex,
  rgbToLab,
  rgbToOklab,
  rgbToXyz,
  srgbToLinear,
  xyzToOklab,
} from "../../src/color/convert";

describe("color conversions (spec 2.3, 8)", () => {
  it("sRGB white maps to OKLab L = 1, a = b = 0 within 1e-6", () => {
    const white = rgbToOklab({ r: 1, g: 1, b: 1 });
    expect(Math.abs(white.l - 1)).toBeLessThan(1e-6);
    expect(Math.abs(white.a)).toBeLessThan(1e-6);
    expect(Math.abs(white.b)).toBeLessThan(1e-6);
  });

  it("sRGB to OKLab to sRGB round trip error below 1e-6 on a 17×17×17 grid", () => {
    let worst = 0;
    for (let i = 0; i <= 16; i += 1) {
      for (let j = 0; j <= 16; j += 1) {
        for (let k = 0; k <= 16; k += 1) {
          const rgb = { r: i / 16, g: j / 16, b: k / 16 };
          const back = oklabToRgb(rgbToOklab(rgb));
          worst = Math.max(
            worst,
            Math.abs(back.r - rgb.r),
            Math.abs(back.g - rgb.g),
            Math.abs(back.b - rgb.b),
          );
        }
      }
    }
    expect(worst).toBeLessThan(1e-6);
  });

  it("Ottosson's XYZ D65 pairs: (0.950, 1.000, 1.089) → (1.000, 0.000, 0.000); (1, 0, 0) → (0.450, 1.236, −0.019); (0, 1, 0) → (0.922, −0.671, 0.263); (0, 0, 1) → (0.153, −1.415, −0.449), to 3 decimals", () => {
    const pairs: Array<[[number, number, number], [number, number, number]]> = [
      [
        [0.95, 1.0, 1.089],
        [1.0, 0.0, 0.0],
      ],
      [
        [1, 0, 0],
        [0.45, 1.236, -0.019],
      ],
      [
        [0, 1, 0],
        [0.922, -0.671, 0.263],
      ],
      [
        [0, 0, 1],
        [0.153, -1.415, -0.449],
      ],
    ];
    for (const [[x, y, z], [l, a, b]] of pairs) {
      const lab = xyzToOklab({ x, y, z });
      expect(lab.l).toBeCloseTo(l, 3);
      expect(lab.a).toBeCloseTo(a, 3);
      expect(lab.b).toBeCloseTo(b, 3);
      const xyz = oklabToXyz(lab);
      expect(xyz.x).toBeCloseTo(x, 6);
      expect(xyz.y).toBeCloseTo(y, 6);
      expect(xyz.z).toBeCloseTo(z, 6);
    }
  });

  it("#FF0000 is oklch(0.628 0.2577 29.23) to 3 decimals", () => {
    const red = hexToOklch("#FF0000");
    expect(red.l).toBeCloseTo(0.628, 3);
    expect(red.c).toBeCloseTo(0.2577, 3);
    // The reference hue is given to 2 decimals.
    expect(red.h).toBeCloseTo(29.23, 2);
  });

  it("#FF0000 is CIELAB D65 (53.24, 80.09, 67.20) to 2 decimals", () => {
    const lab = rgbToLab(hexToRgb("#FF0000"));
    expect(lab.l).toBeCloseTo(53.24, 2);
    expect(lab.a).toBeCloseTo(80.09, 2);
    expect(lab.b).toBeCloseTo(67.2, 2);
    const back = labToRgb(lab);
    expect(back.r).toBeCloseTo(1, 6);
    expect(back.g).toBeCloseTo(0, 6);
    expect(back.b).toBeCloseTo(0, 6);
  });

  it("mockup swatches have the OKLab L in mockup-state.md: #E8693A 0.668, #1DB07A 0.672, #14386B 0.345, #D4527F 0.622, #1E8A2E 0.555, #5039B0 0.445 (±0.0005)", () => {
    const expected: Array<[string, number]> = [
      ["#E8693A", 0.668],
      ["#1DB07A", 0.672],
      ["#14386B", 0.345],
      ["#D4527F", 0.622],
      ["#1E8A2E", 0.555],
      ["#5039B0", 0.445],
    ];
    for (const [hex, l] of expected) {
      expect(Math.abs(hexToOklab(hex).l - l), hex).toBeLessThanOrEqual(0.0005);
    }
  });

  it("hex parsing and formatting are uppercase, clamped and round-trip", () => {
    expect(hexToRgb("#ff8000")).toEqual({ r: 1, g: 128 / 255, b: 0 });
    expect(hexToRgb("1db07a")).toEqual(hexToRgb("#1DB07A"));
    expect(hexToRgb("#abc")).toEqual(hexToRgb("#AABBCC"));
    expect(rgbToHex({ r: 1.2, g: -0.1, b: 0.5 })).toBe("#FF0080");
    expect(() => hexToRgb("#12345")).toThrow();
    expect(() => hexToRgb("zzzzzz")).toThrow();
    for (const hex of ["#E8693A", "#1DB07A", "#14386B", "#000000", "#FFFFFF"]) {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex);
    }
  });

  it("linear sRGB, OKLCH and XYZ helpers are consistent", () => {
    const rgb = { r: 0.2, g: 0.5, b: 0.8 };
    const lin = srgbToLinear(rgb);
    expect(lin.r).toBeCloseTo(0.0331048, 6);
    const back = linearToSrgb(lin);
    expect(back.r).toBeCloseTo(0.2, 9);
    const lab = linearRgbToOklab(lin);
    expect(rgbToOklab(rgb).l).toBeCloseTo(lab.l, 12);
    expect(oklabToLinearRgb(lab).g).toBeCloseTo(lin.g, 9);
    const lch = oklabToOklch(lab);
    const lab2 = oklchToOklab(lch);
    expect(lab2.a).toBeCloseTo(lab.a, 12);
    expect(lab2.b).toBeCloseTo(lab.b, 12);
    // Achromatic colors get hue 0, not NaN or undefined.
    expect(oklabToOklch({ l: 0.5, a: 0, b: 0 }).h).toBe(0);
    const xyz = rgbToXyz({ r: 1, g: 1, b: 1 });
    expect(xyz.y).toBeCloseTo(1, 6);
  });
});
