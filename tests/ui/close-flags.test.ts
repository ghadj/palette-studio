/** Close flags and their descriptions (M3 decisions 51 and 52; spec 3.5, 3.8). */
import { afterEach, describe, expect, it } from "vitest";
import { hexToOklab } from "../../src/color/convert";
import { createSwatch } from "../../src/palette/model";
import { DEFAULT_SETTINGS, DEFAULT_VIEW_SETTINGS } from "../../src/state/defaults";
import { palette, settings, viewSettings } from "../../src/state/signals";
import { closeDescription, closeFlags, swatchList } from "../../src/ui/closeFlags";

const setPalette = (hexes: string[]) => {
  palette.value = hexes.map((hex) => createSwatch(hexToOklab(hex)));
};

afterEach(() => {
  palette.value = [];
  settings.value = { ...DEFAULT_SETTINGS };
  viewSettings.value = { ...DEFAULT_VIEW_SETTINGS };
});

describe("swatchList and closeDescription", () => {
  it("names one swatch in the singular", () => {
    expect(swatchList([1])).toBe("swatch 2");
    expect(closeDescription("value", [1])).toBe("Close in value to swatch 2");
    expect(closeDescription("color", [0])).toBe("Very close to swatch 1");
  });

  it("names two swatches with 'and' and no comma", () => {
    expect(closeDescription("color", [0, 2])).toBe("Very close to swatches 1 and 3");
  });

  it("names three or more with commas and a final 'and'", () => {
    expect(closeDescription("value", [0, 1, 3])).toBe("Close in value to swatches 1, 2 and 4");
    expect(swatchList([0, 1, 2, 3])).toBe("swatches 1, 2, 3 and 4");
  });
});

describe("closeFlags", () => {
  it("flags nothing in the Palette view", () => {
    setPalette(["#E8693A", "#EA6B3B"]);
    viewSettings.value = { ...DEFAULT_VIEW_SETTINGS, mode: "palette" };
    const flags = closeFlags();
    expect(flags.kind).toBeNull();
    expect(flags.partners.size).toBe(0);
  });

  it("the Image view flags very close colors, each pointing at the other", () => {
    setPalette(["#E8693A", "#14386B", "#EA6B3B"]);
    viewSettings.value = { ...DEFAULT_VIEW_SETTINGS, mode: "image" };
    const flags = closeFlags();
    expect(flags.kind).toBe("color");
    expect([...flags.partners.entries()]).toEqual([
      [0, [2]],
      [2, [0]],
    ]);
  });

  it("the Image view has kind null when no pair is close", () => {
    setPalette(["#E8693A", "#14386B", "#1DB07A"]);
    viewSettings.value = { ...DEFAULT_VIEW_SETTINGS, mode: "image" };
    expect(closeFlags().kind).toBeNull();
  });

  it("the Values view flags colors close in value, and the threshold changes the set", () => {
    setPalette(["#808080", "#828282", "#999999"]);
    viewSettings.value = { ...DEFAULT_VIEW_SETTINGS, mode: "values", closeInValue: 0.01 };
    expect(closeFlags().kind).toBe("value");
    expect([...closeFlags().partners.keys()]).toEqual([0, 1]);
    viewSettings.value = { ...viewSettings.value, closeInValue: 0.1 };
    expect([...closeFlags().partners.keys()].sort()).toEqual([0, 1, 2]);
  });
});
