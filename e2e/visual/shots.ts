/**
 * The M1 screenshot list (visual-testing.md section 2). Each shot is taken in light and dark.
 * A shot joins the list in the milestone that builds its screen. No Playwright imports here, so
 * tools/visual-review.ts can read the list too.
 */
export interface Shot {
  name: string;
  /** Relative to the base URL. */
  path: string;
  viewport: { width: number; height: number };
  /** Mockup files in docs/mockups, or null for "contract text (not drawn)". */
  mockup: { light: string; dark: string } | null;
  /** Which part of the mockup to compare with, such as "left phone". */
  frame: string;
}

const DESKTOP = { width: 1280, height: 800 };
const TABLET = { width: 820, height: 1180 };
const PHONE = { width: 390, height: 844 };
/** Desktop shots with an open row in a column, tall enough that the column doesn't scroll. */
const TALL_DESKTOP = { width: 1280, height: 1280 };

export const M1_SHOTS: readonly Shot[] = [
  {
    name: "studio-desktop",
    path: "./?demo=mockup&view=studio",
    viewport: DESKTOP,
    mockup: { light: "01-studio-light.png", dark: "02-studio-dark.png" },
    frame:
      "Whole frame. The header has Export where the mockup has Share, and there is no export bar under the columns (D10). Column 2 has the chevron rows and the Lock and Ramp pills (M3-T2); markers, hint, L/C/H and HEX arrive in later M3 tasks, gradient controls in M4.",
  },
  {
    // M2-T7. Taller than the other desktop shots, so the open Advanced rows fit in column 1
    // without scrolling it.
    name: "advanced-desktop",
    path: "./?demo=mockup&rows=advanced",
    viewport: { width: 1280, height: 1280 },
    mockup: null,
    frame:
      "Not drawn. Column 1 item 4 with the Advanced chevron row open: Sample size, Resampling, Seed, Iterations, Restarts, Histogram bits, Merge threshold, Distance metric, Population vs. vividness, Keep one outlier (Toggle) and Sort.",
  },
  {
    name: "source-phone",
    path: "./?demo=mockup&tab=source",
    viewport: PHONE,
    mockup: { light: "09-mobile-light.png", dark: "10-mobile-dark.png" },
    frame: "Left phone. M1 has no markers or hint.",
  },
  {
    name: "palette-phone",
    path: "./?demo=mockup&tab=palette",
    viewport: PHONE,
    mockup: null,
    frame:
      "ui-contract Phone, Palette tab (not drawn): the strip, label, editor row (Lock, Ramp) and the chevron rows Swatch, Adjustments, Contrast and CVD, which open sheets.",
  },
  {
    name: "gradient-phone",
    path: "./?demo=mockup&tab=gradient",
    viewport: PHONE,
    mockup: { light: "09-mobile-light.png", dark: "10-mobile-dark.png" },
    frame: "Middle phone. M1 shows a one-line hint; gradients arrive in M4.",
  },
  {
    name: "studio-tablet",
    path: "./?demo=mockup&view=studio",
    viewport: TABLET,
    mockup: null,
    frame: "Decision 4 as revised (fix L1): the phone layout, wider, with the panel centered.",
  },
  {
    name: "empty-desktop",
    path: "./",
    viewport: DESKTOP,
    mockup: null,
    frame: "First visit, no image (spec 6.3).",
  },
  {
    name: "empty-phone",
    path: "./",
    viewport: PHONE,
    mockup: null,
    frame: "First visit, no image (spec 6.3).",
  },
  // M2 (decision 15g): zoom is not drawn; the controls go to design review.
  {
    name: "zoom-desktop",
    path: "./?demo=mockup&zoom=2",
    viewport: DESKTOP,
    mockup: null,
    frame:
      "M2 decision 15: the image at 200%, centered; Zoom out, Zoom in and Fit in the toolbar row under the well.",
  },
  {
    name: "zoom-phone",
    path: "./?demo=mockup&zoom=2",
    viewport: PHONE,
    mockup: null,
    frame: "M2 decision 15: the image at 200%, centered; zoom controls at 44 px (not drawn).",
  },
  // M2-T8: the Filters row is not drawn; it goes to design review (M2 plan, Screens affected).
  {
    name: "pixel-filters-desktop",
    path: "./?demo=mockup&rows=filters",
    viewport: DESKTOP,
    mockup: null,
    frame: "M2 decision 2b: the Filters chevron row after Working space, open.",
  },
  {
    name: "pixel-filters-phone",
    path: "./?demo=mockup&rows=filters",
    // Tall enough to show the Filters rows below the pinned strip.
    viewport: { width: PHONE.width, height: 1100 },
    mockup: null,
    frame: "M2 decision 2b: the Filters chevron row on the Source tab, open.",
  },
  // M2-T14: the cluster overlay and the share label are not drawn; they go to design review.
  {
    name: "cluster-map-desktop",
    path: "./?demo=mockup&cluster=3",
    viewport: DESKTOP,
    mockup: null,
    frame:
      "M2 decision 13: swatch 3's cluster map over the image (other pixels dimmed toward mid-gray, about 70%) and 'Swatch 3 · 0.5% of the image' in the selection label (not drawn).",
  },
  {
    name: "cluster-map-phone",
    path: "./?demo=mockup&cluster=3",
    viewport: PHONE,
    mockup: null,
    frame:
      "M2 decision 13: the Source tab with swatch 3's cluster map over the image (not drawn). The Cluster map toggle is in swatch-sheet-phone (13d).",
  },
  // M3 (plan "Screens affected"), registered by M3-T2. Until a shot's task lands it shows that
  // task's stub ("Coming in a later version"). The desktop row shots are taller, so the open row
  // fits in column 2 without scrolling it, as advanced-desktop does for column 1.
  {
    name: "swatch-desktop",
    path: "./?demo=mockup&rows=swatch",
    viewport: TALL_DESKTOP,
    mockup: null,
    frame:
      "Not drawn (M3 decision 5a). Column 2 with the Swatch chevron row open in place: formats, Name with its suggestion, Copy, Duplicate, Delete, Reset to extracted, Sample radius, Mean or Median, Cluster map.",
  },
  {
    name: "adjustments-desktop",
    path: "./?demo=mockup&rows=adjustments",
    viewport: TALL_DESKTOP,
    mockup: null,
    frame:
      "Not drawn. Column 2 item 5 with the Adjustments row open in place: one slider per adjustment (spec 3.3, plan D1), Even out, Harmonize, Gamut, Reset and Compare.",
  },
  {
    name: "contrast-desktop",
    path: "./?demo=mockup&rows=contrast",
    viewport: TALL_DESKTOP,
    mockup: null,
    frame:
      "Not drawn. Column 2 item 5 with the Contrast row open in place: the 6 × 6 WCAG matrix with text badges and the close pairs (spec 3.5, M3 decision 6c).",
  },
  {
    name: "cvd-desktop",
    path: "./?demo=mockup&rows=cvd",
    viewport: TALL_DESKTOP,
    mockup: null,
    frame:
      "Not drawn. Column 2 item 5 with the CVD row open in place: Normal plus one labelled strip per type (spec 3.5, plan D6).",
  },
  {
    name: "ramp-desktop",
    path: "./?demo=mockup&rows=ramp",
    viewport: TALL_DESKTOP,
    mockup: null,
    frame:
      "Not drawn. The Ramp panel under the editor row: 11 steps 50 to 950 and the harmonies (spec 3.4, plan D4, D5).",
  },
  {
    name: "loupe-desktop",
    path: "./?demo=mockup&loupe=3",
    viewport: DESKTOP,
    mockup: { light: "01-studio-light.png", dark: "02-studio-dark.png" },
    frame:
      "Column 1 item 1, markers as drawn; the loupe over marker 3 (8×, crosshair, #14386B) is not drawn (contract Components 'Marker', dragging).",
  },
  {
    name: "palette-view-desktop",
    path: "./?demo=mockup&image=palette",
    viewport: DESKTOP,
    mockup: { light: "03-image-views-light.png", dark: "04-image-views-dark.png" },
    frame: "Left column: the Palette view, area-share bar, legend, Colors from and Dither.",
  },
  {
    name: "values-view-desktop",
    path: "./?demo=mockup&image=values",
    viewport: DESKTOP,
    mockup: { light: "03-image-views-light.png", dark: "04-image-views-dark.png" },
    frame:
      "Middle column: the Values view, band strip, Bands and Close in value rows; corner dots on the flagged swatches and the legend in column 2 (D8).",
  },
  {
    name: "palette-view-phone",
    path: "./?demo=mockup&image=palette",
    viewport: PHONE,
    mockup: { light: "11-mobile-features-light.png", dark: "12-mobile-features-dark.png" },
    frame: "Middle phone: the Source tab in the Palette view.",
  },
  {
    name: "values-phone",
    path: "./?demo=mockup&image=values",
    viewport: PHONE,
    mockup: { light: "11-mobile-features-light.png", dark: "12-mobile-features-dark.png" },
    frame:
      "Left phone without the grid (M5): gray bands, corner dots and the legend for the close pair on the strip, Bands and Close in value (D8).",
  },
  {
    name: "loupe-phone",
    path: "./?demo=mockup&loupe=3",
    viewport: PHONE,
    mockup: { light: "09-mobile-light.png", dark: "10-mobile-dark.png" },
    frame:
      "Left phone, markers as drawn; the loupe above marker 3 is not drawn (contract Components 'Marker', dragging).",
  },
  {
    name: "swatch-sheet-phone",
    path: "./?demo=mockup&tab=palette&rows=swatch",
    viewport: PHONE,
    mockup: null,
    frame:
      "Not drawn (contract 'Not drawn': bottom sheets for the swatch editor). The Swatch sheet over the Palette tab, with the Cluster map toggle (M2 decision 13d).",
  },
  {
    name: "adjustments-sheet-phone",
    path: "./?demo=mockup&tab=palette&rows=adjustments",
    viewport: PHONE,
    mockup: null,
    frame: "Not drawn. The Adjustments sheet over the Palette tab (spec 6.1).",
  },
  {
    name: "ramp-sheet-phone",
    path: "./?demo=mockup&tab=palette&rows=ramp",
    viewport: PHONE,
    mockup: null,
    frame: "Not drawn. The Ramp sheet over the Palette tab (spec 6.1).",
  },
  {
    name: "contrast-sheet-phone",
    path: "./?demo=mockup&tab=palette&rows=contrast",
    viewport: PHONE,
    mockup: null,
    frame: "Not drawn. The Contrast sheet over the Palette tab.",
  },
  {
    name: "cvd-sheet-phone",
    path: "./?demo=mockup&tab=palette&rows=cvd",
    viewport: PHONE,
    mockup: null,
    frame: "Not drawn. The CVD sheet over the Palette tab.",
  },
];

export const SHOT_THEMES = ["light", "dark"] as const;
export type ShotTheme = (typeof SHOT_THEMES)[number];

export const shotFile = (shot: Shot, theme: ShotTheme): string => `${shot.name}-${theme}.png`;
