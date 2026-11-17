import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hexToOklab, oklchToHex } from "../../src/color/convert";
import { SPEC_DEFAULT_SETTINGS } from "../../src/state/defaults";
import { buildMockupState, parseMockupParams } from "../../src/state/mockup";

const HEXES = ["#E8693A", "#1DB07A", "#14386B", "#D4527F", "#1E8A2E", "#5039B0"];
const POINTS = [
  [0.204, 0.519],
  [0.463, 0.241],
  [0.769, 0.167],
  [0.38, 0.796],
  [0.889, 0.778],
  [0.102, 0.185],
];

describe("mockup state (mockup-state.md)", () => {
  const state = buildMockupState();

  it("fixture has the six mockup-state hexes in order with their points", () => {
    expect(state.name).toBe("Harbor mural");
    expect(state.project.palette.map((s) => oklchToHex(s.color))).toEqual(HEXES);
    expect(state.project.palette.map((s) => [s.point?.x, s.point?.y])).toEqual(POINTS);
    expect(state.project.image).toEqual({ name: "mockup-scene.png", width: 1600, height: 800 });
    // The stored OKLCH is the exact color of each hex, not a rounded approximation.
    for (const [i, swatch] of state.project.palette.entries()) {
      expect(swatch.color.l).toBeCloseTo(hexToOklab(HEXES[i] ?? "").l, 12);
    }
  });

  it("all six are origin extracted, unlocked, default sample radius", () => {
    for (const swatch of state.project.palette) {
      expect(swatch.origin).toBe("extracted");
      expect(swatch.locked).toBe(false);
      expect(swatch.sampleRadius).toBe("auto");
      expect(swatch.alpha).toBe(1);
    }
    expect(new Set(state.project.palette.map((s) => s.id)).size).toBe(6);
  });

  it("swatch 3 is selected", () => {
    expect(state.selectedSwatchId).toBe(state.project.palette[2]?.id);
  });

  it("settings are Balanced, 6 colors, OKLab, all else at 2.4 defaults", () => {
    expect(state.project.settings).toEqual({
      ...SPEC_DEFAULT_SETTINGS,
      algorithm: "balanced",
      colors: 6,
      workingSpace: "oklab",
    });
    expect(SPEC_DEFAULT_SETTINGS).toMatchObject({
      algorithm: "balanced",
      colors: 6,
      workingSpace: "oklab",
      sampleSize: 256,
      resampling: "smooth",
      alphaCutoff: 128,
      mergeThreshold: 0.03,
      histogramBits: 5,
      iterations: 25,
      restarts: 3,
      seed: 1,
      sort: "population",
    });
  });

  it("tab=gradient&theme=dark parses; unknown params such as image=values are ignored, not errors", () => {
    expect(parseMockupParams("")).toBeNull();
    expect(parseMockupParams("?demo=other")).toBeNull();
    expect(parseMockupParams("?demo=mockup")).toEqual({
      view: "studio",
      tab: "source",
      theme: null,
    });
    expect(parseMockupParams("?demo=mockup&tab=gradient&theme=dark")).toEqual({
      view: "studio",
      tab: "gradient",
      theme: "dark",
    });
    expect(parseMockupParams("?demo=mockup&view=materials&tab=palette&theme=light")).toEqual({
      view: "materials",
      tab: "palette",
      theme: "light",
    });
    expect(
      parseMockupParams("?demo=mockup&image=values&grid=on&library=open&tab=bogus&theme=purple"),
    ).toEqual({ view: "studio", tab: "source", theme: null });
    expect(buildMockupState(parseMockupParams("?demo=mockup&tab=gradient")).activeTab).toBe(
      "gradient",
    );
  });

  it("nothing in src/state/mockup.ts imports storage code", () => {
    for (const file of ["mockup.ts", "mockup-fixture.ts"]) {
      const source = readFileSync(resolve(__dirname, "../../src/state", file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB|autosave|library/i);
      for (const [, path] of source.matchAll(/from\s+"([^"]+)"/g)) {
        expect(path).not.toMatch(/storage|autosave|library|theme/);
      }
    }
  });
});
