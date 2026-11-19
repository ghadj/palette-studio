/** Removing a swatch (decision 38): one undo step, selection moves to the neighbour (as T4's Delete). */
import { beforeEach, describe, expect, it } from "vitest";
import { hexToOklab } from "../../src/color/convert";
import { createSwatch } from "../../src/palette/model";

const { removeSwatch } = await import("../../src/state/remove-swatch");
const history = await import("../../src/state/history");
const { palette, selectedSwatchId } = await import("../../src/state/signals");

beforeEach(() => {
  palette.value = ["#111111", "#444444", "#777777"].map((hex, i) =>
    createSwatch(hexToOklab(hex), { id: `s${i}` }),
  );
  selectedSwatchId.value = "s1";
  history.clear();
});

describe("removeSwatch", () => {
  it("removes the swatch, selects the one that took its place, and is one undo step", () => {
    removeSwatch("s1");
    expect(palette.value.map((s) => s.id)).toEqual(["s0", "s2"]);
    expect(selectedSwatchId.value).toBe("s2");
    expect(history.undoLabel.value).toBe("Delete");
    history.undo();
    expect(palette.value.map((s) => s.id)).toEqual(["s0", "s1", "s2"]);
  });

  it("removing the last one selects the new last one", () => {
    removeSwatch("s2");
    expect(selectedSwatchId.value).toBe("s1");
  });

  it("removing the only swatch leaves an empty palette and no selection, as Delete did", () => {
    palette.value = [createSwatch(hexToOklab("#111111"), { id: "only" })];
    removeSwatch("only");
    expect(palette.value).toEqual([]);
    expect(selectedSwatchId.value).toBeNull();
  });

  it("an unknown id changes nothing", () => {
    const before = palette.value;
    removeSwatch("nope");
    expect(palette.value).toBe(before);
    expect(history.canUndo.value).toBe(false);
  });
});
