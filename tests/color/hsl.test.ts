import { hsl as toHsl } from "culori";
import { describe, expect, it } from "vitest";
import { hexToRgb, rgbToHsl } from "../../src/color/convert";

describe("sRGB to HSL (swatch roles, M2 decision 10a)", () => {
  it("matches culori on reference colors, with S and L in 0 to 1", () => {
    for (const hex of [
      "#FF0000",
      "#14386B",
      "#1DB07A",
      "#5039B0",
      "#A65959",
      "#D1A9A9",
      "#808080",
    ]) {
      const rgb = hexToRgb(hex);
      const ours = rgbToHsl(rgb);
      const ref = toHsl({ mode: "rgb", ...rgb });
      expect(ours.s, hex).toBeCloseTo(ref.s ?? 0, 9);
      expect(ours.l, hex).toBeCloseTo(ref.l ?? 0, 9);
    }
  });

  it("#14386B is S 87/127 (0.685), L 127/510 (0.249); grays have S 0", () => {
    // (20, 56, 107): S = (107 − 20) / (107 + 20), L = (107 + 20) / 510.
    const blue = rgbToHsl(hexToRgb("#14386B"));
    expect(blue.s).toBeCloseTo(87 / 127, 12);
    expect(blue.l).toBeCloseTo(127 / 510, 12);
    expect(rgbToHsl(hexToRgb("#808080"))).toMatchObject({ s: 0 });
    expect(rgbToHsl(hexToRgb("#FFFFFF"))).toMatchObject({ s: 0, l: 1 });
    expect(rgbToHsl(hexToRgb("#000000"))).toMatchObject({ s: 0, l: 0 });
  });

  it("clamps out-of-range channels before converting", () => {
    expect(rgbToHsl({ r: 1.2, g: -0.1, b: 0 })).toEqual(rgbToHsl({ r: 1, g: 0, b: 0 }));
  });
});
