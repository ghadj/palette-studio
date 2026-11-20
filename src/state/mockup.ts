/**
 * The mockup state, ?demo=mockup (docs/design/mockup-state.md). It never reads or writes autosave,
 * the project library or any browser storage (spec 5.5), so nothing here imports storage code.
 * M1 reads the `view`, `tab` and `theme` parameters, M2 `rows` and `zoom`, and M3 more
 * `rows`, `image` and `loupe` (plan D20); the others are ignored until their milestone.
 */
import { hexToOklab, hexToOklch } from "../color/convert";
import type { CvdType } from "../color/cvd";
import { buildStops } from "../gradient/sources";
import { createSwatch } from "../palette/model";
import type {
  GradientPreviewSettings,
  GradientType,
  ImageViewMode,
  InterpolationSpace,
  PreviewAspect,
  Project,
  Surround,
  Tab,
  TechniqueKind,
  View,
} from "../types";
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_GRADIENT,
  DEFAULT_GRADIENT_PREVIEW,
  DEFAULT_VIEW_SETTINGS,
  SCHEMA_VERSION,
  SPEC_DEFAULT_SETTINGS,
} from "./defaults";
import {
  MOCKUP_GRADIENT_PICKS,
  MOCKUP_IMAGE,
  MOCKUP_POPULATIONS,
  MOCKUP_PROJECT_NAME,
  MOCKUP_SELECTED_INDEX,
  MOCKUP_SELECTED_STOP_POSITION,
  MOCKUP_SWATCHES,
} from "./mockup-fixture";

/**
 * Chevron rows the `rows` parameter can open: M2's Filters and Advanced under the image (M2
 * decision 14b), and M3's rows in the Palette column, plus the Ramp panel (plan D20). On phones
 * the M3 ones open as bottom sheets, so their shots use `tab=palette`.
 */
export type MockupRow =
  | "filters"
  | "advanced"
  | "swatch"
  | "adjustments"
  | "ramp"
  | "contrast"
  | "cvd"
  | "interpolation"
  | "stop"
  | "geometry"
  | "preview";
const ROWS: readonly MockupRow[] = [
  "filters",
  "advanced",
  "swatch",
  "adjustments",
  "ramp",
  "contrast",
  "cvd",
  "interpolation",
  "stop",
  "geometry",
  "preview",
];

/**
 * The gradient parameters (M4 plan D28, mockup-state.md "Gradient"); each is null when absent or
 * unknown. They are parsed apart from the others, as `parseMockupImage` is.
 */
export interface MockupGradientParams {
  /** `gradient=linear|radial|conic`. */
  type: GradientType | null;
  /** `space=<space>`: the interpolation space. */
  space: InterpolationSpace | null;
  /** `compare=<space>`: compare mode with that space. */
  compare: InterpolationSpace | null;
  /** `overlay=on`: the text check. */
  overlay: boolean;
  /** `cvd=<type>`: the vision simulation. */
  cvd: CvdType | null;
  /** `aspect=1:1|16:9|9:16|4:3|banner`. */
  aspect: Exclude<PreviewAspect, "free" | "custom"> | null;
  /** `surround=mid-gray|white|black`, for this page load only. */
  surround: Exclude<Surround, "theme"> | null;
  /** `technique=<kind>`: that technique with its defaults. */
  technique: TechniqueKind | null;
  /** `menu=theme`: the theme menu open. */
  menu: boolean;
}

const GRADIENT_TYPES: readonly GradientType[] = ["linear", "radial", "conic"];
const SPACES: readonly InterpolationSpace[] = [
  "srgb",
  "srgb-linear",
  "display-p3",
  "lab",
  "oklab",
  "lch",
  "oklch",
  "hsl",
  "hwb",
  "xyz",
];
const CVD_TYPES: readonly CvdType[] = ["protanopia", "deuteranopia", "tritanopia", "achromatopsia"];
const ASPECTS = ["1:1", "16:9", "9:16", "4:3", "banner"] as const;
const SURROUNDS = ["mid-gray", "white", "black"] as const;
const TECHNIQUES: readonly TechniqueKind[] = [
  "palette-order",
  "sorted",
  "smooth-path",
  "image-sample",
  "derived",
  "random",
  "population",
];

const NO_GRADIENT_PARAMS: MockupGradientParams = {
  type: null,
  space: null,
  compare: null,
  overlay: false,
  cvd: null,
  aspect: null,
  surround: null,
  technique: null,
  menu: false,
};

function option<T extends string>(value: string | null, options: readonly T[]): T | null {
  return options.find((o) => o === value) ?? null;
}

export function parseMockupGradient(search: string): MockupGradientParams {
  const params = new URLSearchParams(search);
  return {
    type: option(params.get("gradient"), GRADIENT_TYPES),
    space: option(params.get("space"), SPACES),
    compare: option(params.get("compare"), SPACES),
    overlay: params.get("overlay") === "on",
    cvd: option(params.get("cvd"), CVD_TYPES),
    aspect: option(params.get("aspect"), ASPECTS),
    surround: option(params.get("surround"), SURROUNDS),
    technique: option(params.get("technique"), TECHNIQUES),
    menu: params.get("menu") === "theme",
  };
}

export interface MockupParams {
  view: View;
  tab: Tab;
  theme: "light" | "dark" | null;
  /** Chevron rows open at load, from `rows=filters`, `rows=advanced` or both (comma-separated). */
  rows: MockupRow[];
}

