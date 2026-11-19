/**
 * The mockup state, ?demo=mockup (docs/design/mockup-state.md). It never reads or writes autosave,
 * the project library or any browser storage (spec 5.5), so nothing here imports storage code.
 * M1 reads the `view`, `tab` and `theme` parameters, M2 `rows`, `zoom` and `cluster`, and M3 more
 * `rows`, `image` and `loupe` (plan D20); the others are ignored until their milestone.
 */
import { hexToOklab, hexToOklch } from "../color/convert";
import { createSwatch } from "../palette/model";
import type { ImageViewMode, Project, Tab, View } from "../types";
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_VIEW_SETTINGS,
  SCHEMA_VERSION,
  SPEC_DEFAULT_SETTINGS,
} from "./defaults";
import {
  MOCKUP_IMAGE,
  MOCKUP_POPULATIONS,
  MOCKUP_PROJECT_NAME,
  MOCKUP_SELECTED_INDEX,
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
  | "cvd";
const ROWS: readonly MockupRow[] = [
  "filters",
  "advanced",
  "swatch",
  "adjustments",
  "ramp",
  "contrast",
  "cvd",
];

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
  activeView: View;
  activeTab: Tab;
  openRows: MockupRow[];
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
): MockupState {
  const palette = MOCKUP_SWATCHES.map(({ hex, point }, i) =>
    createSwatch(hexToOklab(hex), {
      id: `mockup-${i + 1}`,
      origin: "extracted",
      locked: false,
      sampleRadius: "auto",
      point: { ...point },
      population: MOCKUP_POPULATIONS[i] ?? 0,
      // The fixture swatches are extracted, so they can be reset to these (spec 3.7).
      extracted: { color: hexToOklch(hex), point: { ...point } },
    }),
  );
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
    },
    selectedSwatchId: palette[MOCKUP_SELECTED_INDEX]?.id ?? null,
    activeView: params?.view ?? "studio",
    activeTab: params?.tab ?? "source",
    openRows: [...(params?.rows ?? [])],
  };
}

/** `zoom=<2|4|8>` opens the image at that zoom, centered (M2 decision 15g); anything else is Fit. */
export function parseMockupZoom(search: string): 1 | 2 | 4 | 8 {
  const zoom = new URLSearchParams(search).get("zoom");
  return zoom === "2" ? 2 : zoom === "4" ? 4 : zoom === "8" ? 8 : 1;
}

/**
 * `cluster=<1 to 6>` shows that swatch's cluster map, as hovering or focusing it does (spec 2.6,
 * decision 14b). Returns the swatch's palette index, or null for no map.
 */
export function parseMockupCluster(search: string): number | null {
  const n = ["1", "2", "3", "4", "5", "6"].indexOf(
    new URLSearchParams(search).get("cluster") ?? "",
  );
  return n < 0 ? null : n;
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
