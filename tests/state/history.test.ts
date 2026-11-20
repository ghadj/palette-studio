import { beforeEach, describe, expect, it } from "vitest";
import { hexToOklab } from "../../src/color/convert";
import { fitView } from "../../src/image/viewport";
import { createSwatch } from "../../src/palette/model";
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_GRADIENT,
  DEFAULT_GRADIENT_PREVIEW,
  DEFAULT_SETTINGS,
} from "../../src/state/defaults";
import { effectiveStops } from "../../src/state/gradient";
import {
  begin,
  canRedo,
  canUndo,
  clear,
  commit,
  end,
  HISTORY_LIMIT,
  redo,
  redoLabel,
  undo,
  undoLabel,
} from "../../src/state/history";
import {
  activeTab,
  adjustments,
  compareBefore,
  gradient,
  gradientPreview,
  imageView,
  markersVisible,
  palette,
  selectedStopId,
  selectedSwatchId,
  settings,
  surround,
  updateSwatch,
  viewSettings,
} from "../../src/state/signals";

const swatches = (...hexes: string[]) =>
  hexes.map((hex) => createSwatch(hexToOklab(hex), { population: 1 / hexes.length }));

describe("history (spec 3.6; plan Q3a, D16)", () => {
  beforeEach(() => {
    palette.value = swatches("#E8693A", "#1DB07A", "#14386B");
    adjustments.value = { ...DEFAULT_ADJUSTMENTS };
    settings.value = { ...DEFAULT_SETTINGS };
    gradient.value = { ...DEFAULT_GRADIENT };
    selectedStopId.value = null;
    gradientPreview.value = { ...DEFAULT_GRADIENT_PREVIEW };
    surround.value = "theme";
    clear();
  });

  it("starts with nothing to undo or redo", () => {
    expect(canUndo.value).toBe(false);
    expect(canRedo.value).toBe(false);
    expect(undoLabel.value).toBeNull();
    expect(redoLabel.value).toBeNull();
  });

  it("51 commits keep the last 50", () => {
    expect(HISTORY_LIMIT).toBe(50);
    for (let i = 1; i <= 51; i += 1) {
      settings.value = { ...settings.peek(), seed: i + 1 };
      commit(`Seed ${i}`);
    }
    let undone = 0;
    while (canUndo.value) {
      undo();
      undone += 1;
    }
    expect(undone).toBe(50);
    // The oldest step (seed 1 → 2) fell off, so undo stops at seed 2.
    expect(settings.value.seed).toBe(2);
  });

  it("undo restores palette, adjustments and settings; redo re-applies them", () => {
    const before = {
      palette: palette.value,
      adjustments: adjustments.value,
      settings: settings.value,
    };
    palette.value = swatches("#D4527F");
    adjustments.value = { ...adjustments.peek(), lightness: 0.2 };
    settings.value = { ...settings.peek(), colors: 8 };
    const after = {
      palette: palette.value,
      adjustments: adjustments.value,
      settings: settings.value,
    };
    commit("Colors");
    expect(undoLabel.value).toBe("Colors");

    undo();
    expect(palette.value).toBe(before.palette);
    expect(adjustments.value).toBe(before.adjustments);
    expect(settings.value).toBe(before.settings);
    expect(canUndo.value).toBe(false);
    expect(redoLabel.value).toBe("Colors");

    redo();
    expect(palette.value).toBe(after.palette);
    expect(adjustments.value).toBe(after.adjustments);
    expect(settings.value).toBe(after.settings);
    expect(undoLabel.value).toBe("Colors");
    expect(canRedo.value).toBe(false);
  });

  it("a commit after undo clears redo", () => {
    settings.value = { ...settings.peek(), colors: 8 };
    commit("Colors");
    undo();
    expect(canRedo.value).toBe(true);
    settings.value = { ...settings.peek(), seed: 7 };
    commit("Seed");
    expect(canRedo.value).toBe(false);
    expect(undoLabel.value).toBe("Seed");
  });

  it("begin/end around 30 updates gives one step", () => {
    const start = palette.value;
    const id = start[0]?.id ?? "";
    begin();
    for (let i = 1; i <= 30; i += 1) {
      updateSwatch(id, { point: { x: i / 100, y: 0.5 } });
      commit("Move marker");
    }
    expect(canUndo.value).toBe(false);
    end();
    expect(undoLabel.value).toBe("Move marker");
    undo();
    expect(palette.value).toBe(start);
    expect(canUndo.value).toBe(false);

    // Without commits inside, end(label) records the step.
    begin();
    for (let i = 1; i <= 30; i += 1) updateSwatch(id, { point: { x: i / 100, y: 0.2 } });
    end("Move marker");
    undo();
    expect(palette.value).toBe(start);
    expect(canUndo.value).toBe(false);
  });

  it("a commit with nothing changed records no step", () => {
    commit("Nothing");
    expect(canUndo.value).toBe(false);
    begin();
    end("Nothing");
    expect(canUndo.value).toBe(false);
  });

  it("undo leaves selectedSwatchId, activeTab, imageView, viewSettings, markersVisible and compareBefore unchanged (3.6)", () => {
    const id = palette.value[1]?.id ?? "";
    updateSwatch(id, { locked: true });
    commit("Lock");
    selectedSwatchId.value = id;
    activeTab.value = "palette";
    imageView.value = { scale: 2, x: 0.1, y: 0.2 };
    viewSettings.value = { ...viewSettings.peek(), mode: "values", bands: 3 };
    markersVisible.value = false;
    compareBefore.value = true;
    const view = {
      selected: selectedSwatchId.value,
      tab: activeTab.value,
      image: imageView.value,
      viewSettings: viewSettings.value,
      markers: markersVisible.value,
      compare: compareBefore.value,
    };
    undo();
    expect(palette.value[1]?.locked).toBe(false);
    redo();
    expect(palette.value[1]?.locked).toBe(true);
    expect({
      selected: selectedSwatchId.value,
      tab: activeTab.value,
      image: imageView.value,
      viewSettings: viewSettings.value,
      markers: markersVisible.value,
      compare: compareBefore.value,
    }).toEqual(view);
    expect(imageView.value).toBe(view.image);
    expect(viewSettings.value).toBe(view.viewSettings);
    imageView.value = fitView();
    activeTab.value = "source";
    compareBefore.value = false;
    markersVisible.value = true;
  });

  it("clear() empties both stacks", () => {
    settings.value = { ...settings.peek(), colors: 8 };
    commit("Colors");
    settings.value = { ...settings.peek(), colors: 9 };
    commit("Colors");
    undo();
    expect(canUndo.value).toBe(true);
    expect(canRedo.value).toBe(true);
    clear();
    expect(canUndo.value).toBe(false);
    expect(canRedo.value).toBe(false);
    expect(undoLabel.value).toBeNull();
    expect(redoLabel.value).toBeNull();
  });

  it("undo restores the gradient (M4 plan T1)", () => {
    gradient.value = { ...gradient.value, type: "conic" };
    commit("Gradient type");
    expect(undoLabel.value).toBe("Gradient type");
    undo();
    expect(gradient.value.type).toBe("linear");
    redo();
    expect(gradient.value.type).toBe("conic");
  });

  it("undo leaves selectedStopId, gradientPreview and surround unchanged", () => {
    gradient.value = { ...gradient.value, type: "radial" };
    commit("Gradient type");
    const stopId = effectiveStops.value[1]?.id ?? "";
    expect(stopId).not.toBe("");
    selectedStopId.value = stopId;
    const preview = { ...DEFAULT_GRADIENT_PREVIEW, aspect: "16:9" as const };
    gradientPreview.value = preview;
    surround.value = "black";
    undo();
    expect(selectedStopId.value).toBe(stopId);
    expect(gradientPreview.value).toBe(preview);
    expect(surround.value).toBe("black");
    redo();
    expect(selectedStopId.value).toBe(stopId);
  });

  it("a selected stop that the restored gradient lacks falls back to the stop at the same position", () => {
    gradient.value = {
      ...gradient.value,
      technique: { ...gradient.value.technique, kind: "palette-order" },
    };
    commit("Technique");
    const ids = palette.value.map((s) => s.id);
    palette.value = palette.value.filter((s) => s.id !== ids[1]);
    commit("Delete");
    undo();
    // Redo removes swatch 2's stop; the stop that takes its place (index 1) is selected instead.
    selectedStopId.value = `stop-${ids[1]}`;
    redo();
    expect(selectedStopId.value).toBe(`stop-${ids[2]}`);
  });
});
