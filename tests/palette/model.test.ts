import { describe, expect, it } from "vitest";
import { hexToOklab, oklabToOklch } from "../../src/color/convert";
import {
  createSwatch,
  selectedSwatch,
  swatchHex,
  swatchLabel,
  swatchOklab,
} from "../../src/palette/model";

describe("palette model (spec 3.1)", () => {
  it("swatch from OKLab stores OKLCH and round-trips to the same hex", () => {
    for (const hex of [
      "#E8693A",
      "#1DB07A",
      "#14386B",
      "#D4527F",
      "#1E8A2E",
      "#5039B0",
      "#808080",
    ]) {
      const lab = hexToOklab(hex);
      const swatch = createSwatch(lab, { population: 0.25 });
      expect(swatch.color).toEqual(oklabToOklch(lab));
      expect(swatchHex(swatch)).toBe(hex);
      const back = swatchOklab(swatch);
      expect(back.l).toBeCloseTo(lab.l, 12);
      expect(back.a).toBeCloseTo(lab.a, 12);
      expect(back.b).toBeCloseTo(lab.b, 12);
      expect(swatch).toMatchObject({
        alpha: 1,
        name: "",
        locked: false,
        origin: "extracted",
        population: 0.25,
        point: null,
        sampleRadius: "auto",
      });
    }
  });

  it("gives unique ids and finds the selection", () => {
    const a = createSwatch(hexToOklab("#000000"));
    const b = createSwatch(hexToOklab("#FFFFFF"));
    expect(a.id).not.toBe(b.id);
    expect(selectedSwatch([a, b], b.id)).toBe(b);
    expect(selectedSwatch([a, b], null)).toBeNull();
    expect(selectedSwatch([a, b], "missing")).toBeNull();
    expect(swatchLabel([a, b], b.id)).toBe("Swatch 2");
    expect(swatchLabel([a, { ...b, name: "Sky" }], b.id)).toBe("Sky");
  });
});
