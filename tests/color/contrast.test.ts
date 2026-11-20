/** WCAG 2.x contrast (spec 3.5; plan D7). Reference values from the WCAG 2.x definition. */
import { describe, expect, it } from "vitest";
import { badge, contrastRatio, relativeLuminance } from "../../src/color/contrast";

describe("contrast ratio (WCAG 2.x)", () => {
  it("#FFFFFF/#000000 is 21.00", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 10);
  });

  it("the luminance of white is 1 and of black 0", () => {
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 10);
    expect(relativeLuminance("#000000")).toBe(0);
  });

  it("#767676 on #FFFFFF is 4.54 and gets AA", () => {
    const ratio = contrastRatio("#767676", "#FFFFFF");
    expect(ratio.toFixed(2)).toBe("4.54");
    expect(badge(ratio)).toBe("AA");
  });

  it("#777777 on #FFFFFF is 4.48 and gets AA large only", () => {
    const ratio = contrastRatio("#777777", "#FFFFFF");
    expect(ratio.toFixed(2)).toBe("4.48");
    expect(badge(ratio)).toBe("AA large");
  });

  it("the ratio is symmetric", () => {
    expect(contrastRatio("#E8693A", "#14386B")).toBe(contrastRatio("#14386B", "#E8693A"));
  });

  it("a color against itself is 1", () => {
    expect(contrastRatio("#E8693A", "#E8693A")).toBe(1);
  });

  it("badge thresholds are 3, 4.5 and 7", () => {
    expect(badge(2.99)).toBe("Fail");
    expect(badge(3)).toBe("AA large");
    expect(badge(4.49)).toBe("AA large");
    expect(badge(4.5)).toBe("AA");
    expect(badge(6.99)).toBe("AA");
    expect(badge(7)).toBe("AAA");
    expect(badge(21)).toBe("AAA");
  });
});
