/**
 * The M1 screens, shared by the token conformance test, the accessibility test and the visual
 * review (visual-testing.md). A screen joins this list in the milestone that builds it.
 */
/** "tablet" screens use the tabbed phone layout, wider (decision 4 as revised). */
export type Device = "desktop" | "tablet" | "phone";

export interface Screen {
  name: string;
  /** Relative to the base URL. */
  path: string;
  viewport: { width: number; height: number };
  device: Device;
}

const DESKTOP = { width: 1280, height: 800 };
const TABLET = { width: 820, height: 1180 };
const PHONE = { width: 390, height: 844 };

export const M1_SCREENS: readonly Screen[] = [
  {
    name: "studio-desktop",
    path: "./?demo=mockup&view=studio",
    viewport: DESKTOP,
    device: "desktop",
  },
  { name: "studio-tablet", path: "./?demo=mockup&view=studio", viewport: TABLET, device: "tablet" },
  { name: "source-phone", path: "./?demo=mockup&tab=source", viewport: PHONE, device: "phone" },
  { name: "palette-phone", path: "./?demo=mockup&tab=palette", viewport: PHONE, device: "phone" },
  { name: "gradient-phone", path: "./?demo=mockup&tab=gradient", viewport: PHONE, device: "phone" },
  {
    name: "materials-phone",
    path: "./?demo=mockup&tab=materials",
    viewport: PHONE,
    device: "phone",
  },
  // First visit, no image (spec 6.3): the drop zone with Choose image, Paste and the samples.
  { name: "empty-desktop", path: "./", viewport: DESKTOP, device: "desktop" },
  { name: "empty-tablet", path: "./", viewport: TABLET, device: "tablet" },
  { name: "empty-phone", path: "./", viewport: PHONE, device: "phone" },
  // M2: the image at 200%, centered, with the zoom controls (decision 15g).
  { name: "zoom-desktop", path: "./?demo=mockup&zoom=2", viewport: DESKTOP, device: "desktop" },
  { name: "zoom-phone", path: "./?demo=mockup&zoom=2", viewport: PHONE, device: "phone" },
  // M2-T8: the Filters row open (mockup-state `rows=filters`).
  {
    name: "filters-desktop",
    path: "./?demo=mockup&rows=filters",
    viewport: DESKTOP,
    device: "desktop",
  },
  { name: "filters-phone", path: "./?demo=mockup&rows=filters", viewport: PHONE, device: "phone" },
];

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
