/**
 * The mockup state, ?demo=mockup (docs/design/mockup-state.md). It never reads or writes autosave,
 * the project library or any browser storage (spec 5.5), so nothing here imports storage code.
 * M1 reads the `view`, `tab` and `theme` parameters, and M2 `rows`; the others are ignored until
 * their milestone.
 */
import { hexToOklab } from "../color/convert";
import { createSwatch } from "../palette/model";
import type { Project, Tab, View } from "../types";
import { SCHEMA_VERSION, SPEC_DEFAULT_SETTINGS } from "./defaults";
import {
  MOCKUP_IMAGE,
  MOCKUP_POPULATIONS,
  MOCKUP_PROJECT_NAME,
  MOCKUP_SELECTED_INDEX,
  MOCKUP_SWATCHES,
} from "./mockup-fixture";

/** Chevron rows the `rows` parameter can open (M2 decision 14b). */
export type MockupRow = "filters" | "advanced";
const ROWS: readonly MockupRow[] = ["filters", "advanced"];

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
      image: { ...MOCKUP_IMAGE },
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
