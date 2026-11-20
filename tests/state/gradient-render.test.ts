import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hexToOklab,
  hexToOklch,
  oklabToRgb,
  oklchToHex,
  oklchToOklab,
} from "../../src/color/convert";
import { bake } from "../../src/gradient/bake";
import { bakedCss, clearSupportsCache, nativeCss } from "../../src/gradient/css";
import { makeStop } from "../../src/gradient/model";
import { createSwatch } from "../../src/palette/model";
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_GRADIENT,
  DEFAULT_GRADIENT_PREVIEW,
} from "../../src/state/defaults";
import { colorAt, render } from "../../src/state/gradient-render";
import { resolvedStops } from "../../src/state/gradient-stops";
import {
  adjustments,
  compareBefore,
  gradient,
  gradientPreview,
  palette,
} from "../../src/state/signals";
import type { Gradient } from "../../src/types";

const value = (hex: string) => ({ kind: "value" as const, color: hexToOklch(hex), from: null });

/** A custom gradient of fixed stops: [hex, position, alpha?]. */
function custom(stops: Array<[string, number, number?]>, patch: Partial<Gradient> = {}): Gradient {
  return {
    ...DEFAULT_GRADIENT,
    custom: true,
    stops: stops.map(([hex, p, alpha]) => makeStop(p, value(hex), { alpha: alpha ?? 1 })),
    ...patch,
  };
}

beforeEach(() => {
  palette.value = ["#1DB07A", "#D4527F", "#5039B0"].map((hex, i) =>
    createSwatch(hexToOklab(hex), { id: `s${i + 1}`, population: 1 / 3 }),
  );
  adjustments.value = { ...DEFAULT_ADJUSTMENTS };
  compareBefore.value = false;
  gradientPreview.value = { ...DEFAULT_GRADIENT_PREVIEW };
  gradient.value = custom([
    ["#1DB07A", 0],
    ["#D4527F", 0.5],
    ["#5039B0", 1],
  ]);
  clearSupportsCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearSupportsCache();
});

describe("render state (spec 4.5; plan D10)", () => {
  it("mode is native, with the `in` clause, when CSS.supports accepts it", () => {
    vi.stubGlobal("CSS", { supports: () => true });
    gradient.value = { ...gradient.value };
    const r = render.value;
    expect(r.mode).toBe("native");
    expect(r.css).toBe("linear-gradient(90deg in oklab, #1DB07A 0%, #D4527F 50%, #5039B0 100%)");
    expect(r.outOfGamut).toBe(false);
    // The baked stops are always there: the gamut check, the vision simulation and the text check read them.
    expect(r.baked?.length).toBeGreaterThanOrEqual(16);
  });

  it("mode is baked when CSS.supports is stubbed to false", () => {
    vi.stubGlobal("CSS", { supports: () => false });
    gradient.value = { ...gradient.value };
    const r = render.value;
    expect(r.mode).toBe("baked");
    expect(r.css).toBe(bakedCss(r.baked ?? [], gradient.value));
    expect(r.css).not.toContain(" in ");
  });

  it("mode is baked when premultiplied is off and a stop has alpha", () => {
    vi.stubGlobal("CSS", { supports: () => true });
    gradient.value = custom(
      [
        ["#1DB07A", 0],
        ["#D4527F", 0.5, 0.5],
        ["#5039B0", 1],
      ],
      { premultiplied: false },
    );
    expect(render.value.mode).toBe("baked");
    gradient.value = { ...gradient.value, premultiplied: true };
    expect(render.value.mode).toBe("native");
    gradient.value = custom([
      ["#1DB07A", 0],
      ["#5039B0", 1],
    ]);
    gradient.value = { ...gradient.value, premultiplied: false };
    expect(render.value.mode).toBe("native");
  });

  it("reports outOfGamut for #FF0000→#00FF00 in OKLCH but not in OKLab", () => {
    vi.stubGlobal("CSS", { supports: () => true });
    gradient.value = custom(
      [
        ["#FF0000", 0],
        ["#00FF00", 1],
      ],
      { space: "oklch" },
    );
    expect(render.value.outOfGamut).toBe(true);
    gradient.value = { ...gradient.value, space: "oklab" };
    expect(render.value.outOfGamut).toBe(false);
  });

  it("compareCss renders the compare space, natively or baked", () => {
    vi.stubGlobal("CSS", { supports: () => true });
    gradientPreview.value = { ...DEFAULT_GRADIENT_PREVIEW, compare: "oklch" };
    expect(render.value.compareCss).toBe(nativeCss(resolvedStops.value, gradient.value, "oklch"));
    clearSupportsCache();
    vi.stubGlobal("CSS", { supports: () => false });
    gradient.value = { ...gradient.value };
    const g = gradient.value;
    expect(render.value.compareCss).toBe(
      bakedCss(bake(resolvedStops.value, { ...g, space: "oklch" }).stops, g),
    );
    gradientPreview.value = { ...DEFAULT_GRADIENT_PREVIEW };
    expect(render.value.compareCss).toBeNull();
  });

  it("no stops: no CSS", () => {
    palette.value = [];
    gradient.value = { ...DEFAULT_GRADIENT };
    expect(render.value.css).toBeNull();
    expect(render.value.baked).toBeNull();
  });
});

describe("colorAt (plan D4)", () => {
  it("is the interpolated color: the OKLab middle of #000000→#FFFFFF is #636363", () => {
    gradient.value = custom([
      ["#000000", 0],
      ["#FFFFFF", 1],
    ]);
    expect(oklchToHex(colorAt(0.5))).toBe("#636363");
    gradient.value = { ...gradient.value, space: "srgb" };
    const rgb = oklabToRgb(oklchToOklab(colorAt(0.5)));
    expect(rgb.r).toBeCloseTo(0.5, 6);
  });

  it("follows the easing and returns the stops at their positions", () => {
    gradient.value = custom(
      [
        ["#000000", 0],
        ["#FFFFFF", 1],
      ],
      { space: "srgb", easing: { kind: "ease-in", bezier: [0.25, 0.1, 0.25, 1] } },
    );
    expect(Math.abs(oklabToRgb(oklchToOklab(colorAt(0.5))).r - 0.315357)).toBeLessThan(1e-4);
    expect(oklchToHex(colorAt(0))).toBe("#000000");
    expect(oklchToHex(colorAt(1))).toBe("#FFFFFF");
  });

  it("is gamut-mapped, so a stop added there matches what the preview shows", () => {
    gradient.value = custom(
      [
        ["#FF0000", 0],
        ["#00FF00", 1],
      ],
      { space: "oklch" },
    );
    const rgb = oklabToRgb(oklchToOklab(colorAt(0.5)));
    for (const v of [rgb.r, rgb.g, rgb.b]) {
      expect(v).toBeGreaterThanOrEqual(-1e-6);
      expect(v).toBeLessThanOrEqual(1 + 1e-6);
    }
  });
});
