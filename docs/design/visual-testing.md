# Visual testing

Three layers keep the built UI matching the mockups:

1. **Token conformance tests** (automated, exact): the UI uses only design-token values.
2. **Mockup review** (evaluator, then you): screenshots in the mockup state are compared with `docs/mockups/` against `ui-contract.md`.
3. **Regression baselines** (automated, after your approval): approved screenshots become baselines, and later builds fail on unintended changes.

M1 sets up all three. Later milestones extend the screenshot list as screens appear.

## 1. Token conformance tests

A Playwright test, `e2e/tokens.spec.ts`, runs on every screen of the mockup state at desktop and phone widths, in both themes. For each rendered element outside user content (mark user content with `data-user-content`), it checks:

- **Colors:** computed `color`, `background-color` and `border-*-color` are one of the token colors for the active theme, or transparent.
  - Resolve each token by applying `var(--token)` to a hidden probe element and reading its computed color. Reading the custom property directly returns the unresolved `light-dark()` text.
- **Font sizes:** each is in {12, 13, 15, 16, 20} px.
- **Corner radii:** each is in {0, 6, 8, 10, 12} px or a pill.
- **Touch targets:** at phone width, every button, link, input, chip, tab and marker hit area is at least 44 × 44 px.

A failure names the element (a selector path) and the value that isn't a token. Fix it by using a token; never add the stray value to the allowed list.

## 2. Mockup review

### Screenshot list

| Shot | URL | Viewport | Compare with |
| --- | --- | --- | --- |
| studio-desktop | `?demo=mockup&view=studio` | 1280 × 800 | `01-studio-light.png`, `02-studio-dark.png` |
| advanced-desktop | `?demo=mockup&rows=advanced` | 1280 × 1280 | contract text (not drawn): the Advanced rows (M2-T7) |
| palette-view-desktop | `?demo=mockup&image=palette` | 1280 × 800 | `03`, `04` (left column) |
| values-view-desktop | `?demo=mockup&image=values` | 1280 × 800 | `03`, `04` (middle column) |
| grid-desktop | `?demo=mockup&grid=on` | 1280 × 800 | `03`, `04` (right column) |
| materials-desktop | `?demo=mockup&view=materials` | 1280 × 800 | `05-materials-light.png`, `06-materials-dark.png` |
| library-desktop | `?demo=mockup&library=menu` | 1280 × 800 | `07-library-light.png`, `08-library-dark.png` |
| source-phone | `?demo=mockup&tab=source` | 390 × 844 | `09`, `10` (left phone) |
| palette-phone | `?demo=mockup&tab=palette` | 390 × 844 | contract text (not drawn) |
| gradient-phone | `?demo=mockup&tab=gradient` | 390 × 844 | `09`, `10` (middle phone) |
| materials-phone | `?demo=mockup&tab=materials` | 390 × 844 | `09`, `10` (right phone) |
| values-grid-phone | `?demo=mockup&image=values&grid=on` | 390 × 844 | `11`, `12` (left phone) |
| palette-view-phone | `?demo=mockup&image=palette` | 390 × 844 | `11`, `12` (middle phone) |
| projects-phone | `?demo=mockup&library=undo` | 390 × 844 | `11`, `12` (right phone) |
| brands-phone | `?demo=mockup&tab=materials&brands=Brand%20A,Brand%20C` | 390 × 844 | `13`, `14` (left phone) |
| filters-all-phone | `?demo=mockup&tab=materials&filters=all` | 390 × 844 | `13`, `14` (middle phone) |
| filters-medium-phone | `?demo=mockup&tab=materials&filters=medium` | 390 × 844 | `13`, `14` (right phone) |
| studio-tablet | `?demo=mockup&view=studio` | 820 × 1180 | contract text (not drawn) |
| empty-desktop | `/` (fresh context, not the mockup state) | 1280 × 800 | contract text (not drawn): spec 6.3 "First visit, no image" |
| empty-phone | `/` (fresh context, not the mockup state) | 390 × 844 | contract text (not drawn): spec 6.3 "First visit, no image" |
| zoom-desktop | `?demo=mockup&zoom=2` | 1280 × 800 | contract text (not drawn): the image at 200%, centered, with the zoom controls (M2 decision 15) |
| zoom-phone | `?demo=mockup&zoom=2` | 390 × 844 | contract text (not drawn): as zoom-desktop, controls at 44 px (M2 decision 15) |
| cluster-map-desktop | `?demo=mockup&cluster=3` | 1280 × 800 | contract text (not drawn): swatch 3's cluster map over the image, other pixels dimmed toward mid-gray, and "Swatch 3 · 0.5% of the image" in the selection label (M2 decision 13) |
| cluster-map-phone | `?demo=mockup&cluster=3` | 390 × 844 | contract text (not drawn): as cluster-map-desktop, on the Source tab (M2 decision 13). The Cluster map toggle shows in palette-phone (13d) |
| pixel-filters-desktop | `?demo=mockup&rows=filters` | 1280 × 800 | contract text (not drawn): the Filters chevron row open after Working space (M2 decision 2b) |
| pixel-filters-phone | `?demo=mockup&rows=filters` | 390 × 844 | contract text (not drawn): as pixel-filters-desktop, on the Source tab (M2 decision 2b) |

Each shot is taken in light and dark, by setting the browser's color scheme. A shot joins the list in the milestone that builds its screen: the image views and grid in M3 and M5, the library in M5, the Materials view and filters with Part 2.

### Running it

`npm run visual:review` does three things:
1. Builds and previews the app.
2. Runs the `visual-review` Playwright project, which saves the screenshots to `artifacts/visual-review/` without asserting anything.
3. Writes `artifacts/visual-review/index.html`: one row per shot and theme, with the mockup and the build side by side. The page has a notes column, and a link to `ui-contract.md`.

`artifacts/` is gitignored. In CI it is uploaded as a build artifact on pull requests.

### What the evaluator checks, per shot

Work through the `ui-contract.md` section for that screen, region by region:
- Every region and component is present, in the contract's order.
- Proportions and alignment match: equal columns, gutters, edges lining up.
- Hierarchy matches: strong versus muted text, which item carries the accent.
- Selected states sit where the mockup state puts them.
- Dark mode keeps the same content colors (spec 6.2): the image, swatches, gradients, paint chips and grid lines don't change with the theme.
- Intended deviations D1 to D3 are applied, not flagged.

Report each difference with:
- the shot
- the region
- what the mockup shows and what the build shows
- severity: **blocking** if a region is missing, the order is wrong, or the layout breaks; **minor** otherwise

### Your sign-off

You open the review page and approve, or list changes. Approval is recorded in the milestone report, with the date and the shots approved.

## 3. Regression baselines

- The `visual` Playwright project compares each shot with `expect(page).toHaveScreenshot()`, with these settings:
  - animations disabled
  - caret hidden
  - `maxDiffPixelRatio: 0.002`
- **Fonts differ between operating systems.** Generate and compare baselines only in CI, inside the official Playwright Docker image pinned to the same version as `@playwright/test`. Local runs of the `visual` project are informational.
- **Updating baselines** happens only through a manually triggered workflow, `visual-baselines.yml`. It runs `npx playwright test --project=visual --update-snapshots` on a branch and commits the new baselines.
  - Run it only after you've approved the review page for that change.
  - Never update baselines to make a failing check pass.
- Once baselines exist, CI runs the `visual` project on every pull request, and a diff fails the check. If the change was intended, go through review and sign-off again, then update the baselines.
