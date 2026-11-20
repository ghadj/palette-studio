import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hexToOklab, oklchToHex } from "../../src/color/convert";
import { resolveStops } from "../../src/gradient/model";
import { buildStops } from "../../src/gradient/sources";
import { SPEC_DEFAULT_SETTINGS } from "../../src/state/defaults";
import {
  buildMockupState,
  parseMockupGradient,
  parseMockupImage,
  parseMockupLoupe,
  parseMockupParams,
} from "../../src/state/mockup";

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

  it("the fixture gradient is linear at 90°, in OKLab, Smooth path over picked swatches 2, 4 and 6, not custom, with the 50% stop selected", () => {
    const g = state.project.gradient;
    expect(g.type).toBe("linear");
    expect(g.geometry).toMatchObject({
      angle: 90,
      shape: "ellipse",
      size: "farthest-corner",
      center: { x: 0.5, y: 0.5 },
      from: 0,
      reverse: false,
      mirror: false,
    });
    expect(g.space).toBe("oklab");
    expect(g.technique.kind).toBe("smooth-path");
    expect(g.technique.colors).toMatchObject({
      mode: "picked",
      ids: ["mockup-2", "mockup-4", "mockup-6"],
    });
    expect(g.custom).toBe(false);
    expect(g.stops).toEqual([]);
    expect(g.easing.kind).toBe("linear");
    expect(g.premultiplied).toBe(true);
    expect(g.gamut).toBe("chroma");
    const stops = buildStops(g.technique, state.project.palette);
    expect(stops.map((s) => s.position)).toEqual([0, 0.5, 1]);
    expect(state.selectedStopId).toBe(stops[1]?.id);
    const resolved = resolveStops(g, stops, state.project.palette);
    expect(resolved.map((s) => oklchToHex(s.color))).toEqual(["#1DB07A", "#D4527F", "#5039B0"]);
    expect(resolved.every((s) => s.alpha === 1 && s.hint === 0.5)).toBe(true);
  });

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
      expect(swatch.pinned).toBe(false);
      expect(swatch.sampleRadius).toBe("auto");
      expect(swatch.alpha).toBe(1);
    }
    expect(new Set(state.project.palette.map((s) => s.id)).size).toBe(6);
  });

  it("fixture populations are 0.832, 0.147, 0.005 × 4, normalized to sum 1, in swatch order 2, 1, 3 to 6", () => {
    const raw = [0.147, 0.832, 0.005, 0.005, 0.005, 0.005];
    const total = raw.reduce((a, b) => a + b, 0);
    const populations = state.project.palette.map((s) => s.population);
    for (const [i, p] of populations.entries()) {
      expect(p, `swatch ${i + 1}`).toBeCloseTo((raw[i] ?? 0) / total, 12);
    }
    expect(Math.abs(populations.reduce((a, b) => a + b, 0) - 1)).toBeLessThan(1e-12);
    // Swatch 2 holds the most, then swatch 1, then the four patches equally.
    expect(populations[1]).toBeGreaterThan(populations[0] ?? 1);
    expect(new Set(populations.slice(2)).size).toBe(1);
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
      rows: [],
    });
    expect(parseMockupParams("?demo=mockup&tab=gradient&theme=dark")).toEqual({
      view: "studio",
      tab: "gradient",
      theme: "dark",
      rows: [],
    });
    expect(parseMockupParams("?demo=mockup&view=materials&tab=palette&theme=light")).toEqual({
      view: "materials",
      tab: "palette",
      theme: "light",
      rows: [],
    });
    expect(
      parseMockupParams("?demo=mockup&image=values&grid=on&library=open&tab=bogus&theme=purple"),
    ).toEqual({ view: "studio", tab: "source", theme: null, rows: [] });
    expect(buildMockupState(parseMockupParams("?demo=mockup&tab=gradient")).activeTab).toBe(
      "gradient",
    );
  });

  it("rows=filters opens the Filters row; unknown rows are ignored (M2-T8)", () => {
    expect(parseMockupParams("?demo=mockup&rows=filters")?.rows).toEqual(["filters"]);
    expect(parseMockupParams("?demo=mockup&rows=bogus")?.rows).toEqual([]);
    expect(buildMockupState(parseMockupParams("?demo=mockup&rows=filters")).openRows).toEqual([
      "filters",
    ]);
    expect(buildMockupState().openRows).toEqual([]);
  });

  it("rows=advanced opens the Advanced row; rows can be combined (M2-T7)", () => {
    expect(parseMockupParams("?demo=mockup&rows=advanced")?.rows).toEqual(["advanced"]);
    expect(buildMockupState(parseMockupParams("?demo=mockup&rows=advanced")).openRows).toEqual([
      "advanced",
    ]);
    expect(parseMockupParams("?demo=mockup&rows=filters,advanced")?.rows).toEqual([
      "filters",
      "advanced",
    ]);
    expect(buildMockupState(parseMockupParams("?demo=mockup")).openRows).toEqual([]);
    expect(buildMockupState().openRows).toEqual([]);
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

describe("M3 mockup parameters (plan D20, M3-T2)", () => {
  it("parses rows=adjustments, image=values, loupe=3", () => {
    const search = "?demo=mockup&rows=adjustments&image=values&loupe=3";
    expect(parseMockupParams(search)?.rows).toEqual(["adjustments"]);
    expect(buildMockupState(parseMockupParams(search)).openRows).toEqual(["adjustments"]);
    expect(parseMockupImage(search)).toBe("values");
    // The loupe shows over swatch 3's marker: zero-based palette index 2.
    expect(parseMockupLoupe(search)).toBe(2);
    // Every M3 row, combined with M2's.
    expect(
      parseMockupParams("?demo=mockup&rows=swatch,adjustments,ramp,contrast,cvd,filters")?.rows,
    ).toEqual(["filters", "swatch", "adjustments", "ramp", "contrast", "cvd"]);
    expect(parseMockupImage("?demo=mockup&image=palette")).toBe("palette");
    expect(parseMockupImage("?demo=mockup&image=image")).toBe("image");
    expect(parseMockupLoupe("?demo=mockup&loupe=1")).toBe(0);
    expect(parseMockupLoupe("?demo=mockup&loupe=6")).toBe(5);
  });

  it("ignores unknown values", () => {
    expect(parseMockupParams("?demo=mockup&rows=bogus,ramps,Swatch")?.rows).toEqual([]);
    expect(parseMockupImage("?demo=mockup")).toBe("image");
    expect(parseMockupImage("?demo=mockup&image=grid")).toBe("image");
    expect(parseMockupImage("?demo=mockup&image=Values")).toBe("image");
    for (const loupe of ["", "0", "7", "3.5", "x", "-1"]) {
      expect(parseMockupLoupe(`?demo=mockup&loupe=${loupe}`), loupe).toBeNull();
    }
    expect(parseMockupLoupe("?demo=mockup")).toBeNull();
    // The M1 parameters keep their shape: image and loupe have their own parsers.
    expect(parseMockupParams("?demo=mockup&image=values&loupe=3")).toEqual({
      view: "studio",
      tab: "source",
      theme: null,
      rows: [],
    });
  });
});

describe("mockup state gradient parameters (M4 plan D28)", () => {
  const all =
    "?demo=mockup&gradient=conic&space=oklch&rows=interpolation,stop,geometry&compare=oklch&overlay=on&cvd=deuteranopia&aspect=16:9&technique=image-sample&menu=theme";

  it("parses gradient=conic, space=oklch, rows=interpolation,stop,geometry, compare=oklch, overlay=on, cvd=deuteranopia, aspect=16:9, technique=image-sample, menu=theme", () => {
    expect(parseMockupGradient(all)).toEqual({
      type: "conic",
      space: "oklch",
      compare: "oklch",
      overlay: true,
      cvd: "deuteranopia",
      aspect: "16:9",
      technique: "image-sample",
      menu: true,
    });
    const params = parseMockupParams(all);
    expect(params?.rows).toEqual(["interpolation", "stop", "geometry"]);
    const state = buildMockupState(params, parseMockupGradient(all));
    expect(state.project.gradient.type).toBe("conic");
    expect(state.project.gradient.space).toBe("oklch");
    expect(state.project.gradient.technique.kind).toBe("image-sample");
    expect(state.preview).toMatchObject({
      aspect: "16:9",
      compare: "oklch",
      overlay: { on: true, color: "white" },
      cvd: "deuteranopia",
    });
    expect(state.themeMenuOpen).toBe(true);
    expect(state.openRows).toEqual(["interpolation", "stop", "geometry"]);
  });

  it("rows=preview is a known row, and technique=derived uses swatch 3", () => {
    expect(parseMockupParams("?demo=mockup&rows=preview")?.rows).toEqual(["preview"]);
    const state = buildMockupState(
      parseMockupParams("?demo=mockup&technique=derived"),
      parseMockupGradient("?demo=mockup&technique=derived"),
    );
    expect(state.project.gradient.technique.derive.from).toBe(state.project.palette[2]?.id);
    expect(state.project.gradient.technique.colors.mode).toBe("all");
  });

  it("ignores unknown values", () => {
    const params =
      "?demo=mockup&gradient=mesh&space=cmyk&compare=x&overlay=off&cvd=none&aspect=2:1&technique=magic&menu=library&rows=nope";
    expect(parseMockupGradient(params)).toEqual({
      type: null,
      space: null,
      compare: null,
      overlay: false,
      cvd: null,
      aspect: null,
      technique: null,
      menu: false,
    });
    const state = buildMockupState(parseMockupParams(params), parseMockupGradient(params));
    expect(state.project.gradient.type).toBe("linear");
    expect(state.project.gradient.space).toBe("oklab");
    expect(state.project.gradient.technique.kind).toBe("smooth-path");
    expect(state.preview.aspect).toBe("free");
    expect(state.openRows).toEqual([]);
  });

  it("no parameters give the fixture: linear, OKLab, no preview options", () => {
    const state = buildMockupState(
      parseMockupParams("?demo=mockup"),
      parseMockupGradient("?demo=mockup"),
    );
    expect(state.preview).toMatchObject({ aspect: "free", compare: null, cvd: "normal" });
    expect(state.preview.overlay.on).toBe(false);
    expect(state.themeMenuOpen).toBe(false);
  });
});