export interface MockupState {
  name: string;
  project: Project;
  selectedSwatchId: string | null;
  /** The 50% stop of the fixture gradient (mockup-state.md "Gradient"). */
  selectedStopId: string | null;
  activeView: View;
  activeTab: Tab;
  openRows: MockupRow[];
  /** Gradient preview options, from `compare`, `overlay`, `cvd` and `aspect` (view state). */
  preview: GradientPreviewSettings;
  /** From `surround`; "theme" by default. Never stored (spec 5.5). */
  surround: Surround;
  /** True when `menu=theme` opens the theme menu. */
  themeMenuOpen: boolean;
}

const VIEWS: readonly View[] = ["studio", "materials"];
const TABS: readonly Tab[] = ["source", "palette", "gradient", "materials"];

function pick<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return options.find((o) => o === value) ?? fallback;
}

/** Returns the mockup parameters, or null when the page is not in the mockup state. */
export function parseMockupParams(search: string): MockupParams | null {
  const params = new URLSearchParams(search);
  if (params.get("demo") !== "mockup") return null;
  const theme = params.get("theme");
  return {
    view: pick(params.get("view"), VIEWS, "studio"),
    tab: pick(params.get("tab"), TABS, "source"),
    theme: theme === "light" || theme === "dark" ? theme : null,
    rows: ROWS.filter((r) => (params.get("rows") ?? "").split(",").includes(r)),
  };
}

export function buildMockupState(
  params: MockupParams | null = { view: "studio", tab: "source", theme: null, rows: [] },
  options: MockupGradientParams = NO_GRADIENT_PARAMS,
): MockupState {
  const palette = MOCKUP_SWATCHES.map(({ hex, point }, i) =>
    createSwatch(hexToOklab(hex), {
      id: `mockup-${i + 1}`,
      origin: "extracted",
      locked: false,
      pinned: false,
      sampleRadius: "auto",
      point: { ...point },
      population: MOCKUP_POPULATIONS[i] ?? 0,
      // The fixture swatches are extracted, so they can be reset to these (spec 3.7).
      extracted: { color: hexToOklch(hex), point: { ...point } },
    }),
  );
  // Linear 90°, OKLab, Smooth path over swatches 2, 4 and 6; live, so its stops aren't stored. The
  // `technique` parameter swaps that for the technique's defaults (mockup-state.md).
  const base = DEFAULT_GRADIENT.technique;
  const technique = options.technique
    ? {
        ...base,
        kind: options.technique,
        // Derived stops are made from swatch 3 (mockup-state.md).
        derive: { ...base.derive, from: palette[MOCKUP_SELECTED_INDEX]?.id ?? null },
      }
    : {
        ...base,
        kind: "smooth-path" as const,
        colors: {
          mode: "picked" as const,
          count: base.colors.count,
          ids: MOCKUP_GRADIENT_PICKS.flatMap((i) => palette[i]?.id ?? []),
        },
      };
  const gradient = {
    ...DEFAULT_GRADIENT,
    type: options.type ?? DEFAULT_GRADIENT.type,
    space: options.space ?? DEFAULT_GRADIENT.space,
    technique,
  };
  // The 50% stop, or the middle one when the technique has none there.
  const stops = buildStops(gradient.technique, palette);
  const selectedStop =
    stops.find((s) => s.position === MOCKUP_SELECTED_STOP_POSITION) ??
    stops[Math.floor(stops.length / 2)];
  return {
    name: MOCKUP_PROJECT_NAME,
    project: {
      schemaVersion: SCHEMA_VERSION,
      settings: {
        ...SPEC_DEFAULT_SETTINGS,
        algorithm: "balanced",
        colors: 6,
        workingSpace: "oklab",
      },
      palette,
      adjustments: { ...DEFAULT_ADJUSTMENTS },
      image: { ...MOCKUP_IMAGE },
      view: { ...DEFAULT_VIEW_SETTINGS },
      gradient,
    },
    selectedSwatchId: palette[MOCKUP_SELECTED_INDEX]?.id ?? null,
    selectedStopId: selectedStop?.id ?? null,
    activeView: params?.view ?? "studio",
    activeTab: params?.tab ?? "source",
    openRows: [...(params?.rows ?? [])],
    preview: {
      ...DEFAULT_GRADIENT_PREVIEW,
      aspect: options.aspect ?? DEFAULT_GRADIENT_PREVIEW.aspect,
      compare: options.compare,
      overlay: { ...DEFAULT_GRADIENT_PREVIEW.overlay, on: options.overlay },
      cvd: options.cvd ?? DEFAULT_GRADIENT_PREVIEW.cvd,
    },
    surround: options.surround ?? "theme",
    themeMenuOpen: options.menu,
  };
}

/** `zoom=<2|4|8>` opens the image at that zoom, centered (M2 decision 15g); anything else is Fit. */
export function parseMockupZoom(search: string): 1 | 2 | 4 | 8 {
  const zoom = new URLSearchParams(search).get("zoom");
  return zoom === "2" ? 2 : zoom === "4" ? 4 : zoom === "8" ? 8 : 1;
}

const IMAGE_VIEWS: readonly ImageViewMode[] = ["image", "palette", "values"];

/** `image=image|palette|values` opens that image view (spec 3.8); anything else is the Image view. */
export function parseMockupImage(search: string): ImageViewMode {
  return pick(new URLSearchParams(search).get("image"), IMAGE_VIEWS, "image");
}

/**
 * `loupe=<1 to 6>` shows the loupe over that swatch's marker, as a drag does (spec 3.7, plan D20).
 * Returns the swatch's palette index, or null for no loupe.
 */
export function parseMockupLoupe(search: string): number | null {
  const n = ["1", "2", "3", "4", "5", "6"].indexOf(new URLSearchParams(search).get("loupe") ?? "");
  return n < 0 ? null : n;
}
