/**
 * Interpolation in the ten spaces of spec 4.3 (M4-T3), following CSS Color 4 §12 "Interpolation":
 * - §12.3 premultiplied alpha, §12.4 hue interpolation (the four fixups)
 * - §4.4 and §12.2 powerless and missing components ("carried forward" from the other stop; plan D11)
 *
 * Reference values:
 * - sRGB and linear-sRGB midpoints are worked by hand: (1, 0, 0) and (0, 0, 1) average to
 *   (0.5, 0, 0.5); in linear sRGB that encodes to 0.7354 = 187.5 / 255, so #BC00BC.
 * - OKLab L 0.5 is the gray #636363 (docs/design/mockup-state.md; 0.5³ = 0.125 linear).
 * - OKLCH hues of #FF0000 (29.23°) and #0000FF (264.05°) from Björn Ottosson's OKLab reference
 *   matrices, as culori computes them; their means are 146.64° and 326.64°.
 * - CSS `lab()` is CIELAB D50 (CSS Color 4 §9.1 and its sample code): #FF0000 is
 *   lab(54.29 80.80 69.89) (CSS Color 4 §9.3 examples give 54.29 80.82 69.91, within ±0.05).
 */
import { describe, expect, it } from "vitest";
import {
  hexToOklch,
  hexToRgb,
  type Oklab,
  oklabToHex,
  oklabToOklch,
  oklabToRgb,
  oklchToOklab,
} from "../../src/color/convert";
import { type MixOptions, mix, mixer } from "../../src/gradient/interpolate";
import { toSpace } from "../../src/gradient/spaces";
import type { HueMethod, InterpolationSpace } from "../../src/types";

const SPACES: InterpolationSpace[] = [
  "srgb",
  "srgb-linear",
  "display-p3",
  "lab",
  "oklab",
  "lch",
  "oklch",
  "hsl",
  "hwb",
  "xyz",
];

const opts = (
  space: InterpolationSpace,
  hue: HueMethod = "shorter",
  premultiplied = true,
): MixOptions => ({
  space,
  hue,
  premultiplied,
});

const stop = (hex: string, alpha = 1) => ({ color: hexToOklch(hex), alpha });

const midHex = (a: string, b: string, space: InterpolationSpace) =>
  oklabToHex(mix(stop(a), stop(b), 0.5, opts(space)).color);

/**
 * Expects `color` to be the 8-bit sRGB `hex` before rounding, each channel within 1e-6 of
 * `exact` (0 to 255). The sRGB midpoints are ties: #800080 is rgb(127.5 0 127.5) rounded half up,
 * as browsers serialize it, and the OKLab round trip lands within 1e-12 of 127.5 on either side, so
 * comparing HEX strings would test float noise. The channel values are the reference.
 */
const expectRgb255 = (color: Oklab, exact: [number, number, number]) => {
  const rgb = oklabToRgb(color);
  const got = [rgb.r * 255, rgb.g * 255, rgb.b * 255];
  got.forEach((v, i) => {
    expect(Math.abs(v - (exact[i] ?? 0))).toBeLessThan(1e-6);
  });
};
const PURPLE: [number, number, number] = [127.5, 0, 127.5]; // #800080
const GRAY: [number, number, number] = [127.5, 127.5, 127.5]; // #808080

/** The angular distance between two hues, in degrees, 0 to 180. */
const hueDistance = (a: number, b: number) => {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(d, 360 - d);
};

