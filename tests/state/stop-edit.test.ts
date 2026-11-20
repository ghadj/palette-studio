import { beforeEach, describe, expect, it } from "vitest";
import { hexToOklab, hexToOklch, oklchToHex } from "../../src/color/convert";
import { createSwatch } from "../../src/palette/model";
import { DEFAULT_ADJUSTMENTS, DEFAULT_GRADIENT } from "../../src/state/defaults";
import { applyTechnique, effectiveStops, resolvedStops } from "../../src/state/gradient";
import * as history from "../../src/state/history";
import { removeSwatch } from "../../src/state/remove-swatch";
import { adjustments, gradient, palette, selectedStopId } from "../../src/state/signals";
import {
  fractionToUnit,
  linkSelectedStop,
  relinkSelectedStop,
  removeSelectedStop,
  selectedStopIndex,
  setSelectedAlpha,
  setSelectedColor,
  setSelectedHint,
  setSelectedLocked,
  setSelectedPosition,
  unitToFraction,
} from "../../src/state/stop-edit";

const HEXES = ["#E8693A", "#1DB07A", "#14386B", "#D4527F", "#1E8A2E", "#5039B0"];
const stopsText = () => resolvedStops.value.map((s) => oklchToHex(s.color));

beforeEach(() => {
  palette.value = HEXES.map((hex, i) =>
    createSwatch(hexToOklab(hex), { id: `s${i + 1}`, population: 1 / 6 }),
  );
  adjustments.value = { ...DEFAULT_ADJUSTMENTS };
  // Palette order over swatches 2, 4 and 6, as the mockup fixture has it.
  gradient.value = {
    ...DEFAULT_GRADIENT,
    technique: {
      ...DEFAULT_GRADIENT.technique,
      kind: "palette-order",
      colors: { ...DEFAULT_GRADIENT.technique.colors, mode: "picked", ids: ["s2", "s4", "s6"] },
    },
  };
  selectedStopId.value = "stop-s4";
  history.clear();
});

describe("stop row actions (plan M4-T8; spec 4.3)", () => {
  it("typing a color detaches the stop and sets Custom, as one step; Relink gives the swatch back", () => {
    expect(selectedStopIndex()).toBe(1);
    setSelectedColor(hexToOklch("#FF0000"));
    expect(stopsText()[1]).toBe("#FF0000");
    expect(gradient.value.custom).toBe(true);
    expect(relinkSelectedStop()).toBe(true);
    expect(stopsText()[1]).toBe("#D4527F");
    history.undo();
    expect(stopsText()[1]).toBe("#FF0000");
    history.undo();
    expect(stopsText()[1]).toBe("#D4527F");
    expect(gradient.value.custom).toBe(false);
  });

  it("an edit that changes nothing records nothing and doesn't set Custom", () => {
    setSelectedAlpha(1);
    setSelectedPosition(0.5);
    setSelectedHint(0.5);
    setSelectedLocked(false);
    expect(history.canUndo.value).toBe(false);
    expect(gradient.value.custom).toBe(false);
  });

  it("linking to another swatch changes the color and keeps the position", () => {
    linkSelectedStop("s1");
    expect(stopsText()[1]).toBe("#E8693A");
    expect(effectiveStops.value[1]?.position).toBe(0.5);
  });

  it("Relink is refused once the swatch is gone: the stop keeps its fixed color", () => {
    setSelectedColor(hexToOklch("#FF0000"));
    removeSwatch("s4");
    expect(relinkSelectedStop()).toBe(false);
    expect(stopsText()[1]).toBe("#FF0000");
  });

  it("a position past a neighbor re-sorts the stops; the stop keeps its id and selection", () => {
    selectedStopId.value = "stop-s2";
    setSelectedPosition(0.75);
    expect(effectiveStops.value.map((s) => s.id)).toEqual(["stop-s4", "stop-s2", "stop-s6"]);
    expect(selectedStopId.value).toBe("stop-s2");
    expect(selectedStopIndex()).toBe(1);
  });

  it("alpha and the midpoint are stored as fractions", () => {
    setSelectedAlpha(0.5);
    setSelectedHint(0.3);
    expect(effectiveStops.value[1]?.alpha).toBe(0.5);
    expect(effectiveStops.value[1]?.hint).toBe(0.3);
  });

  it("a locked stop can't be moved or removed and survives a rebuild", () => {
    setSelectedLocked(true);
    setSelectedPosition(0.2);
    expect(effectiveStops.value[1]?.position).toBe(0.5);
    expect(removeSelectedStop()).toBe(false);
    applyTechnique(gradient.value.technique);
    expect(effectiveStops.value.some((s) => s.id === "stop-s4" && s.locked)).toBe(true);
  });

  it("Remove is refused at 2 stops; otherwise it removes one and selects the next stop", () => {
    expect(removeSelectedStop()).toBe(true);
    expect(effectiveStops.value.map((s) => s.id)).toEqual(["stop-s2", "stop-s6"]);
    expect(selectedStopId.value).toBe("stop-s6");
    expect(removeSelectedStop()).toBe(false);
    expect(effectiveStops.value).toHaveLength(2);
  });
});

describe("position units (plan D3)", () => {
  it("converts between a fraction and % or px against the preview width", () => {
    expect(fractionToUnit(0.25, "%", 800)).toBe(25);
    expect(fractionToUnit(0.25, "px", 800)).toBe(200);
    expect(unitToFraction(25, "%", 800)).toBe(0.25);
    expect(unitToFraction(200, "px", 800)).toBe(0.25);
    expect(unitToFraction(1000, "px", 800)).toBe(1);
  });
});
