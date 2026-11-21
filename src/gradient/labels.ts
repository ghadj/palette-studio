/** The names the gradient UI shows (spec 4; plan M4-T2). Shared so the rows and the sheets agree. */
import type { GradientType, InterpolationSpace, TechniqueKind } from "../types";

export const TYPE_LABELS: Record<GradientType, string> = {
  linear: "Linear",
  radial: "Radial",
  conic: "Conic",
};

export const SPACE_LABELS: Record<InterpolationSpace, string> = {
  srgb: "sRGB",
  "srgb-linear": "Linear sRGB",
  "display-p3": "Display-P3",
  lab: "Lab",
  oklab: "OKLab",
  lch: "LCH",
  oklch: "OKLCH",
  hsl: "HSL",
  hwb: "HWB",
  xyz: "XYZ",
};

export const TECHNIQUE_LABELS: Record<TechniqueKind, string> = {
  "palette-order": "Palette order",
  sorted: "Sorted",
  "smooth-path": "Smooth path",
  "image-sample": "Image sample",
  derived: "Derived",
  random: "Random",
  population: "Population-weighted",
};
