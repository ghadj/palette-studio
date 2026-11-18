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
];

export const SHOT_THEMES = ["light", "dark"] as const;
export type ShotTheme = (typeof SHOT_THEMES)[number];

export const shotFile = (shot: Shot, theme: ShotTheme): string => `${shot.name}-${theme}.png`;
