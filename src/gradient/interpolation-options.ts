/**
 * The Interpolation options (plan M4-T9, Q4, D24): which options differ from their defaults, which
 * rows apply, and the one-step reset-all. Pure, so the header's count and the rows agree.
 */
import { DEFAULT_GRADIENT } from "../state/defaults";
import type { Gradient, GradientStop, InterpolationSpace } from "../types";

/** The spaces with a hue channel: the Hue row applies to these only (spec 4.3). */
export const POLAR_SPACES: readonly InterpolationSpace[] = ["lch", "oklch", "hsl", "hwb"];

export const isPolar = (space: InterpolationSpace): boolean => POLAR_SPACES.includes(space);

export type OptionKey = "hue" | "easing" | "premultiplied" | "gamut";

type Options = Pick<Gradient, "hue" | "easing" | "premultiplied" | "gamut">;

const D = DEFAULT_GRADIENT;

/** True when the option differs from its default. Easing counts its bezier fields too. */
export function optionDiffers(key: OptionKey, g: Options): boolean {
  switch (key) {
    case "hue":
      return g.hue !== D.hue;
    case "easing":
      return (
        g.easing.kind !== D.easing.kind || g.easing.bezier.some((v, i) => v !== D.easing.bezier[i])
      );
    case "premultiplied":
      return g.premultiplied !== D.premultiplied;
    case "gamut":
      return g.gamut !== D.gamut;
  }
}

const KEYS: readonly OptionKey[] = ["hue", "easing", "premultiplied", "gamut"];

/** Every option that differs, including those whose row is hidden (so reset-all clears them all). */
export function changedOptions(g: Options): OptionKey[] {
  return KEYS.filter((k) => optionDiffers(k, g));
}

/** The patch that returns one option to its default. */
export function optionReset(key: OptionKey): Partial<Options> {
  switch (key) {
    case "hue":
      return { hue: D.hue };
    case "easing":
      return { easing: { kind: D.easing.kind, bezier: [...D.easing.bezier] } };
    case "premultiplied":
      return { premultiplied: D.premultiplied };
    case "gamut":
      return { gamut: D.gamut };
  }
}

/** The patch that returns every option to its default. */
export function resetAllPatch(): Options {
  return Object.assign({}, ...KEYS.map(optionReset)) as Options;
}

/** The Premultiplied row shows only while a stop is translucent. */
export const hasTranslucentStop = (stops: readonly Pick<GradientStop, "alpha">[]): boolean =>
  stops.some((s) => s.alpha < 1);