describe("mix (spec 4.3; CSS Color 4 §12)", () => {
  it("#FF0000→#0000FF at 0.5: sRGB #800080, linear sRGB #BC00BC", () => {
    expectRgb255(mix(stop("#FF0000"), stop("#0000FF"), 0.5, opts("srgb")).color, PURPLE);
    expect(midHex("#FF0000", "#0000FF", "srgb-linear")).toBe("#BC00BC");
  });

  it("#000000→#FFFFFF at 0.5: sRGB #808080, linear sRGB #BCBCBC, OKLab #636363", () => {
    expectRgb255(mix(stop("#000000"), stop("#FFFFFF"), 0.5, opts("srgb")).color, GRAY);
    expect(midHex("#000000", "#FFFFFF", "srgb-linear")).toBe("#BCBCBC");
    expect(midHex("#000000", "#FFFFFF", "oklab")).toBe("#636363");
  });

  it("#FF0000→#00FFFF at 0.5: the sRGB midpoint has OKLCH C < 0.001 (it passes through gray); the OKLab midpoint has C > 0.04", () => {
    const srgb = mix(stop("#FF0000"), stop("#00FFFF"), 0.5, opts("srgb")).color;
    const oklab = mix(stop("#FF0000"), stop("#00FFFF"), 0.5, opts("oklab")).color;
    expect(oklabToOklch(srgb).c).toBeLessThan(0.001);
    expect(oklabToOklch(oklab).c).toBeGreaterThan(0.04);
  });

  it("OKLCH #FF0000 (H 29.2)→#0000FF (H 264.1) at 0.5: shorter 326.6°, longer 146.6°, increasing 146.6°, decreasing 326.6° (±0.2°)", () => {
    const hueAt = (method: HueMethod) =>
      oklabToOklch(mix(stop("#FF0000"), stop("#0000FF"), 0.5, opts("oklch", method)).color).h;
    expect(hueDistance(hueAt("shorter"), 326.6)).toBeLessThan(0.2);
    expect(hueDistance(hueAt("longer"), 146.6)).toBeLessThan(0.2);
    expect(hueDistance(hueAt("increasing"), 146.6)).toBeLessThan(0.2);
    expect(hueDistance(hueAt("decreasing"), 326.6)).toBeLessThan(0.2);
  });

  it("the hue fixups follow CSS Color 4 §12.4 in the other direction too (#0000FF→#FF0000)", () => {
    const hueAt = (method: HueMethod) =>
      oklabToOklch(mix(stop("#0000FF"), stop("#FF0000"), 0.5, opts("oklch", method)).color).h;
    expect(hueDistance(hueAt("shorter"), 326.6)).toBeLessThan(0.2);
    expect(hueDistance(hueAt("longer"), 146.6)).toBeLessThan(0.2);
    // 264.1 → 29.2 increasing goes 264.1 → 389.2, through 326.6.
    expect(hueDistance(hueAt("increasing"), 326.6)).toBeLessThan(0.2);
    expect(hueDistance(hueAt("decreasing"), 146.6)).toBeLessThan(0.2);
  });

  it("longer hue between two equal hues goes once round the wheel (CSS Color 4 §12.4.2)", () => {
    const a = { color: { l: 0.7, c: 0.1, h: 40 }, alpha: 1 };
    const quarter = oklabToOklch(mix(a, a, 0.25, opts("oklch", "longer")).color);
    expect(hueDistance(quarter.h, 130)).toBeLessThan(1e-6);
  });

  it("#FFFFFF→#0000FF in OKLCH: at 0.5 the hue is blue's (±0.5°), because white's hue is powerless; likewise #808080→#FF0000 in HSL gives hue 0", () => {
    const blue = hexToOklch("#0000FF").h;
    const okMid = oklabToOklch(mix(stop("#FFFFFF"), stop("#0000FF"), 0.5, opts("oklch")).color);
    expect(hueDistance(okMid.h, blue)).toBeLessThan(0.5);

    // In HSL, gray is hsl(none 0% 50.2%) and red is hsl(0 100% 50%): the midpoint is hsl(0 50% 50.1%).
    const hslMid = oklabToRgb(mix(stop("#808080"), stop("#FF0000"), 0.5, opts("hsl")).color);
    expect(hslMid.r).toBeGreaterThan(hslMid.g + 0.3);
    expect(Math.abs(hslMid.g - hslMid.b)).toBeLessThan(1e-6);
  });

  it("an achromatic stop takes the other stop's hue in every polar space (LCH, OKLCH, HSL, HWB)", () => {
    for (const space of ["lch", "oklch", "hsl", "hwb"] as const) {
      for (const gray of ["#FFFFFF", "#808080", "#000000"]) {
        // From gray to green (H about 142° in OKLCH), the midpoint must stay green: no detour
        // through another hue. Its OKLCH hue lies within 15° of green's.
        const green = hexToOklch("#00A000");
        const mid = oklabToOklch(mix(stop(gray), stop("#00A000"), 0.5, opts(space)).color);
        expect(hueDistance(mid.h, green.h), `${space} ${gray}`).toBeLessThan(15);
      }
    }
  });

  it("two achromatic stops stay achromatic in every polar space", () => {
    for (const space of ["lch", "oklch", "hsl", "hwb"] as const) {
      const mid = oklabToOklch(mix(stop("#FFFFFF"), stop("#202020"), 0.5, opts(space)).color);
      expect(mid.c, space).toBeLessThan(1e-4);
    }
  });

  it("the XYZ midpoint equals the linear-sRGB midpoint within 1e-9", () => {
    for (const [a, b] of [
      ["#FF0000", "#0000FF"],
      ["#1DB07A", "#D4527F"],
      ["#000000", "#FFFFFF"],
    ] as const) {
      for (const t of [0.25, 0.5, 0.8]) {
        const xyz = mix(stop(a), stop(b), t, opts("xyz")).color;
        const lin = mix(stop(a), stop(b), t, opts("srgb-linear")).color;
        expect(Math.abs(xyz.l - lin.l)).toBeLessThan(1e-9);
        expect(Math.abs(xyz.a - lin.a)).toBeLessThan(1e-9);
        expect(Math.abs(xyz.b - lin.b)).toBeLessThan(1e-9);
      }
    }
  });

  it("premultiplied: #FF000000→#0000FF at 0.5 gives rgb(0 0 255 / 0.5); not premultiplied gives rgb(128 0 128 / 0.5)", () => {
    const pre = mix(stop("#FF0000", 0), stop("#0000FF"), 0.5, opts("srgb", "shorter", true));
    expect(pre.alpha).toBeCloseTo(0.5, 9);
    expect(oklabToHex(pre.color)).toBe("#0000FF");

    const straight = mix(stop("#FF0000", 0), stop("#0000FF"), 0.5, opts("srgb", "shorter", false));
    expect(straight.alpha).toBeCloseTo(0.5, 9);
    expectRgb255(straight.color, PURPLE);
  });

  it("premultiplied leaves the hue alone (CSS Color 4 §12.3): OKLCH hue is the plain mean", () => {
    const a = { color: { l: 0.6, c: 0.1, h: 20 }, alpha: 0.2 };
    const b = { color: { l: 0.6, c: 0.1, h: 80 }, alpha: 1 };
    const mid = oklabToOklch(mix(a, b, 0.5, opts("oklch")).color);
    expect(hueDistance(mid.h, 50)).toBeLessThan(1e-6);
    // L and C are premultiplied, so with equal L and C they come back unchanged.
    expect(mid.l).toBeCloseTo(0.6, 9);
    expect(mid.c).toBeCloseTo(0.1, 9);
  });

  it("two fully transparent stops mix without dividing by zero", () => {
    const out = mix(stop("#FF0000", 0), stop("#0000FF", 0), 0.5, opts("srgb"));
    expect(out.alpha).toBe(0);
    expectRgb255(out.color, PURPLE);
  });

  it("t = 0 and t = 1 return the stops within 1e-6 in every space", () => {
    const pairs: [string, number, string, number][] = [
      ["#FF0000", 1, "#0000FF", 1],
      ["#1DB07A", 1, "#5039B0", 0.4],
      ["#FFFFFF", 1, "#D4527F", 1],
      ["#808080", 0.5, "#000000", 1],
      ["#E8693A", 0, "#14386B", 1],
    ];
    for (const space of SPACES) {
      for (const [ha, aa, hb, ab] of pairs) {
        const a = stop(ha, aa);
        const b = stop(hb, ab);
        for (const [t, want] of [
          [0, a],
          [1, b],
        ] as const) {
          const got = mix(a, b, t, opts(space));
          const ref = oklchToOklab(want.color);
          const where = `${space} ${ha}→${hb} t=${t}`;
          expect(Math.abs(got.color.l - ref.l), where).toBeLessThan(1e-6);
          expect(Math.abs(got.color.a - ref.a), where).toBeLessThan(1e-6);
          expect(Math.abs(got.color.b - ref.b), where).toBeLessThan(1e-6);
          expect(Math.abs(got.alpha - want.alpha), where).toBeLessThan(1e-12);
        }
      }
    }
  });

  it("mixer(a, b, options)(t) equals mix(a, b, t, options)", () => {
    for (const space of SPACES) {
      const a = stop("#1DB07A", 0.7);
      const b = stop("#D4527F");
      const f = mixer(a, b, opts(space, "longer"));
      for (const t of [0, 0.3, 0.5, 1]) {
        expect(f(t)).toEqual(mix(a, b, t, opts(space, "longer")));
      }
    }
  });

  it("Display P3 is its own space: the red→green midpoint differs from sRGB's", () => {
    const p3 = mix(stop("#FF0000"), stop("#00FF00"), 0.5, opts("display-p3")).color;
    const srgb = mix(stop("#FF0000"), stop("#00FF00"), 0.5, opts("srgb")).color;
    expect(Math.abs(p3.a - srgb.a) + Math.abs(p3.b - srgb.b)).toBeGreaterThan(1e-3);
    // And the P3 midpoint is a gamma-encoded average of the P3 coordinates.
    const ra = toSpace(hexToOklch("#FF0000"), "display-p3").coords;
    const ga = toSpace(hexToOklch("#00FF00"), "display-p3").coords;
    const want = toSpace(oklabToOklch(p3), "display-p3").coords;
    for (let i = 0; i < 3; i += 1) {
      expect(want[i]).toBeCloseTo(((ra[i] ?? 0) + (ga[i] ?? 0)) / 2, 6);
    }
  });

  it("CSS lab is D50: #FF0000 → lab(54.29 80.80 69.89) ± 0.05", () => {
    const [l, a, b] = toSpace(hexToOklch("#FF0000"), "lab").coords;
    expect(Math.abs((l ?? 0) - 54.29)).toBeLessThan(0.05);
    expect(Math.abs((a ?? 0) - 80.8)).toBeLessThan(0.05);
    expect(Math.abs((b ?? 0) - 69.89)).toBeLessThan(0.05);
    // And lch is its polar form: C 106.84, H 40.86 (D50).
    const lch = toSpace(hexToOklch("#FF0000"), "lch");
    expect(lch.coords[1]).toBeCloseTo(106.84, 1);
    expect(lch.coords[2]).toBeCloseTo(40.86, 1);
  });

  it("CSS xyz is D65: #FFFFFF → xyz(0.9505 1 1.089)", () => {
    const [x, y, z] = toSpace(hexToOklch("#FFFFFF"), "xyz").coords;
    expect(x).toBeCloseTo(0.9505, 3);
    expect(y).toBeCloseTo(1, 4);
    expect(z).toBeCloseTo(1.089, 3);
  });

  it("white's HSL and HWB coordinates are exact, with the hue missing", () => {
    expect(hexToRgb("#FFFFFF")).toEqual({ r: 1, g: 1, b: 1 });
    const hsl = toSpace(hexToOklch("#FFFFFF"), "hsl");
    expect(hsl.hueMissing).toBe(true);
    expect(hsl.coords[1]).toBe(0);
    expect(hsl.coords[2]).toBeCloseTo(1, 12);
    const hwb = toSpace(hexToOklch("#FFFFFF"), "hwb");
    expect(hwb.hueMissing).toBe(true);
    expect((hwb.coords[1] ?? 0) + (hwb.coords[2] ?? 0)).toBeCloseTo(1, 12);
  });
});
