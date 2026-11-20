/**
 * The "Harbor mural" fixture from docs/design/mockup-state.md. It is loaded directly, without
 * running extraction, so screenshots don't change when the algorithms do.
 */
import type { ImageMeta, ImagePoint } from "../types";

export const MOCKUP_PROJECT_NAME = "Harbor mural";

export const MOCKUP_IMAGE: ImageMeta = { name: "mockup-scene.png", width: 1600, height: 800 };

/** Path of the fixture image, relative to the base URL. */
export const MOCKUP_IMAGE_PATH = "samples/mockup-scene.png";

export const MOCKUP_SWATCHES: ReadonlyArray<{ hex: string; point: ImagePoint }> = [
  { hex: "#E8693A", point: { x: 0.204, y: 0.519 } },
  { hex: "#1DB07A", point: { x: 0.463, y: 0.241 } },
  { hex: "#14386B", point: { x: 0.769, y: 0.167 } },
  { hex: "#D4527F", point: { x: 0.38, y: 0.796 } },
  { hex: "#1E8A2E", point: { x: 0.889, y: 0.778 } },
  { hex: "#5039B0", point: { x: 0.102, y: 0.185 } },
];

/**
 * Each swatch's population, in swatch order: the Palette-view area shares of mockup-state.md
 * (swatch 2 83.2%, swatch 1 14.7%, swatches 3 to 6 0.5% each), normalized to sum 1 (M2 decision
 * 14a). They are fixed, so screenshots don't depend on the cluster map.
 */
const RAW_POPULATIONS = [0.147, 0.832, 0.005, 0.005, 0.005, 0.005] as const;
const RAW_TOTAL = RAW_POPULATIONS.reduce((a, b) => a + b, 0);
export const MOCKUP_POPULATIONS: readonly number[] = RAW_POPULATIONS.map((p) => p / RAW_TOTAL);

/** Swatch 3 is selected (zero-based index 2). */
export const MOCKUP_SELECTED_INDEX = 2;

/**
 * The fixture gradient's swatches (mockup-state.md "Gradient"): Smooth path over swatches 2, 4 and
 * 6, as zero-based palette indexes. Its stops are the technique's output, not stored.
 */
export const MOCKUP_GRADIENT_PICKS: readonly number[] = [1, 3, 5];
/** The 50% stop is selected. */
export const MOCKUP_SELECTED_STOP_POSITION = 0.5;
