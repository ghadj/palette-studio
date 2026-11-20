import { describe, expect, it } from "vitest";
import { hexToOklch, oklabToRgb, oklchToOklab } from "../../src/color/convert";
import { clampChroma, inGamut } from "../../src/color/gamut";

const channels = (c: { l: number; c: number; h: number }) => {
  const rgb = oklabToRgb(oklchToOklab(c));
  return [rgb.r, rgb.g, rgb.b];
};

describe("sRGB gamut (spec 3.5, 7.9; plan D3)", () => {
  it("#E8693A is in gamut", () => {
    expect(inGamut(hexToOklch("#E8693A"))).toBe(true);
    for (const hex of ["#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF", "#14386B"]) {
      expect(inGamut(hexToOklch(hex))).toBe(true);
    }
  });

  it("oklch(0.7 0.3 150) is not", () => {
    expect(inGamut({ l: 0.7, c: 0.3, h: 150 })).toBe(false);
  });

  it("clampChroma keeps L and H to 1e-9, the result is in gamut (channels within [0, 1] ± 1e-6), and C + 0.001 is out of gamut", () => {
    for (const color of [
      { l: 0.7, c: 0.3, h: 150 },
      { l: 0.5, c: 0.4, h: 20 },
      { l: 0.9, c: 0.25, h: 260 },
      { l: 0.2, c: 0.2, h: 300 },
    ]) {
      const clamped = clampChroma(color);
      expect(Math.abs(clamped.l - color.l)).toBeLessThan(1e-9);
      expect(Math.abs(clamped.h - color.h)).toBeLessThan(1e-9);
      expect(clamped.c).toBeLessThan(color.c);
      for (const v of channels(clamped)) {
        expect(v).toBeGreaterThanOrEqual(-1e-6);
        expect(v).toBeLessThanOrEqual(1 + 1e-6);
      }
      expect(inGamut(clamped)).toBe(true);
      expect(inGamut({ ...clamped, c: clamped.c + 0.001 })).toBe(false);
    }
  });

  it("clampChroma returns an in-gamut color unchanged", () => {
    const color = hexToOklch("#1DB07A");
    expect(clampChroma(color)).toBe(color);
  });
});
