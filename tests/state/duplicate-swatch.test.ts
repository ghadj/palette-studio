/** The D shortcut duplicates the selected swatch (decision 39; spec 3.2; decision 3f). */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hexToOklab } from "../../src/color/convert";
import { createSwatch, FULL_MESSAGE, MAX_SWATCHES } from "../../src/palette/model";

const { duplicateSelected } = await import("../../src/state/duplicate-swatch");
const history = await import("../../src/state/history");
const { palette, selectedSwatchId } = await import("../../src/state/signals");

beforeEach(() => {
  palette.value = ["#111111", "#444444", "#777777"].map((hex, i) =>
    createSwatch(hexToOklab(hex), { id: `s${i}`, population: 0.1 * (i + 1), origin: "picked" }),
  );
  selectedSwatchId.value = "s1";
  history.clear();
});

describe("duplicateSelected", () => {
  it("adds a copy after the selected swatch, copies its population, selects it, and is one undo step", () => {
    const notify = vi.fn();
    duplicateSelected(notify);
    expect(palette.value).toHaveLength(4);
    const copy = palette.value[2];
    expect(copy?.id).not.toBe("s1");
    expect(copy?.color).toEqual(palette.value[1]?.color);
    expect(copy?.population).toBeCloseTo(0.2, 12);
    expect(copy?.origin).toBe("manual");
    expect(copy?.pinned).toBe(false);
    expect(selectedSwatchId.value).toBe(copy?.id);
    expect(history.undoLabel.value).toBe("Duplicate");
    expect(notify).not.toHaveBeenCalled();
    history.undo();
    expect(palette.value.map((s) => s.id)).toEqual(["s0", "s1", "s2"]);
  });

  it("at 12 it does nothing but announce the limit", () => {
    palette.value = Array.from({ length: MAX_SWATCHES }, (_, i) =>
      createSwatch(hexToOklab("#808080"), { id: `t${i}` }),
    );
    selectedSwatchId.value = "t0";
    const before = palette.value;
    const notify = vi.fn();
    duplicateSelected(notify);
    expect(palette.value).toBe(before);
    expect(notify).toHaveBeenCalledWith(FULL_MESSAGE);
    expect(history.canUndo.value).toBe(false);
  });

  it("with nothing selected it does nothing", () => {
    selectedSwatchId.value = null;
    const before = palette.value;
    duplicateSelected(vi.fn());
    expect(palette.value).toBe(before);
  });
});
