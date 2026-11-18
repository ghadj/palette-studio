import { describe, expect, it } from "vitest";
import { formatDecimal, parseDecimal } from "../../src/ui/DecimalField";

describe("decimal field (spec 2.4, 5, 6.1)", () => {
  it("accepts a period or a comma as the decimal separator", () => {
    expect(parseDecimal("0.05")).toBe(0.05);
    expect(parseDecimal("0,05")).toBe(0.05);
    expect(parseDecimal(" .5 ")).toBe(0.5);
    expect(parseDecimal("1")).toBe(1);
    expect(parseDecimal("1.")).toBe(1);
  });

  it("rejects text that isn't a plain non-negative number", () => {
    for (const raw of ["", " ", "abc", "0.0.1", "1e-2", "-0.1", "0,0,1", "Infinity"]) {
      expect(parseDecimal(raw), raw).toBeNull();
    }
  });

  it("formats with a period and fixed decimals", () => {
    expect(formatDecimal(0.2, 2)).toBe("0.20");
    expect(formatDecimal(0.95, 2)).toBe("0.95");
    expect(formatDecimal(0, 2)).toBe("0.00");
  });
});
