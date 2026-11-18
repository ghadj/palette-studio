import { describe, expect, it } from "vitest";
import { centered } from "../../src/image/viewport";
import { parseMockupZoom } from "../../src/state/mockup";

describe("mockup zoom parameter (decision 15g)", () => {
  it("zoom=2, 4 and 8 give that scale; anything else is Fit", () => {
    expect(parseMockupZoom("?demo=mockup&zoom=2")).toBe(2);
    expect(parseMockupZoom("?demo=mockup&zoom=4")).toBe(4);
    expect(parseMockupZoom("?demo=mockup&zoom=8")).toBe(8);
    for (const bad of ["?demo=mockup", "?demo=mockup&zoom=3", "?demo=mockup&zoom=16", "?zoom=x"]) {
      expect(parseMockupZoom(bad)).toBe(1);
    }
  });

  it("the zoomed view is centered on the image", () => {
    expect(centered(2, { width: 1, height: 1 })).toEqual({ scale: 2, x: -0.5, y: -0.5 });
    expect(centered(4, { width: 1, height: 1 })).toEqual({ scale: 4, x: -1.5, y: -1.5 });
    expect(centered(1, { width: 1, height: 1 })).toEqual({ scale: 1, x: 0, y: 0 });
  });
});
