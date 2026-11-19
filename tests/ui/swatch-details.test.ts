import { describe, expect, it } from "vitest";
import { hexToOklab, hexToOklch } from "../../src/color/convert";
import { createSwatch, swatchHex } from "../../src/palette/model";
import { setExact } from "../../src/ui/SwatchDetails";

describe("Swatch row edits (decision 1b)", () => {
  it("an edit stores the exact (output) color it was given and locks the swatch", () => {
    const base = [createSwatch(hexToOklab("#14386B"), { id: "a" })];
    // The output color an adjustment would show: the fields show it, and committing its HEX
    // stores exactly that color on the base swatch.
    const shownHex = "#3A5E92";
    const edited = setExact(base, "a", hexToOklch(shownHex))[0];
    if (!edited) throw new Error("no swatch");
    expect(edited.locked).toBe(true);
    expect(swatchHex(edited)).toBe(shownHex);
  });
});
