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

export const M1_SHOTS: readonly Shot[] = [
  {
    name: "studio-desktop",
    path: "./?demo=mockup&view=studio",
    viewport: DESKTOP,
    mockup: { light: "01-studio-light.png", dark: "02-studio-dark.png" },
    frame: "Whole frame. M1 has no markers, hint, editor, chevron rows or gradient controls.",
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
    frame: "ui-contract Phone, Palette tab. M1 has the swatch strip and selection label only.",
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
      "M2 decision 15: the image at 200%, centered; Zoom out, Zoom in and Fit in the well's bottom-right corner (not drawn).",
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
      "M2 decision 13: the Source tab with swatch 3's cluster map over the image (not drawn). The Cluster map toggle is in palette-phone.",
  },
];

export const SHOT_THEMES = ["light", "dark"] as const;
export type ShotTheme = (typeof SHOT_THEMES)[number];

export const shotFile = (shot: Shot, theme: ShotTheme): string => `${shot.name}-${theme}.png`;
