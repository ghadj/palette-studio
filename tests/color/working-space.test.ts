import { describe, expect, it } from "vitest";
import { hexToRgb, rgbToLab, rgbToOklab, srgbToLinear } from "../../src/color/convert";
import { rgb8ToWorking, workingToOklab } from "../../src/color/working-space";
import type { WorkingSpace } from "../../src/types";

const SPACES: WorkingSpace[] = ["oklab", "cielab", "linear-srgb", "srgb"];

describe("working spaces (spec 2.3)", () => {
  it("byte colors convert like the reference conversions, and back to OKLab", () => {
    const out = new Float64Array(3);
    for (let r = 0; r < 256; r += 17) {
      for (let g = 0; g < 256; g += 51) {
        for (let b = 0; b < 256; b += 85) {
          const rgb = { r: r / 255, g: g / 255, b: b / 255 };
          const refs: Record<WorkingSpace, number[]> = {
            oklab: Object.values(rgbToOklab(rgb)),
            cielab: Object.values(rgbToLab(rgb)),
            "linear-srgb": Object.values(srgbToLinear(rgb)),
            srgb: [rgb.r, rgb.g, rgb.b],
          };
          const oklab = rgbToOklab(rgb);
          for (const space of SPACES) {
            rgb8ToWorking(space)(r, g, b, out, 0);
            const ref = refs[space];
            for (let i = 0; i < 3; i += 1) expect(out[i]).toBeCloseTo(ref[i] ?? Number.NaN, 12);
            const back = workingToOklab(space, out[0] ?? 0, out[1] ?? 0, out[2] ?? 0);
            expect(back.l).toBeCloseTo(oklab.l, 9);
            expect(back.a).toBeCloseTo(oklab.a, 9);
            expect(back.b).toBeCloseTo(oklab.b, 9);
          }
        }
      }
    }
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
  });
});
