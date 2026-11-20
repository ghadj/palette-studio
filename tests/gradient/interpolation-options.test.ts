import { describe, expect, it } from "vitest";
import {
  changedOptions,
  hasTranslucentStop,
  isPolar,
  optionDiffers,
  resetAllPatch,
} from "../../src/gradient/interpolation-options";
import { DEFAULT_GRADIENT } from "../../src/state/defaults";
import type { InterpolationSpace } from "../../src/types";

const g = DEFAULT_GRADIENT;

describe("interpolation options", () => {
  it("counts nothing at the defaults", () => {
    expect(changedOptions(g)).toEqual([]);
  });

  it("counts Hue, Easing, Premultiplied and Gamut separately", () => {
    const all = { ...g, hue: "longer", premultiplied: false, gamut: "clamp" } as const;
    const easing = { kind: "ease-in", bezier: g.easing.bezier } as const;
    expect(changedOptions({ ...all, easing })).toEqual(["hue", "easing", "premultiplied", "gamut"]);
  });

  it("counts a changed bezier as Easing even while the kind is Linear", () => {
    const easing = { kind: "linear", bezier: [0, 0, 1, 1] } as const;
    expect(optionDiffers("easing", { ...g, easing: { ...easing, bezier: [0, 0, 1, 1] } })).toBe(
      true,
    );
  });

  it("reset-all returns every counted option to its default", () => {
    const changed = { ...g, hue: "longer", gamut: "clamp" } as const;
    const next = { ...changed, ...resetAllPatch() };
    expect(changedOptions(next)).toEqual([]);
    expect(next.easing).toEqual(g.easing);
  });

  it("knows the polar spaces", () => {
    const polar: InterpolationSpace[] = ["lch", "oklch", "hsl", "hwb"];
    const rect: InterpolationSpace[] = ["oklab", "lab", "srgb", "xyz", "display-p3", "srgb-linear"];
    expect(polar.every(isPolar)).toBe(true);
    expect(rect.some(isPolar)).toBe(false);
  });

  it("detects a translucent stop", () => {
    expect(hasTranslucentStop([{ alpha: 1 }, { alpha: 1 }])).toBe(false);
    expect(hasTranslucentStop([{ alpha: 1 }, { alpha: 0.5 }])).toBe(true);
  });
});
