/**
 * Extraction stores each swatch's marker point (spec 3.7, plan M3-T10): the point the worker
 * placed becomes the swatch's point and the point "Reset to extracted" restores.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const extract = vi.fn();
vi.mock("../../src/extract/client", () => ({ imageClient: () => ({ extract }) }));

const { extractNow } = await import("../../src/state/extraction");
const { palette } = await import("../../src/state/signals");

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const color = (l: number, population: number) => ({ lab: { l, a: 0, b: 0 }, population });

describe("extracted marker points (spec 3.7)", () => {
  beforeEach(() => {
    extract.mockReset();
    palette.value = [];
  });

  it("applyColors stores point and extracted.point", async () => {
    const points = [
      { x: 0.25, y: 0.75 },
      { x: 0.8, y: 0.1 },
    ];
    extract.mockResolvedValueOnce({
      colors: [color(0.4, 0.6), color(0.8, 0.4)],
      reason: null,
      points,
    });
    extractNow();
    await flush();
    expect(palette.value.map((s) => s.point)).toEqual(points);
    expect(palette.value.map((s) => s.extracted?.point)).toEqual(points);
  });

  it("a result without points leaves the swatches without markers", async () => {
    extract.mockResolvedValueOnce({ colors: [color(0.5, 1)], reason: null });
    extractNow();
    await flush();
    expect(palette.value[0]?.point).toBeNull();
    expect(palette.value[0]?.extracted?.point).toBeNull();
  });
});
