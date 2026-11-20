import { beforeEach, describe, expect, it } from "vitest";
import { hexToOklab, hexToOklch, oklchToHex } from "../../src/color/convert";
import { makeStop, moveStop, setLocked } from "../../src/gradient/model";
import { createSwatch, moveSwatch } from "../../src/palette/model";
import { DEFAULT_ADJUSTMENTS, DEFAULT_GRADIENT } from "../../src/state/defaults";
import {
  applyTechnique,
  editStops,
  effectiveStops,
  resetGradientForNewImage,
  resolvedStops,
  setGradient,
} from "../../src/state/gradient";
import * as history from "../../src/state/history";
import { removeSwatch } from "../../src/state/remove-swatch";
import {
  adjustments,
  compareBefore,
  gradient,
  palette,
  selectedStopId,
} from "../../src/state/signals";

const HEXES = ["#E8693A", "#1DB07A", "#14386B", "#D4527F", "#1E8A2E", "#5039B0"];
const fixture = () =>
  HEXES.map((hex, i) => createSwatch(hexToOklab(hex), { id: `s${i + 1}`, population: 1 / 6 }));
const hexList = () => resolvedStops.value.map((s) => oklchToHex(s.color));

beforeEach(() => {
  palette.value = fixture();
  adjustments.value = { ...DEFAULT_ADJUSTMENTS };
  compareBefore.value = false;
  gradient.value = {
    ...DEFAULT_GRADIENT,
    technique: { ...DEFAULT_GRADIENT.technique, kind: "palette-order" },
  };
  selectedStopId.value = null;
  history.clear();
});

describe("gradient state (plan M4-T1; spec 4.3, 3.6)", () => {
  it("live, Palette order + All: adding a swatch adds a stop; reordering the strip reorders the stops", () => {
    expect(effectiveStops.value).toHaveLength(6);
    expect(effectiveStops.value.map((s) => s.position)[5]).toBe(1);
    palette.value = [...palette.value, createSwatch(hexToOklab("#000000"), { id: "s7" })];
    expect(effectiveStops.value).toHaveLength(7);
    expect(hexList()[6]).toBe("#000000");
    palette.value = moveSwatch(palette.value, 0, 6);
    expect(hexList()).toEqual([...HEXES.slice(1), "#000000", HEXES[0]]);
    // The stops are not stored while live.
    expect(gradient.value.custom).toBe(false);
    expect(gradient.value.stops).toEqual([]);
  });

  it("an edit to swatch 4's color changes the 50% stop (palette edits flow, 4.3)", () => {
    gradient.value = {
      ...gradient.value,
      technique: {
        ...gradient.value.technique,
        colors: { mode: "picked", count: 3, ids: ["s2", "s4", "s6"] },
      },
    };
    expect(hexList()).toEqual(["#1DB07A", "#D4527F", "#5039B0"]);
    palette.value = palette.value.map((s) =>
      s.id === "s4" ? { ...s, color: hexToOklch("#112233") } : s,
    );
    expect(hexList()[1]).toBe("#112233");
  });

  it("Lightness +0.1 changes the resolved colors; compare-before shows the base colors", () => {
    const before = hexList();
    adjustments.value = { ...DEFAULT_ADJUSTMENTS, lightness: 0.1 };
    const after = hexList();
    expect(after).not.toEqual(before);
    compareBefore.value = true;
    expect(hexList()).toEqual(before);
  });

  it("moving a stop sets custom, keeps the stops and is one undo step", () => {
    const stops = effectiveStops.value;
    const id = stops[2]?.id ?? "";
    editStops((list) => moveStop(list, id, 0.3), "Move stop");
    expect(gradient.value.custom).toBe(true);
    expect(gradient.value.stops).toHaveLength(6);
    expect(gradient.value.stops.find((s) => s.id === id)?.position).toBe(0.3);
    expect(history.undoLabel.value).toBe("Move stop");
    // Later palette edits no longer rebuild the stops.
    palette.value = [...palette.value, createSwatch(hexToOklab("#000000"), { id: "s7" })];
    expect(effectiveStops.value).toHaveLength(6);
    history.undo();
    expect(gradient.value.custom).toBe(false);
    expect(history.canUndo.value).toBe(false);
  });

  it("an edit that changes nothing records nothing", () => {
    editStops((list) => list, "Move stop");
    expect(gradient.value.custom).toBe(false);
    expect(history.canUndo.value).toBe(false);
  });

  it("custom: deleting swatch 4 makes its stop a fixed #D4527F in the same undo step; Undo relinks it", () => {
    editStops((list) => moveStop(list, list[0]?.id ?? "", 0.02), "Move stop");
    history.clear();
    const stop4 = effectiveStops.value.find(
      (s) => s.color.kind === "swatch" && s.color.id === "s4",
    );
    removeSwatch("s4");
    const after = effectiveStops.value.find((s) => s.id === stop4?.id);
    expect(after?.color).toMatchObject({ kind: "value", from: "s4" });
    expect(hexList()).toContain("#D4527F");
    expect(effectiveStops.value).toHaveLength(6);
    expect(history.undoLabel.value).toBe("Delete");
    history.undo();
    expect(palette.value).toHaveLength(6);
    expect(effectiveStops.value.find((s) => s.id === stop4?.id)?.color).toEqual({
      kind: "swatch",
      id: "s4",
    });
  });

  it("applyTechnique keeps a locked stop at its position and color", () => {
    editStops(
      (list) => setLocked(moveStop(list, list[1]?.id ?? "", 0.37), list[1]?.id ?? "", true),
      "Lock stop",
    );
    const locked = effectiveStops.value.find((s) => s.locked);
    expect(locked?.position).toBe(0.37);
    const lockedHex = hexList()[effectiveStops.value.indexOf(locked as never)];
    applyTechnique({ ...gradient.value.technique, kind: "palette-order" });
    expect(gradient.value.custom).toBe(false);
    const now = effectiveStops.value.find((s) => s.locked);
    expect(now?.position).toBe(0.37);
    expect(hexList()[effectiveStops.value.indexOf(now as never)]).toBe(lockedHex);
    // Generated stops within 1% of it are dropped; the rest are rebuilt.
    expect(effectiveStops.value.length).toBeGreaterThanOrEqual(6);
    expect(history.undoLabel.value).toBe("Technique");
  });

  it("a new image returns a custom gradient to its technique", () => {
    editStops(
      (list) => [
        ...list,
        makeStop(0.5, { kind: "value", color: hexToOklch("#000000"), from: null }),
      ],
      "Add stop",
    );
    selectedStopId.value = "x";
    resetGradientForNewImage();
    expect(gradient.value.custom).toBe(false);
    expect(gradient.value.stops).toEqual([]);
    expect(selectedStopId.value).toBeNull();
  });

  it("setGradient is one undo step", () => {
    setGradient({ type: "radial" }, "Gradient type");
    expect(gradient.value.type).toBe("radial");
    expect(history.undoLabel.value).toBe("Gradient type");
    history.undo();
    expect(gradient.value.type).toBe("linear");
  });
});
