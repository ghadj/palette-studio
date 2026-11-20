/**
 * The screens (M1 onward, despite the list's name), shared by the token conformance test and the
 * accessibility test (visual-testing.md). A screen joins this list in the milestone that builds
 * it; M3-T2 registered all of M3's at once.
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
/** Desktop screens with an open row in a column, tall enough that the column doesn't scroll. */
const TALL_DESKTOP = { width: 1280, height: 1280 };

export const M1_SCREENS: readonly Screen[] = [
  {
    name: "studio-desktop",
    path: "./?demo=mockup&view=studio",
    viewport: DESKTOP,
    device: "desktop",
  },
  // M2-T7: the Advanced row open, with every Advanced setting.
  {
    name: "advanced-desktop",
    path: "./?demo=mockup&rows=advanced",
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
    name: "pixel-filters-desktop",
    path: "./?demo=mockup&rows=filters",
    viewport: DESKTOP,
    device: "desktop",
  },
  {
    name: "pixel-filters-phone",
    path: "./?demo=mockup&rows=filters",
    viewport: PHONE,
    device: "phone",
  },
  // M3 (plan "Screens affected"), registered by M3-T2 so token and axe tests cover each screen
  // from the start. The tasks that build them fill them in; no task edits this list.
  // Desktop: each Palette-column row open in place (`rows=`), the loupe, and the image views.
  ...(
    [
      ["swatch-desktop", "rows=swatch"],
      ["adjustments-desktop", "rows=adjustments"],
      ["contrast-desktop", "rows=contrast"],
      ["cvd-desktop", "rows=cvd"],
      ["ramp-desktop", "rows=ramp"],
      ["loupe-desktop", "loupe=3"],
      ["palette-view-desktop", "image=palette"],
      ["values-view-desktop", "image=values"],
    ] as const
  ).map(
    ([name, query]): Screen => ({
      name,
      path: `./?demo=mockup&${query}`,
      viewport: DESKTOP,
      device: "desktop",
    }),
  ),
  // Phone: the Source tab's image views and loupe, and each Palette-tab bottom sheet open.
  ...(
    [
      ["palette-view-phone", "image=palette"],
      ["values-phone", "image=values"],
      ["loupe-phone", "loupe=3"],
      ["swatch-sheet-phone", "tab=palette&rows=swatch"],
      ["adjustments-sheet-phone", "tab=palette&rows=adjustments"],
      ["ramp-sheet-phone", "tab=palette&rows=ramp"],
      ["contrast-sheet-phone", "tab=palette&rows=contrast"],
      ["cvd-sheet-phone", "tab=palette&rows=cvd"],
    ] as const
  ).map(
    ([name, query]): Screen => ({
      name,
      path: `./?demo=mockup&${query}`,
      viewport: PHONE,
      device: "phone",
    }),
  ),
  // M4 (plan "Screens affected"), registered by M4-T2 so token and axe tests cover each screen from
  // the start. The tasks that build them fill them in; no task edits this list.
  // Desktop: column 3's rows open in place (`rows=`), the gradient types and the
  // technique parameters.
  ...(
    [
      ["interp-options-desktop", "rows=interpolation&space=oklch", TALL_DESKTOP],
      ["gradient-stop-desktop", "rows=stop", TALL_DESKTOP],
      ["gradient-geometry-desktop", "rows=geometry", TALL_DESKTOP],
      ["gradient-radial-desktop", "gradient=radial&rows=geometry", TALL_DESKTOP],
      ["gradient-technique-desktop", "technique=image-sample", TALL_DESKTOP],
      ["gradient-conic-desktop", "gradient=conic", DESKTOP],
    ] as const
  ).map(
    ([name, query, viewport]): Screen => ({
      name,
      path: `./?demo=mockup&${query}`,
      viewport,
      device: "desktop",
    }),
  ),
  // Phone: each Gradient-tab drawer open below the pinned preview and stop bar, and the technique.
  ...(
    [
      ["interp-options-sheet-phone", "rows=interpolation&space=oklch"],
      ["stop-sheet-phone", "rows=stop"],
      ["geometry-sheet-phone", "rows=geometry"],
      ["gradient-technique-phone", "technique=image-sample"],
    ] as const
  ).map(
    ([name, query]): Screen => ({
      name,
      path: `./?demo=mockup&tab=gradient&${query}`,
      viewport: PHONE,
      device: "phone",
    }),
  ),
  {
    name: "gradient-tablet",
    path: "./?demo=mockup&tab=gradient",
    viewport: TABLET,
    device: "tablet",
  },
];

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
