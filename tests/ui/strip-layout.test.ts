import { describe, expect, it } from "vitest";
import { stripColumns } from "../../src/ui/stripLayout";

describe("swatch strip layout (decision 13)", () => {
  it("up to 6 swatches always sit in one row", () => {
    for (let n = 1; n <= 6; n += 1) expect(stripColumns(n, 288, 4)).toBe(n);
  });

  it("7 to 12 swatches use one row only when each keeps at least 44 px, otherwise two even rows", () => {
    // 12 × 44 + 11 × 8 = 616 px.
    expect(stripColumns(12, 616, 8)).toBe(12);
    expect(stripColumns(12, 615, 8)).toBe(6);
    expect(stripColumns(12, 400, 8)).toBe(6);
    expect(stripColumns(11, 400, 8)).toBe(6);
    expect(stripColumns(9, 400, 8)).toBe(5);
    expect(stripColumns(7, 400, 8)).toBe(7); // 7 × 44 + 6 × 8 = 356 px fits
    expect(stripColumns(7, 300, 8)).toBe(4);
    // 320 px phone: 288 px of content with 4 px gaps still fits 6 per row at 44.7 px.
    expect(stripColumns(12, 288, 4)).toBe(6);
  });

  it("an unmeasured strip assumes two rows for more than 6", () => {
    expect(stripColumns(12, 0, 8)).toBe(6);
    expect(stripColumns(0, 300, 8)).toBe(1);
  });
});
