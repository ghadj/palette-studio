import { describe, expect, it } from "vitest";
import { stripCells, stripColumns } from "../../src/ui/stripLayout";

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

  it("the '+' tile counts as a cell until the 12-swatch limit (decision 29)", () => {
    expect(stripCells(6)).toBe(7);
    expect(stripCells(11)).toBe(12);
    expect(stripCells(12)).toBe(12);
    // 6 swatches and the tile: one row at 390 px (358 px of content), two rows at 320 px.
    expect(stripColumns(stripCells(6), 358, 4)).toBe(7);
    expect(stripColumns(stripCells(6), 288, 4)).toBe(4);
    // 11 swatches and the tile wrap evenly, 6 and 6.
    expect(stripColumns(stripCells(11), 400, 8)).toBe(6);
  });
});
