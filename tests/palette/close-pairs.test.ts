/** Close pairs (spec 3.5; plan T8; M2 decision 7): pairs closer than the merge threshold. */
import { describe, expect, it } from "vitest";
import { hexToOklab } from "../../src/color/convert";
import { closePairs } from "../../src/palette/close-pairs";
import { createSwatch } from "../../src/palette/model";

const swatches = (hexes: string[], locked: boolean[] = []) =>
  hexes.map((hex, i) => createSwatch(hexToOklab(hex), { locked: locked[i] ?? false }));

describe("close pairs", () => {
  it("under CIEDE2000 with stored threshold 0.03 (3.0), #E8693A/#EA6B3B (ΔE00 0.64) is a pair and #14386B/#E8693A is not", () => {
    const pairs = closePairs(swatches(["#E8693A", "#EA6B3B", "#14386B"]), "ciede2000", 0.03);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ first: 0, second: 1 });
    expect(pairs[0]?.distance).toBeCloseTo(0.64, 1);
  });

  it("the mockup palette has no close pairs at ΔE OK 0.03", () => {
    const mockup = ["#E8693A", "#1DB07A", "#14386B", "#D4527F", "#1E8A2E", "#5039B0"];
    expect(closePairs(swatches(mockup), "ok", 0.03)).toEqual([]);
  });

  it("locked and unlocked swatches are both checked", () => {
    const pairs = closePairs(
      swatches(["#E8693A", "#EA6B3B", "#E8693A"], [true, false, true]),
      "ok",
      0.03,
    );
    expect(pairs.map((p) => [p.first, p.second])).toEqual([
      [0, 1],
      [0, 2],
      [1, 2],
    ]);
  });

  it("a threshold of 0 flags nothing", () => {
    expect(closePairs(swatches(["#E8693A", "#E8693A"]), "ok", 0)).toEqual([]);
  });
});
