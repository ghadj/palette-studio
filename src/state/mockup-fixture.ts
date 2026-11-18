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

/** Swatch 3 is selected (zero-based index 2). */
export const MOCKUP_SELECTED_INDEX = 2;
