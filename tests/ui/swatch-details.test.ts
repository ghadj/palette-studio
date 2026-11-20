import { describe, expect, it } from "vitest";
import { hexToOklab, hexToOklch } from "../../src/color/convert";
import { createSwatch, swatchHex } from "../../src/palette/model";
import { setExact } from "../../src/ui/SwatchDetails";

describe("Swatch row edits (decision 24)", () => {
  it("an edit stores the color it was given as the base and pins the swatch", () => {
    const base = [createSwatch(hexToOklab("#14386B"), { id: "a" })];
    // The output color an adjustment would show: the fields show it, and committing its HEX
    // stores exactly that color on the base swatch.
    const shownHex = "#3A5E92";
    const edited = setExact(base, "a", hexToOklch(shownHex))[0];
    if (!edited) throw new Error("no swatch");
    expect(edited.pinned).toBe(true);
    expect(edited.locked).toBe(false);
    expect(swatchHex(edited)).toBe(shownHex);
  });
});
