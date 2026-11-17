/**
 * The M1 screens, shared by the token conformance test, the accessibility test and the visual
 * review (visual-testing.md). A screen joins this list in the milestone that builds it.
 */
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
];

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
