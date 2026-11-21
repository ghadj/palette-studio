import { describe, expect, it } from "vitest";
import {
  hexToOklab,
  hexToOklch,
  oklabToOklch,
  oklabToRgb,
  oklchToOklab,
  rgbToOklab,
} from "../../src/color/convert";
import { clampChroma, clipRgb, inGamut, toSrgb } from "../../src/color/gamut";

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

describe("gamut handling for gradients (spec 4.3; plan D12)", () => {
  it("clipRgb clips each channel to 0 to 1 and leaves in-range channels alone", () => {
    expect(clipRgb({ r: -0.2, g: 0.5, b: 1.3 })).toEqual({ r: 0, g: 0.5, b: 1 });
  });

  it("toSrgb leaves an in-gamut color alone, under either handling", () => {
    for (const handling of ["chroma", "clamp"] as const) {
      const out = toSrgb(hexToOklab("#1DB07A"), handling);
      expect(out.mapped).toBe(false);
      expect(out.rgb.g).toBeCloseTo(0xb0 / 255, 9);
    }
  });

  it("toSrgb with Reduce chroma keeps L and H; with Clamp it clips the channels", () => {
    const lab = oklchToOklab({ l: 0.7, c: 0.3, h: 150 });
    const reduced = toSrgb(lab, "chroma");
    expect(reduced.mapped).toBe(true);
    const back = oklabToOklch(rgbToOklab(reduced.rgb));
    expect(Math.abs(back.l - 0.7)).toBeLessThan(1e-6);
    expect(Math.abs(back.h - 150)).toBeLessThan(1e-4);
    const clipped = toSrgb(lab, "clamp");
    expect(clipped.mapped).toBe(true);
    expect(clipped.rgb).toEqual(clipRgb(oklabToRgb(lab)));
  });

  it("conversion noise below 1e-4 doesn't count as out of gamut", () => {
    const white = oklabToRgb(hexToOklab("#FFFFFF"));
    const out = toSrgb(rgbToOklab({ r: white.r + 5e-5, g: 1, b: 1 }), "chroma");
    expect(out.mapped).toBe(false);
    expect(out.rgb.r).toBeLessThanOrEqual(1);
  });
});

describe("the fast gamut math (M4-T10)", () => {
  it("inGamut agrees with culori's conversion on a grid of OKLCH colors", () => {
    const reference = (c: { l: number; c: number; h: number }) =>
      channels(c).every((v) => v >= -1e-6 && v <= 1 + 1e-6);
    for (let l = 0; l <= 1; l += 0.05) {
      for (let c = 0; c <= 0.4; c += 0.02) {
        for (let h = 0; h < 360; h += 15) {
          expect(inGamut({ l, c, h }), `${l} ${c} ${h}`).toBe(reference({ l, c, h }));
        }
      }
    }
  });

  it("clampChroma's result is in gamut by culori's conversion, and C + 2 steps is not", () => {
    for (let h = 0; h < 360; h += 7) {
      const out = clampChroma({ l: 0.6, c: 0.4, h });
      expect(channels(out).every((v) => v >= -1e-6 && v <= 1 + 1e-6)).toBe(true);
      expect(channels({ ...out, c: out.c + 2e-4 }).every((v) => v >= -1e-6 && v <= 1 + 1e-6)).toBe(
        false,
      );
    }
  });

  it("toSrgb of an in-gamut color is culori's sRGB to 1e-12", () => {
    for (const hex of ["#E8693A", "#1DB07A", "#14386B", "#808080", "#FFFFFF", "#000000"]) {
      const lab = hexToOklab(hex);
      const want = oklabToRgb(lab);
      const got = toSrgb(lab, "chroma").rgb;
      for (const ch of ["r", "g", "b"] as const) {
        expect(Math.abs(got[ch] - Math.min(1, Math.max(0, want[ch])))).toBeLessThan(1e-12);
      }
    }
  });
});
