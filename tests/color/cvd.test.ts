import { describe, expect, it } from "vitest";
import { srgbToLinear } from "../../src/color/convert";
import { CVD_MATRICES, simulateCvd, simulateLinear } from "../../src/color/cvd";

/** Reference: Machado, Oliveira, Fernandes, IEEE TVCG 15(6), 2009, severity 1.0 matrices. */
const MACHADO = ["protanopia", "deuteranopia", "tritanopia"] as const;

describe("CVD simulation (Machado 2009, severity 1)", () => {
  it("each matrix row sums to 1 ± 1e-5", () => {
    for (const type of MACHADO) {
      for (const row of CVD_MATRICES[type]) {
        expect(Math.abs(row[0] + row[1] + row[2] - 1)).toBeLessThan(1e-5);
      }
    }
  });

  it("protanopia of linear (1, 0, 0) is (0.152286, 0.114503, −0.003882) before clipping", () => {
    const out = simulateLinear({ r: 1, g: 0, b: 0 }, "protanopia");
    expect(out.r).toBeCloseTo(0.152286, 6);
    expect(out.g).toBeCloseTo(0.114503, 6);
    expect(out.b).toBeCloseTo(-0.003882, 6);
  });

  it("deuteranopia and tritanopia of linear (0, 0, 1) are the published third column", () => {
    const d = simulateLinear({ r: 0, g: 0, b: 1 }, "deuteranopia");
    expect([d.r, d.g, d.b]).toEqual([-0.227968, 0.047413, 0.968881]);
    const t = simulateLinear({ r: 0, g: 0, b: 1 }, "tritanopia");
    expect([t.r, t.g, t.b]).toEqual([-0.178779, 0.147602, 0.3039]);
  });

  it("grays are unchanged within 1/255 for all three", () => {
    for (const type of MACHADO) {
      for (let i = 0; i <= 255; i += 5) {
        const v = i / 255;
        const out = simulateCvd({ r: v, g: v, b: v }, type);
        for (const ch of [out.r, out.g, out.b]) expect(Math.abs(ch - v)).toBeLessThan(1 / 255);
      }
    }
  });

  it("achromatopsia gives R = G = B at the Rec. 709 luminance", () => {
    const out = simulateCvd({ r: 0.9, g: 0.2, b: 0.4 }, "achromatopsia");
    expect(out.g).toBeCloseTo(out.r, 12);
    expect(out.b).toBeCloseTo(out.r, 12);
    const lin = srgbToLinear({ r: 0.9, g: 0.2, b: 0.4 });
    const y = 0.2126 * lin.r + 0.7152 * lin.g + 0.0722 * lin.b;
    expect(srgbToLinear(out).r).toBeCloseTo(y, 6);
  });

  it("output is in gamut", () => {
    for (const type of [...MACHADO, "achromatopsia"] as const) {
      for (const [r, g, b] of [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
        [1, 1, 0],
        [0, 1, 1],
        [1, 0, 1],
        [0.1, 0.9, 0.3],
      ] as const) {
        const out = simulateCvd({ r, g, b }, type);
        for (const ch of [out.r, out.g, out.b]) {
          expect(ch).toBeGreaterThanOrEqual(0);
          expect(ch).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});
