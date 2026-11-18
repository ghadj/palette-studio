import { effect } from "@preact/signals";
import { describe, expect, it } from "vitest";
import { buildMockupState } from "../../src/state/mockup";
import {
  activeTab,
  imageMeta,
  loadProject,
  palette,
  projectName,
  schemaVersion,
  selectedSwatchId,
  settings,
  updateSwatch,
} from "../../src/state/signals";

describe("signals store (spec 7.1, 7.5)", () => {
  it("loading a project sets every field signal", () => {
    const state = buildMockupState();
    loadProject(state.project, state.name);
    expect(schemaVersion.value).toBe(state.project.schemaVersion);
    expect(settings.value).toEqual(state.project.settings);
    expect(palette.value).toEqual(state.project.palette);
    expect(imageMeta.value).toEqual(state.project.image);
    expect(projectName.value).toBe("Harbor mural");
    // A loaded project selects nothing until told to; the mockup state then selects swatch 3.
    expect(selectedSwatchId.value).toBeNull();
    expect(activeTab.value).toBe("source");
  });

  it("changing one swatch notifies only subscribers of the palette signal, not of settings", () => {
    const state = buildMockupState();
    loadProject(state.project, state.name);
    let paletteRuns = 0;
    let settingsRuns = 0;
    let imageRuns = 0;
    const stops = [
      effect(() => {
        palette.value;
        paletteRuns += 1;
      }),
      effect(() => {
        settings.value;
        settingsRuns += 1;
      }),
      effect(() => {
        imageMeta.value;
        imageRuns += 1;
      }),
    ];
    const id = palette.value[1]?.id ?? "";
    updateSwatch(id, { locked: true });
    expect(palette.value[1]?.locked).toBe(true);
    expect(palette.value[0]).toBe(state.project.palette[0]);
    expect(paletteRuns).toBe(2);
    expect(settingsRuns).toBe(1);
    expect(imageRuns).toBe(1);
    for (const stop of stops) stop();
  });
});
