/**
 * The ten interpolation spaces of spec 4.3, by their CSS names, as coordinates (M4-T3).
 *
 * culori is imported from `culori/fn`, and only the modes the spaces need are registered, so the rest
 * of culori is tree-shaken (spec 7.7):
 * - `srgb` rgb, `srgb-linear` lrgb, `display-p3` p3
 * - `lab` and `lch`: CIELAB and CIELCh relative to D50, as CSS Color 4 defines them (culori's `lab`
 *   and `lch`; `lab65` in `src/color/convert.ts` is a different space)
 * - `oklab`, `oklch`, `hsl`, `hwb`
 * - `xyz`: CSS `xyz` is `xyz-d65` (culori's `xyz65`)
 *
 * Powerless hue (CSS Color 4 §4.4, §12.2; plan D11). A hue is "missing" when its color is
 * achromatic, and interpolation then carries the other stop's hue. Float error makes "achromatic" a
 * threshold, not an equality: culori turns #FFFFFF into hsl(324 -125% 100%) and #808080 into an LCH
 * chroma of 6e-6 with an arbitrary hue. The thresholds:
 * - OKLCH chroma ≤ 4e-6 (`OKLCH_EPSILON`) and CIELCh chroma ≤ 0.0015 (`LCH_EPSILON`), the values in
 *   the CSS Color 4 sample code (`OKLab_to_OKLCH`, `Lab_to_LCH`). An input whose OKLCH chroma is under
 *   the threshold is achromatic in every polar space.
 * - HSL and HWB: an achromatic input becomes exact gray coordinates, hsl(none 0% L) and
 *   hwb(none W 1−W), with L and W the mean of its sRGB channels. Otherwise the hue is missing only when
 *   HSL saturation is 0 or HWB whiteness plus blackness reaches 1 (CSS Color 4 §7, §8).
 * Chromium's own thresholds could not be checked offline. Grays from HEX input sit far below every
 * threshold (OKLCH chroma 0 in culori), so the choice only matters for colors within 4e-6 of gray,
 * where a different hue is invisible.
 */
import {
  converter,
  modeHsl,
  modeHwb,
  modeLab,
  modeLch,
  modeLrgb,
  modeOklab,
  modeOklch,
  modeP3,
  modeRgb,
  modeXyz65,
  useMode,
} from "culori/fn";
import type { Oklab, Oklch } from "../color/convert";
import type { InterpolationSpace } from "../types";

useMode(modeRgb);
useMode(modeLrgb);
useMode(modeP3);
useMode(modeLab);
useMode(modeLch);
useMode(modeOklab);
useMode(modeOklch);
useMode(modeHsl);
useMode(modeHwb);
useMode(modeXyz65);

/** OKLCH chroma at or below which a hue is powerless (CSS Color 4 sample code, `OKLab_to_OKLCH`). */
export const OKLCH_EPSILON = 4e-6;
/** CIELCh (D50) chroma at or below which a hue is powerless (CSS Color 4 sample code, `Lab_to_LCH`). */
export const LCH_EPSILON = 0.0015;

type Mode = "rgb" | "lrgb" | "p3" | "lab" | "lch" | "oklab" | "oklch" | "hsl" | "hwb" | "xyz65";

interface SpaceInfo {
  mode: Mode;
  /** The culori channel names, in coordinate order. */
  channels: readonly [string, string, string];
  /** The index of the hue coordinate, or -1 for a rectangular space. */
  hue: number;
}

