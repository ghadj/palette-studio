import { describe, expect, it } from "vitest";
import { hexToOklab, hexToRgb, type Lab, oklabToLab, rgbToLab } from "../../src/color/convert";
import { deltaE, deltaE2000, deltaEOK } from "../../src/color/delta-e";
import sharma from "../fixtures/ciede2000-sharma.json";

const lab = ([l, a, b]: number[]): Lab => ({ l: l ?? 0, a: a ?? 0, b: b ?? 0 });

describe("ΔE OK (spec 2.3)", () => {
  it("ΔE OK of (0.50, 0, 0) and (0.52, 0, 0) is 0.02; zero for identical colors; symmetric", () => {
    const a = { l: 0.5, a: 0, b: 0 };
    const b = { l: 0.52, a: 0, b: 0 };
    expect(deltaEOK(a, b)).toBeCloseTo(0.02, 12);
    expect(deltaEOK(a, a)).toBe(0);
    const c = { l: 0.6, a: 0.1, b: -0.05 };
    const d = { l: 0.4, a: -0.02, b: 0.07 };
    expect(deltaEOK(c, d)).toBe(deltaEOK(d, c));
    expect(deltaEOK(c, d)).toBeCloseTo(Math.hypot(0.2, 0.12, 0.12), 12);
  });
});

describe("CIEDE2000 (spec 2.3, 8; Sharma, Wu and Dalal 2005)", () => {
  it("has all 34 published pairs", () => {
    expect(sharma.pairs).toHaveLength(34);
  });

  it("CIEDE2000 matches all 34 Sharma pairs to 4 decimals: pair 1 (50, 2.6772, −79.7751)/(50, 0, −82.7485) gives 2.0425; pair 4 (50, −1.3802, −84.2814)/(50, 0, −82.7485) gives 1.0000; pair 7 (50, 0, 0)/(50, −1, 2) gives 2.3669; pair 17 (50, 2.5, 0)/(73, 25, −18) gives 27.1492", () => {
    for (const p of sharma.pairs) {
      const d = deltaE2000(lab(p.lab1), lab(p.lab2));
      expect(Math.abs(d - p.deltaE00), `pair ${p.pair}: ${d}`).toBeLessThan(5e-5);
    }
    const spot = (n: number) => sharma.pairs.find((p) => p.pair === n);
    expect(spot(1)?.deltaE00).toBe(2.0425);
    expect(spot(4)?.deltaE00).toBe(1);
    expect(spot(7)?.deltaE00).toBe(2.3669);
    expect(spot(17)?.deltaE00).toBe(27.1492);
  });

  it("symmetric on every pair", () => {
    for (const p of sharma.pairs) {
      expect(deltaE2000(lab(p.lab1), lab(p.lab2)), `pair ${p.pair}`).toBeCloseTo(
        deltaE2000(lab(p.lab2), lab(p.lab1)),
        10,
      );
    }
  });

  it("zero for identical colors", () => {
    for (const p of sharma.pairs) {
      expect(deltaE2000(lab(p.lab1), lab(p.lab1))).toBe(0);
      expect(deltaE2000(lab(p.lab2), lab(p.lab2))).toBe(0);
    }
  });

  it("hex pairs from mockup-state.md, ±0.05", () => {
    const cases: Array<[string, string, number]> = [
      ["#E8693A", "#EA6B3B", 0.64],
      ["#E8693A", "#E96A3B", 0.31],
      ["#14386B", "#1B3C70", 1.37],
      ["#D4527F", "#D75481", 0.83],
    ];
    for (const [x, y, expected] of cases) {
      // Through CIELAB directly, and through the OKLab dispatch the extraction code uses.
      const direct = deltaE2000(rgbToLab(hexToRgb(x)), rgbToLab(hexToRgb(y)));
      expect(Math.abs(direct - expected), `${x}/${y}: ${direct}`).toBeLessThanOrEqual(0.05);
      const viaOklab = deltaE("ciede2000", hexToOklab(x), hexToOklab(y));
      expect(viaOklab).toBeCloseTo(direct, 9);
    }
  });
});

describe("OKLab to CIELAB and the metric dispatch", () => {
  it("oklabToLab agrees with the sRGB route and maps white to L 100", () => {
    for (const hex of ["#FFFFFF", "#000000", "#E8693A", "#14386B", "#1DB07A"]) {
      const viaOk = oklabToLab(hexToOklab(hex));
      const ref = rgbToLab(hexToRgb(hex));
      expect(viaOk.l, hex).toBeCloseTo(ref.l, 9);
      expect(viaOk.a, hex).toBeCloseTo(ref.a, 9);
      expect(viaOk.b, hex).toBeCloseTo(ref.b, 9);
    }
    expect(oklabToLab({ l: 1, a: 0, b: 0 }).l).toBeCloseTo(100, 4);
  });

  it("deltaE('ok') is ΔE OK", () => {
    const a = hexToOklab("#E8693A");
    const b = hexToOklab("#14386B");
    expect(deltaE("ok", a, b)).toBe(deltaEOK(a, b));
  });
});