const SPACES: Record<InterpolationSpace, SpaceInfo> = {
  srgb: { mode: "rgb", channels: ["r", "g", "b"], hue: -1 },
  "srgb-linear": { mode: "lrgb", channels: ["r", "g", "b"], hue: -1 },
  "display-p3": { mode: "p3", channels: ["r", "g", "b"], hue: -1 },
  lab: { mode: "lab", channels: ["l", "a", "b"], hue: -1 },
  oklab: { mode: "oklab", channels: ["l", "a", "b"], hue: -1 },
  lch: { mode: "lch", channels: ["l", "c", "h"], hue: 2 },
  oklch: { mode: "oklch", channels: ["l", "c", "h"], hue: 2 },
  hsl: { mode: "hsl", channels: ["h", "s", "l"], hue: 0 },
  hwb: { mode: "hwb", channels: ["h", "w", "b"], hue: 0 },
  xyz: { mode: "xyz65", channels: ["x", "y", "z"], hue: -1 },
};

/** A color in an interpolation space: three coordinates, and whether the hue (if any) is missing. */
export interface SpaceColor {
  coords: [number, number, number];
  /** True when the space is polar and the hue is powerless. Its coordinate is then 0. */
  hueMissing: boolean;
}

type Channels = Record<string, number | undefined>;

const converters = Object.fromEntries(
  (Object.keys(SPACES) as InterpolationSpace[]).map((space) => [
    space,
    converter(SPACES[space].mode),
  ]),
) as Record<InterpolationSpace, ReturnType<typeof converter>>;
const toOklab = converter("oklab");
const toRgb = converter("rgb");

/** The index of the hue coordinate in `space`, or -1 for a rectangular space. */
export function hueIndex(space: InterpolationSpace): number {
  return SPACES[space].hue;
}

/** The gray value of an achromatic color: the mean of its sRGB channels. */
function grayOf(color: Oklch): number {
  const rgb = toRgb({ mode: "oklch", l: color.l, c: color.c, h: color.h });
  return (rgb.r + rgb.g + rgb.b) / 3;
}

/** `color` (OKLCH) as coordinates of `space`. */
export function toSpace(color: Oklch, space: InterpolationSpace): SpaceColor {
  const info = SPACES[space];
  const achromatic = color.c <= OKLCH_EPSILON;
  if (space === "oklch") {
    return { coords: [color.l, color.c, achromatic ? 0 : color.h], hueMissing: achromatic };
  }
  if (achromatic && space === "hsl") return { coords: [0, 0, grayOf(color)], hueMissing: true };
  if (achromatic && space === "hwb") {
    const w = grayOf(color);
    return { coords: [0, w, 1 - w], hueMissing: true };
  }
  const out = converters[space]({
    mode: "oklch",
    l: color.l,
    c: color.c,
    h: color.h,
  }) as unknown as Channels;
  const [c0, c1, c2] = info.channels.map((name) => out[name] ?? 0) as [number, number, number];
  const coords: [number, number, number] = [c0, c1, c2];
  if (info.hue < 0) return { coords, hueMissing: false };
  let missing = achromatic || out.h === undefined;
  if (space === "lch") missing ||= c1 <= LCH_EPSILON;
  if (space === "hsl") missing ||= c1 === 0;
  if (space === "hwb") missing ||= c1 + c2 >= 1;
  if (missing) coords[info.hue] = 0;
  return { coords, hueMissing: missing };
}

/** Coordinates of `space` back to OKLab. The hue may be any angle. */
export function fromSpace(
  coords: readonly [number, number, number],
  space: InterpolationSpace,
): Oklab {
  const info = SPACES[space];
  if (space === "oklab") return { l: coords[0], a: coords[1], b: coords[2] };
  if (space === "oklch") {
    const h = (coords[2] * Math.PI) / 180;
    return { l: coords[0], a: coords[1] * Math.cos(h), b: coords[1] * Math.sin(h) };
  }
  const channels: Channels = {};
  info.channels.forEach((name, i) => {
    channels[name] = coords[i];
  });
  if (info.hue >= 0) channels.h = (((coords[info.hue] ?? 0) % 360) + 360) % 360;
  const color = { mode: info.mode, ...channels };
  const lab = toOklab(color as unknown as Parameters<typeof toOklab>[0]);
  if (!lab) throw new Error(`Cannot convert from ${space}`);
  return { l: lab.l, a: lab.a, b: lab.b };
}
