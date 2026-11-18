# M1 plan: Foundation

Status: approved 2026-11-17
Spec sections: 2.1, 2.3, 2.4, 3.1, 6, 6.1, 6.2, 6.3 (first-visit and file-error rows only), 6.4, 6.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.10, 8, 9, 10; design docs `tokens.css`, `ui-contract.md`, `mockup-state.md`, `visual-testing.md`

## Scope

In (roadmap row M1, spec 9):
- Vite + strict TypeScript + Preact + signals scaffold, Biome, Vitest, Playwright (7.1, 7.2, 7.3)
- CI checks and GitHub Actions deploy to Pages under the repo subpath, CSP meta in production, no network after load (7.8, 8 "Continuous integration")
- Light and dark theme tokens, the theme button (System, Light, Dark), `public/theme-init.js` with no flash, `theme-color` metas (6.2, 6.4)
- Responsive shell: desktop three columns plus export drawer, tablet two columns, phone four tabs, safe areas, `dvh` (6.1)
- State store: `types.ts` and one signal per M1 field of the 7.5 data model (7.1, 7.5)
- Load image: drop, paste, picker, built-in samples; EXIF orientation; working master at most 4096 px and the analysis copy at the sample size, in a worker with a main-thread fallback (2.1 steps 1 and 2, 6 "Input", 6.1 "Getting images in", 7.4)
- "Sampling" read as pipeline step 2: sample size and resampling (2.1, 2.4). See decision 3.
- Weighted 5-bit OKLab histogram, median cut, k-means++, merge and sort post-processing (2.2, 2.4, 7.6)
- Swatch strip with selection (3.1, `ui-contract.md` column 2 item 1)
- Controls for later features are shown in their final places and are tappable; each shows a "Coming in a later version" toast (decision 6)
- App footer with the no-upload statement, MIT licence link and GitHub link (7.8, 7.10; decision 8)
- Copy HEX and copy CSS custom properties, with a toast (5.1 Text and CSS rows, 6.3 "Copy or export done")
- Color math in `src/color/`: sRGB, linear sRGB, OKLab, OKLCH, CIELAB conversions, and ΔE OK (2.3, 8 "Unit tests")
- Visual tooling, as required for M1 by `visual-testing.md`: tokens copied to `src/styles/tokens.css`, `?demo=mockup` with its M1 fixture, the token conformance test, `npm run visual:review`, CI jobs for token tests and the review artifact, and the `visual-baselines.yml` workflow

Out (and where it lands instead):
- Wu, Balanced, exact colors, even spread, swatch roles, filters (ignore dark/light/background, minimum chroma), region of interest, cluster map, presets, CIEDE2000 and the distance-metric setting: M2
- Sample-point markers, color editor, adjustments, lock, undo/redo, ramps, harmonies, contrast, CVD, view bar with Palette and Values views: M3
- Gradients: M4. The Gradient column and tab show a one-line hint only (6.3).
- All other export formats, export panels and presets, project files, library and autosave, Share, transfer grid: M5
- PWA and manifest, shortcut sheet, full empty and error states (6.3), accessibility audit, real-device testing: M6
- Catalogue validator in CI (spec 8 lists it, but it needs M7's `tools/validate-catalogues.ts`): M7
- Materials view and tab content: M7 to M9

## Tasks

Part A (T1 to T8) is scaffold, CI, themes and visual tooling. Part B (T9 to T13) is image loading and extraction. M1 stays one milestone (decision 2); the implementer works in two groups, Part A then Part B.

### M1-T1: Scaffold the project
- Files: `package.json` and `package-lock.json` (scripts `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `e2e`, names as listed in `CLAUDE.md`), `tsconfig.json` (strict, `jsx: react-jsx`, `jsxImportSource: preact`), `vite.config.ts` (`@preact/preset-vite`, `base` from `BASE_PATH` env with default `/palette-studio/`, Vitest config), `biome.json`, `playwright.config.ts` (projects: `chromium`, `webkit`, `firefox` desktop; `phone-webkit` iPhone 13; `phone-chromium` Pixel 7; `webServer` runs build + preview), `index.html` (`viewport-fit=cover`, no inline script or style), `src/main.tsx`, `src/ui/App.tsx`, `README.md` (commands, MIT)
- Tests to write first:
  - `e2e/smoke.spec.ts` › "loads under the base path with no console errors" (Chromium, WebKit, Firefox)
  - `tests/smoke.test.ts` › "Vitest runs with strict TS and Preact JSX" (renders `<App />` to a string and finds the app root)
- Done when: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run e2e` all pass; every asset URL in `dist/index.html` starts with the base path; no runtime dependency other than preact, @preact/signals, culori and lucide-preact.
- [x] Done (`npm run e2e` runs the five functional projects; tsx added as a dev dependency to run `tools/*.ts`)

### M1-T2: CI, deploy, CSP and the no-network rule
- Files: `.github/workflows/ci.yml` (push and PR: `npm ci`, lint, typecheck, unit tests, build, bundle-size report into the job summary, Playwright smoke in Chromium, WebKit, Firefox), `.github/workflows/deploy.yml` (runs only for `main` and only after `ci.yml` succeeds, e.g. `workflow_run` with `conclusion == success`; `upload-pages-artifact` + `deploy-pages`), `vite.config.ts` (CSP meta injected by `transformIndexHtml` in build only, exact policy from 7.8), `tools/bundle-size.ts` (gzip size per JS chunk and total; warns above 150 kB, 7.7)
- Tests to write first:
  - `e2e/security.spec.ts` › "production page carries the spec 7.8 CSP meta"; "dist/index.html has no inline script, no style element and no style attribute"; "every request during load and use is same-origin" (records `page.on('request')`)
  - `tests/tools/bundle-size.test.ts` › "sums gzip sizes of a fixture dist and flags totals above 150 kB"
- Done when: both workflow files lint (`actionlint` locally if available, otherwise reviewer reads them); the dev server has no CSP; the CSP test passes against `npm run preview`.
- [x] Done (actionlint not available locally; workflows checked by a YAML parse and by reading. CI runs the full `npm run e2e`, which includes the smoke tests in Chromium, WebKit and Firefox)

### M1-T3: Color conversions and ΔE OK
- Files: `src/color/convert.ts` (hex, sRGB, linear sRGB, OKLab, OKLCH, CIELAB D65, XYZ D65; culori via `culori/fn` tree-shaken imports), `src/color/delta-e.ts` (ΔE OK Euclidean), `src/export/format.ts` (`formatNumber(value, digits)` locale-independent, period separator)
- Tests to write first (`tests/color/convert.test.ts`, `tests/color/delta-e.test.ts`, `tests/export/format.test.ts`):
  - "sRGB white maps to OKLab L = 1, a = b = 0 within 1e-6" (spec 8)
  - "sRGB to OKLab to sRGB round trip error below 1e-6 on a 17×17×17 grid" (spec 8)
  - "Ottosson's XYZ D65 pairs: (0.950, 1.000, 1.089) → (1.000, 0.000, 0.000); (1, 0, 0) → (0.450, 1.236, −0.019); (0, 1, 0) → (0.922, −0.671, 0.263); (0, 0, 1) → (0.153, −1.415, −0.449), to 3 decimals"
  - "#FF0000 is oklch(0.628 0.2577 29.23) to 3 decimals"; "#FF0000 is CIELAB D65 (53.24, 80.09, 67.20) to 2 decimals"
  - "mockup swatches have the OKLab L in mockup-state.md: #E8693A 0.668, #1DB07A 0.672, #14386B 0.345, #D4527F 0.622, #1E8A2E 0.555, #5039B0 0.445 (±0.0005)"
  - "ΔE OK of (0.50, 0, 0) and (0.52, 0, 0) is 0.02; zero for identical colors; symmetric"
  - "formatNumber(0.5, 3) is '0.500' with the default locale forced to de-DE"
- Done when: tests pass; no color math outside `src/color/`.
- [x] Done (the #FF0000 hue is asserted to 2 decimals, the precision of its reference value 29.23; the actual hue is 29.2339)

### M1-T4: Design tokens and themes
- Files: `src/styles/tokens.css` (verbatim copy of `docs/design/tokens.css`), `src/styles/app.css` (base styles, focus ring: 2 px accent with offset, reduced motion), `public/theme-init.js` (reads stored choice, sets `data-theme` before first paint; in `?demo=mockup` uses only the `theme` param and never touches localStorage), `index.html` (`<script src="…/theme-init.js">` in head before the stylesheet, `theme-color` metas with `media` for light `#ffffff` and dark `#171717`), `src/state/theme.ts` (System, Light, Dark; persistence; live `matchMedia` updates), `src/ui/ThemeButton.tsx` (pill, icon only, labelled; opens a menu with System, Light, Dark; icons half-filled circle, sun, moon from lucide-preact)
- Tests to write first:
  - `tests/styles/tokens-sync.test.ts` › "src/styles/tokens.css equals docs/design/tokens.css byte for byte"
  - `tests/state/theme.test.ts` › "stored 'dark' resolves to data-theme dark"; "missing or invalid stored value resolves to System (no data-theme)"; "demo=mockup&theme=light resolves to light without reading storage"
  - `e2e/theme.spec.ts` › "first visit follows the emulated device scheme"; "choosing Dark survives a reload"; "in System, changing the emulated scheme updates colors without a reload"; "no flash: with the app bundle delayed 2 s, html already has data-theme dark and the dark surface color"; "demo mode with theme=dark writes nothing to localStorage"; "theme-color metas exist for light and dark"
- Done when: tests pass; the theme menu is keyboard operable (Enter opens, arrows move, Esc closes) and every option is ≥ 44 px at phone width.
- [x] Done (the System icon is Lucide `Contrast`, the closest half-filled circle in the set; the theme-color metas also follow a manual choice so the Safari toolbar matches; a temporary header hosts the button until T6)

### M1-T5: Types, signals store and the mockup fixture
- Files: `src/types.ts` (Project, Swatch, ExtractionSettings, ImageMeta per 7.5, M1 fields only; Swatch has id, OKLCH, alpha, name, locked, origin, population, image point, sample radius per 3.1), `src/state/signals.ts` (one signal per field; `selectedSwatchId`; `activeTab`), `src/palette/model.ts` (swatch creation from OKLab, selection helpers), `src/state/mockup.ts` (parses `demo`, `view`, `tab`, `theme`; ignores other params until their milestone; builds the "Harbor mural" project), `src/state/mockup-fixture.ts` (the six swatches, points and settings from `mockup-state.md`)
- Tests to write first:
  - `tests/state/mockup.test.ts` › "fixture has the six mockup-state hexes in order with their points"; "all six are origin extracted, unlocked, default sample radius"; "swatch 3 is selected"; "settings are Balanced, 6 colors, OKLab, all else at 2.4 defaults"; "tab=gradient&theme=dark parses; unknown params such as image=values are ignored, not errors"
  - `tests/state/signals.test.ts` › "loading a project sets every field signal"; "changing one swatch notifies only subscribers of the palette signal, not of settings"
  - `tests/palette/model.test.ts` › "swatch from OKLab stores OKLCH and round-trips to the same hex"
- Done when: tests pass; nothing in `src/state/mockup.ts` imports storage code.
- [x] Done (added `src/state/defaults.ts` for the 2.4 defaults and the M1 defaults of decision 5; the project name is a signal beside the Project, since 7.5 puts names on library entries; mockup-state.md gives no extraction shares, so the fixture uses equal populations of 1/6)

### M1-T6: Responsive shell in the mockup state
- Files: `src/ui/App.tsx`, `src/ui/Header.tsx`, `src/ui/Shell.tsx` (≤ 600, 601 to 1023, ≥ 1024 px per 6.1), `src/ui/TabBar.tsx`, `src/ui/SourcePanel.tsx`, `src/ui/PalettePanel.tsx`, `src/ui/GradientPanel.tsx` (hint only), `src/ui/ExportDrawer.tsx`, `src/ui/ImageWell.tsx` (`data-user-content`), `src/ui/SwatchStrip.tsx` (`data-user-content` on swatches), `src/ui/SettingRow.tsx`, `src/ui/Footer.tsx` (decision 8), `src/ui/Toast.tsx` (inverse surface, live region, per contract Components; moved here from T13 because decision 6 needs it), `src/ui/comingSoon.ts` (one helper that every not-yet-built control calls), `src/styles/app.css` (`dvh`, `env(safe-area-inset-bottom)` on the tab bar, `touch-action`, `-webkit-touch-callout: none` and `user-select: none` on the image)
- Tests to write first:
  - `e2e/layout.spec.ts` › "1280×800: three equal columns (widths within 1 px) with a 16 px gutter and the export drawer below"; "820×1180: the tablet two-column layout"; "320, 375, 390, 430 px portrait and their landscape sizes: no horizontal scroll (scrollWidth ≤ clientWidth)"; "phone: four tabs Source, Palette, Gradient, Materials; selecting Gradient shows its panel and sets aria-selected"; "landscape phone uses the two-column layout"
  - `e2e/layout.spec.ts` › "601 to 1023 px: Source column on the left (image, swatch strip beneath it, setting rows); the right column shows the active panel, chosen by Palette, Gradient and Materials tabs" (decision 4)
  - `e2e/coming-soon.spec.ts` › "Undo, Redo, Share, the project-name chevron, the Materials view tab and the view-bar chips are visible, enabled, ≥ 44 px, and each tap shows the 'Coming in a later version' toast in a live region"
  - `e2e/footer.spec.ts` › "footer shows the no-upload statement, an MIT licence link to https://github.com/ghadj/palette-studio/blob/main/LICENSE and a GitHub link to https://github.com/ghadj/palette-studio, at desktop, tablet and phone widths"; "footer uses tokens only and sits after the last panel content (desktop: below the export drawer; phone: end of each tab's scroll area, above the tab bar)"
  - `e2e/mockup-state.spec.ts` › "swatch strip shows the six fixture colors (computed background equals each hex)"; "swatch 3 has the selected outline"; "title ends with (demo)"; "tab=palette opens the Palette tab on phone"; "never reads or writes localStorage or IndexedDB" (init script wraps `Storage.prototype` and `indexedDB.open`); "image well shows mockup-scene.png loaded from BASE_URL"
- Done when: tests pass; header, columns and tabs follow the `ui-contract.md` order; no component uses a literal color, font size or radius.
- [x] Done. Notes: phones in landscape below 601 px (568×320) also get the two-column layout, because 6.1 says landscape uses it; tablets and landscape phones use the compact phone header; the tablet Palette panel repeats the swatch strip so it matches the phone Palette tab (6.6 rule 6), flagged for design review; in the view bar Image is the selected segment, and Palette, Values and Grid show the toast; `MaterialsPanel` lives in `GradientPanel.tsx`; the footer sits outside `<main>` so it keeps the contentinfo role

### M1-T7: Token conformance and accessibility tests
- Files: `e2e/tokens.spec.ts`, `e2e/helpers/tokens.ts` (resolves each token through a hidden probe element; walks the DOM skipping `[data-user-content]` subtrees), `e2e/a11y.spec.ts` (`@axe-core/playwright`, dev only), `e2e/helpers/screens.ts` (the M1 screen list shared with T8)
- Tests to write first:
  - `e2e/tokens.spec.ts` › for each M1 screen (studio desktop, studio tablet, phone Source, Palette, Gradient, Materials tabs, plus the empty state once T9 lands) × light and dark: "colors are tokens or transparent"; "font sizes are in {12, 13, 15, 16, 20}"; "radii are in {0, 6, 8, 10, 12} or a pill"; at phone width "every button, link, input, chip, tab is at least 44 × 44"
  - `e2e/tokens.spec.ts` › "checker self-test: an injected #123456 element is reported with its selector path, and the same element under data-user-content is not"
  - `e2e/a11y.spec.ts` › "no axe violations in each panel, light and dark, desktop and phone"
- Done when: tests pass with no values added to the allowed lists; `ci.yml` runs them in a `tokens-a11y` job.
- [x] Done (allowed lists unchanged. Extra cases: the open theme menu and a toast are also checked for tokens and axe. Token and axe tests are tagged `@tokens` and `@a11y`; the CI `e2e` job skips them and the `tokens-a11y` job runs them in all five projects. Fixes from the checks: an `h1` (visible on desktop, visually hidden on phones and tablets) for axe `page-has-heading-one`)

### M1-T8: Visual review page and baseline workflow
- Files: `e2e/visual/shots.ts` (M1 shot list with URL, viewport, mockup file and frame note), `e2e/visual/review.spec.ts` (project `visual-review`, saves PNGs to `artifacts/visual-review/`, light and dark via `colorScheme`), `e2e/visual/baseline.spec.ts` (project `visual`, `toHaveScreenshot` with animations disabled, caret hidden, `maxDiffPixelRatio: 0.002`), `playwright.config.ts`, `tools/visual-review.ts` (writes `artifacts/visual-review/index.html`, copies the referenced mockups next to it), `package.json` (`visual:review` = build, preview, run `visual-review`, write page), `.github/workflows/ci.yml` (on PRs: run `visual:review`, upload `artifacts/visual-review/`; `visual` job in `mcr.microsoft.com/playwright:v<same as @playwright/test>-jammy`, skipped while no baseline files exist), `.github/workflows/visual-baselines.yml` (`workflow_dispatch` only, same container, `npx playwright test --project=visual --update-snapshots`, commits baselines to the dispatched branch), `docs/design/visual-testing.md` (add the two empty-state rows below, if approved)
- Tests to write first:
  - `tests/tools/visual-review.test.ts` › "writes one row per shot and theme with mockup and build images side by side"; "has a notes column and a link to ui-contract.md"; "shots without a mockup say 'contract text (not drawn)'"; "a missing screenshot shows as missing, not a broken image"
- Done when: `npm run visual:review` produces the page with every M1 shot in both themes; no baseline images are committed by any M1 task.
- [x] Done (`@playwright/test` pinned exactly to 1.65.1 so the `v1.65.1-jammy` image always matches; a unit test checks the pin and that `visual-baselines.yml` is dispatch-only. The CI `visual-review` job also runs in that image so review shots render like baselines. Baselines live in `e2e/visual/baselines/` (none committed). The empty-state shots show the pre-T9 placeholder until T9 builds the drop zone. Phone and tablet shots use touch emulation)

### M1-T9: Load an image
- Files: `src/image/load.ts` (classify, decode with `createImageBitmap` honoring orientation; SVG decoded as an image element, never inlined; HEIC message; 30 MP note), `src/image/tiers.ts` (working master ≤ 4096 px; analysis copy at sample size, Smooth or Nearest), `src/extract/worker.ts` (downscale job on OffscreenCanvas, buffers transferred), `src/extract/messages.ts` (message types shared by worker and UI), main-thread fallback when OffscreenCanvas in workers is missing, `src/ui/DropZone.tsx` (Choose image, Paste, three sample images per 6.3; `<input type=file accept="image/*">` with no `capture`), `src/ui/ImageWell.tsx`, `src/state/signals.ts` (image meta, project name from the file name per 5.5 "First visit"), `tools/make-samples.ts` and `public/samples/` (three generated abstract images, gradients and shapes, committed with the script that makes them; decision 9), `tests/fixtures/` (`two-color.png`, `single-color.png`, `transparent.png`, `exif-orientation-6.jpg`, `not-an-image.txt`)
- Tests to write first:
  - `tests/image/load.test.ts` › "accepts JPEG, PNG, WebP, GIF, AVIF, SVG by type and extension"; "HEIC that fails to decode gets the HEIC message"; "other files get a message naming the format and the formats that work"; "6000×5000 triggers the 30 MP note, 5000×5000 doesn't"
  - `tests/image/tiers.test.ts` › "8064×6048 (48 MP) gives a 4096×3072 master"; "1600×800 master stays 1600×800"; "analysis copy of 4096×3072 at 256 is 256×192"; "'full' uses the master size"; "default sample size is 256 on every device" (decision 5; departs from spec 6.1 "Phone defaults", to be revisited)
  - `e2e/load-image.spec.ts` › "picker loads two-color.png and shows it"; "drop loads an image"; "paste loads an image (Chromium)"; "a sample image button loads"; "not-an-image.txt shows the inline message and the previous image stays"; "exif-orientation-6.jpg displays in portrait"; "project name becomes the file name without extension"; "a generated 31 MP image shows the large-image note and loads"
- Done when: tests pass; no UI-thread code loops over pixels (reviewer greps `src/ui` and `src/state`).
- [x] Done. Notes: decoding runs on the main thread with `createImageBitmap` (asynchronous, no JS pixel loops), and the bitmap is transferred to the worker, which makes the master; the image well shows a display copy of the master capped at 2048 px (`DISPLAY_MAX`) to keep canvas memory low on phones; the master is always made with smooth resampling; the large-image note starts at exactly 30 MP (6000×5000 triggers it, as the test requires); `tools/png.ts` and `tools/make-fixtures.ts` were added to generate the samples and fixtures; the forced fallback uses a `window.__paletteStudioMainThread` test hook; the drop zone and empty screens are now in the token and axe screen lists. Once an image is loaded, the only ways to load another are drop, paste and the hidden picker (Import file arrives with the library in M5); no new control was invented

### M1-T10: Histogram and median cut
- Files: `src/extract/histogram.ts` (5 bits per channel, count and mean OKLab per bin, alpha cutoff 128 fixed, spec 7.6), `src/extract/median-cut.ts` (largest-range box, split at population median, 7.6)
- Tests to write first (`tests/extract/histogram.test.ts`, `tests/extract/median-cut.test.ts`):
  - "a 5-bit histogram never exceeds 32,768 bins"; "a 75/25 two-color image gives 2 bins with counts 3:1 and the exact OKLab means"; "pixels with alpha below 128 are ignored"; "a fully transparent image gives no bins"
  - "single-color image with N=6 returns one swatch with that color and population 1"; "two-color 75/25 image with N=2 returns both exact colors with populations 0.75 and 0.25"; "fully transparent image returns an empty palette without throwing"; "a constructed 4-bin case splits on the widest channel at the population median"; "same input twice gives identical output"
- Done when: tests pass; functions are pure and run in Vitest without a worker.
- [x] Done (added `src/color/working-space.ts`, a fast per-pixel sRGB-to-working-space converter that matches convert.ts, tested against it; the alpha cutoff and bit depth are options with the 2.4 defaults 128 and 5; median cut ties break on the other channels, then bin order, for determinism)

### M1-T11: Weighted k-means++
- Files: `src/extract/kmeans.ts` (mulberry32 seeded PRNG, k-means++ init, weighted Euclidean in the working space, restarts keep lowest error, empty clusters reseed to the farthest point, stop at max centroid shift < 1e-4 or the iteration cap; defaults 25 iterations, 3 restarts, seed 1, per 2.4 and 7.6)
- Tests to write first (`tests/extract/kmeans.test.ts`):
  - "same seed gives identical output" (spec 8); "a different seed can change initial centroids"
  - "three separated weighted clusters converge to their weighted means within 1e-4"
  - "single-color, two-color and fully transparent inputs are stable" (spec 8)
  - "N larger than the distinct colors returns at most the distinct count, with no empty cluster"
  - "stops at the iteration cap when the shift never drops below 1e-4"; "of 3 restarts the lowest-error result is kept"
- Done when: tests pass.
- [x] Done (one seeded PRNG runs across the restarts; each restart returns the weighted means of its final assignment, with empty clusters dropped, and its error is measured on exactly those clusters; results also report `iterations`, `converged` and `restartErrors` for the tests; about 13 ms for 6 colors and 32 ms for 32 colors on a 6,000-bin histogram in Node)

### M1-T12: Extraction pipeline with live settings
- Files: `src/extract/postprocess.ts` (merge at ΔE OK 0.03 into a population-weighted average, sort by population, populations sum to 1), `src/extract/worker.ts` (analysis copy → histogram in the working space → median cut or k-means++ → postprocess), `src/state/signals.ts` (debounce about 120 ms, job ids, stale results dropped, previous result dims while working, progress bar only after about 300 ms, 7.4 and 6.3), `src/ui/SourcePanel.tsx` (setting rows Algorithm with k-means++ as the M1 default, Colors 2 to 32 with slider and number field, Working space; a collapsed Advanced chevron row (6.6) with Sample size, Resampling, and Seed with Randomize; decision 5)
- Tests to write first:
  - `tests/extract/postprocess.test.ts` › "two swatches 0.02 apart merge into the population-weighted mean"; "0.04 apart stay separate"; "sorted by population, descending"; "populations sum to 1 within 1e-9"
  - `tests/extract/pipeline.test.ts` › "both algorithms × 4 working spaces are stable on single-color, two-color and transparent inputs"; "same settings and seed give identical palettes"
  - `tests/state/jobs.test.ts` › "a result with an older job id is dropped"; "settings changes within 120 ms post one job"
  - `e2e/extract.spec.ts` › "two-color.png yields two swatches with the exact hexes"; "changing Colors to 3 re-extracts and the strip updates"; "switching to Median cut updates the strip"; "reloading and loading the same image with the same seed gives the same hexes"; "Colors field has inputmode=decimal and 16 px type at phone width"; "time to first palette for a generated 12 MP image is logged" (informational, not asserted)
- Done when: tests pass; the mockup state still shows its fixture without running extraction.
- [x] Done. Notes: the pure pipeline is `src/extract/pipeline.ts`; the debounce, job ids and 300 ms progress timer are in `src/state/jobs.ts`; `src/state/extraction.ts` wires them to the signals; the controls are in `src/ui/SettingsControls.tsx`. A new image extracts at once, and settings changes are debounced. In the main-thread fallback only the analysis pixels go to the worker, and an e2e test checks that the fallback gives the same hexes as the worker path in every browser. In the mockup state the Algorithm select shows Balanced as a disabled option, and settings changes don't extract (there is no loaded image). The selection is kept by position after re-extraction. Selects and number fields use 16 px type on touch and at phone width. Extra token and axe cases cover the open Advanced row. Time to first palette for a 12 MP PNG was 205 to 250 ms across the five projects locally

### M1-T13: Copy HEX and CSS variables
- Files: `src/export/palette-text.ts`, `src/export/palette-css.ts`, `src/ui/ExportDrawer.tsx` (Copy HEX and Copy CSS pill buttons in the palette half of the drawer on desktop and tablet), `src/ui/SourcePanel.tsx` and `src/ui/PalettePanel.tsx` (the same buttons under the swatch strip on phones); decision 7, copy fallback with a message if the Clipboard API fails (6.3)
- Tests to write first:
  - `tests/export/palette-text.test.ts` › "mockup fixture gives '#E8693A\n#1DB07A\n#14386B\n#D4527F\n#1E8A2E\n#5039B0'"
  - `tests/export/palette-css.test.ts` › "mockup fixture gives ':root {\n  --palette-1: #E8693A;\n  …\n  --palette-6: #5039B0;\n}' (uppercase hex, --palette-N in palette order)"; "output is identical with the locale forced to de-DE"
  - `e2e/copy.spec.ts` › "Copy HEX puts the list on the clipboard and shows a 'Copied HEX' toast announced in a live region" (Chromium, clipboard permissions); "Copy CSS puts the :root block on the clipboard"; "a clipboard failure shows a message that says why"
- Done when: tests pass; the toast respects reduced motion.
- [x] Done. Notes: `src/ui/CopyButtons.tsx` is shared by the drawer and the phone tabs; on phones the buttons show only once there is a palette. The toast gained one optional action: a failed copy says why ("the browser didn't allow access to the clipboard") and offers Download, which saves `<project> palette.txt` or `.css` (spec 6.3). Copy tests run in Chromium only, because of clipboard permissions. Extra token cases cover the failure toast. Correction to the T9 note: the empty-desktop, empty-tablet and empty-phone token and axe screens actually landed in this commit, because a T9 edit to `e2e/helpers/screens.ts` silently missed

## Screens affected (UI work only)

| Screen | ui-contract regions | New or changed screenshots | Mockup-state additions | Not-drawn items needing design review |
| --- | --- | --- | --- | --- |
| Header, desktop and phone | Header items 1 and 5 (app name, project name, theme button); items 2 chevron, 3, 4 shown and enabled, each tap gives the "coming later" toast (decision 6) | studio-desktop, source-phone | Project name "Harbor mural"; `theme` param | Theme menu popover (contract describes, mockups don't draw it); Replace image button and its menu (decision 12) |
| Desktop Studio view | Frame and three equal columns; Column 1 items 1 (image well, no markers) and 4 (setting rows); Column 2 items 1 and 2 (swatch strip, "Swatch 3" label); Column 3 hint only; Export drawer frame with copy controls | studio-desktop | Six swatches with hexes and points, swatch 3 selected, settings Balanced / 6 / OKLab, `view=studio` | Copy controls in the drawer; editing affordance for setting rows; Advanced settings row (decision 5) |
| Phone Source tab | Items 1 (no markers), 4, 5 | source-phone | `tab=source` | none |
| Phone Palette tab | Swatch strip and selection label (rest is M3) | palette-phone | `tab=palette` | Whole tab is not drawn |
| Phone Gradient tab | Hint only (M4) | gradient-phone | `tab=gradient` | One-line hint |
| Phone Materials tab | Hint only (Part 2) | none yet | `tab=materials` | One-line hint |
| Tablet | Left: Source column (image, swatch strip beneath, setting rows). Right: active panel chosen by Palette / Gradient / Materials tabs (decision 4) | studio-tablet | none | Tablet layout |
| Footer, all widths | Not in contract | covered by every shot | none | Footer: no-upload line, MIT licence link, GitHub link (decision 8) |
| First visit, no image | Not in contract | add `empty-desktop` (`/`, fresh context, 1280 × 800) and `empty-phone` (`/`, 390 × 844), compare with "contract text (not drawn)" | none (not the mockup state) | Drop zone with Choose image, Paste and three samples; unsupported-file message; large-image note; progress bar; copy toast |

Controls for later features (Undo, Redo, Share, project chevron, Materials view tab, view-bar chips) are present but show a "coming later" toast. Larger regions owned by later milestones (markers, hint, editor, chevron rows, gradient column contents, export formats) are absent in M1 shots and are not blocking findings (decision 10).

## Acceptance checklist (copied from the spec)

- [ ] Load an image by drop, paste or picker, and see a palette in under a second for typical photos. (spec 8, v1 acceptance 1)
- [ ] Switch algorithm and settings with live updates; the same seed gives the same palette. (spec 8, v1 acceptance 2; M1 algorithms only)
- [ ] Works as a static site under a repo subpath on GitHub Pages with no network after load. (spec 8, v1 acceptance 9)
- [ ] Keyboard-operable with visible focus and sufficient UI contrast; the phone (6.1) and theme (6.2) acceptance lists pass. (spec 8, v1 acceptance 10; for M1 features)
- [ ] Color conversions against reference values (sRGB white maps to OKLab L = 1, a = b = 0; round-trip error below 1e-6). (spec 8)
- [ ] K-means output identical for the same seed, and every algorithm stable on single-color, two-color and fully transparent images. (spec 8)
- [ ] Numbers use a period as the decimal separator under any locale. (spec 5, 8; CSS variables)
- [ ] Every push and pull request runs lint, type-check, unit tests, a production build with the bundle-size report (7.7), and a Playwright smoke test in Chromium, WebKit and Firefox. (spec 8; catalogue validator deferred to M7)
- [ ] axe-core checks each panel for accessibility problems, in light and dark themes. (spec 8)
- [ ] Deploys run only from main and only after every check passes. (spec 8)
- [ ] Layout checks at 320, 375, 390 and 430 px wide, portrait and landscape: no horizontal scroll, no clipped controls, tab bar clear of the home indicator. (spec 8, small-device tests)
- [ ] Theme 1: First visit follows the device theme; a manual Light or Dark choice survives a reload, and changing the device theme updates the app without one. (spec 6.2)
- [ ] Theme 2: No flash of the wrong theme on load. (spec 6.2)
- [ ] Theme 3: Swatch, image and gradient colors are identical in both themes (a screenshot comparison of the preview areas). (spec 6.2; image and swatches in M1)
- [ ] Theme 4: All text and controls meet AA contrast in both themes, and markers are visible on very light and very dark images. (spec 6.2; markers arrive in M3)
- [ ] Phone 1: Every feature in Parts 1 and 2 is reachable on a 320 px wide screen without horizontal scrolling. (spec 8, small-device acceptance; M1 features)
- [ ] Phone 2: All controls are at least 44 × 44 px, and nothing depends on hover. (spec 8)
- [ ] Phone 4: Text fields don't trigger Safari's focus zoom. (spec 8)
- [ ] Phone 5 (load part): A 48 MP iPhone photo loads and extracts without the tab reloading. (spec 8; the 4096 px export part is M5)
- [ ] Phone 7 (tab bar part): The tab bar and sheets clear the home indicator and notch. (spec 8; Home Screen full screen is M6)
- [ ] Not in M1: phone 3 (marker drag, M3), phone 6 (share sheet export, M5).
- [ ] Unsupported or unreadable file: an inline message naming the format and the formats that work; the previous image stays loaded. Very large image: a note above about 30 MP, then automatic downscaling. Copy done: a short toast. (spec 6.3)
- [ ] CSP meta in the production build only, no inline scripts, URLs from `import.meta.env.BASE_URL`. (spec 7.8)
- [ ] `viewport-fit=cover`, `env(safe-area-inset-bottom)` on the tab bar, `dvh` units, 16 px text inputs, `inputmode='decimal'` on numeric fields. (spec 6.1)
- [ ] Token conformance test passes on every M1 screen at desktop and phone widths in both themes. (`visual-testing.md` 1)
- [ ] `npm run visual:review` writes the review page; CI uploads it on PRs; `visual-baselines.yml` exists and is manual only. (`visual-testing.md` 2, 3)
- [ ] `?demo=mockup` shows the M1 fixture and never touches localStorage or IndexedDB. (`mockup-state.md`, spec 5.5)

## Manual checks for a person

- [ ] In the GitHub repository settings, set Pages source to GitHub Actions; after merge, open the deployed URL under `/<repo-name>/` and confirm DevTools shows only same-origin requests.
- [ ] Real iPhone (current iOS): picker offers Photo Library, Take Photo and Files; a HEIC photo loads or shows the clear message; a 48 MP photo loads and extracts without the tab reloading; the tab bar clears the home indicator; the Colors field doesn't zoom on focus; the Safari toolbar color follows the theme.
- [ ] Older iPhone on older iOS: check the theme still works (`light-dark()` needs Safari 17.5; see risks).
- [ ] Android phone with Chrome: load, extract, copy.
- [ ] Paste an image in Safari and Firefox (automated only in Chromium).
- [ ] Copy HEX and CSS in Safari on iPhone and paste into Notes.
- [ ] Reload a few times with Dark chosen on a light-mode device and confirm no flash.
- [ ] Time to first palette for a typical 12 MP photo on a mid-range laptop (target about 500 ms, spec 7.7).
- [ ] Open `artifacts/visual-review/index.html`, compare with the mockups, and sign off or list changes.
- [ ] Design review of the not-drawn items in the table above.
- [ ] After sign-off, run `visual-baselines.yml` on the milestone branch and check the committed baselines.

## Risks

- Scope: 13 tasks is above the kickoff guide's "about ten". Part B depends on Part A only through the shell and store.
- `light-dark()` needs Safari 17.5, Firefox 120, Chrome 123. Older iOS versions that spec 8 asks to test will show broken colors without a fallback.
- OffscreenCanvas 2D in workers needs Safari 16.4; the main-thread fallback must be exercised (force it in one e2e test).
- `createImageBitmap` on SVG blobs fails in some browsers and in workers; SVG has to go through an image element on the main thread.
- Clipboard: image paste and `clipboard.read()` differ across Safari and Firefox, and Playwright can grant clipboard permissions only in Chromium, so copy and paste tests run there only.
- Token test: `color-mix()` and `light-dark()` resolve to different computed formats per browser; the probe approach must compare resolved values, not strings.
- Bundle budget: culori must be imported from `culori/fn`, or it alone can push past 150 kB.
- Baselines only render the same in the pinned Playwright Docker image; local runs of `visual` will differ.
- The M1 shots will change in M3 to M5 as regions arrive, so each of those milestones goes through review and a baseline update.
- `deploy.yml` with `workflow_run` runs the workflow file from the default branch; it will take effect only after M1 is merged to main.

## Decisions (answered by the user, 2026-11-17)

1. **Product name** is "Palette Studio". Base path is `/palette-studio/`.
2. **One milestone.** M1 is not split. Implementation runs in two groups (T1 to T8, then T9 to T13).
3. **"Sampling"** is pipeline step 2 (sample size and resampling). M1 shows no sample-point markers; they arrive in M3. (Plan proposal, not contested.)
4. **Medium screens (601 to 1023 px)** (revised in the layout fix round, L1; this replaces the original two-column decision). They use the phone layout, wider: one panel at a time with all four tabs (Source, Palette, Gradient, Materials) in the bottom tab bar, the phone header and safe-area padding. The panel is centered at a readable width (`--space-8` × 20 = 640 px). Phones in landscape, at any width up to 1023 px (for example 568 × 320), get the same tabbed layout. This departs on purpose, by the user's choice, from spec 6.1's "601 to 1023 px: two columns" row and from "landscape uses the two-column layout". The tablet's duplicated swatch strip is gone. (Originally: Source as its own column, beside the active panel chosen by Palette, Gradient and Materials tabs.)
5. **Defaults.** k-means++ is the M1 default algorithm until Balanced arrives in M2. The sample size is 256 on phones too ("normal size"); this departs from spec 6.1 "Phone defaults: 128 px" by the user's choice and will be revisited. Settings exposed: Algorithm, Colors, Working space, and a collapsed Advanced row with Sample size, Resampling, and Seed with Randomize.
6. **Controls for later features** are shown in their final places, enabled, and tapping one shows a "Coming in a later version" toast. The Gradient and Materials panels show a one-line hint (6.3).
7. **Copy.** Copy HEX gives one uppercase hex per line. Copy CSS gives a `:root` block with `--palette-1` … `--palette-N`, uppercase hex, in palette order. Hex only until M5 adds formats. Buttons sit in the export drawer on desktop and tablet, and under the swatch strip on phones.
8. **Footer.** A quiet footer at the bottom of the page, styled cohesively with tokens, holding the no-upload statement (7.8), an MIT licence link (7.10) and a link to the GitHub repository (https://github.com/ghadj/palette-studio). These are navigation links, not requests, so the no-network rule holds.
9. **Sample images.** Three abstract images (gradients and shapes) generated by a script in the repo, so there are no licensing questions.
10. **Visual review scope.** As described under "Screens affected". The `empty-desktop` and `empty-phone` shots are added to `visual-testing.md`. (Plan proposal, not contested.)
11. **Bundle budget** above 150 kB gzip warns and does not fail CI. (Plan proposal, not contested.)
12. **Replace image** (added in the M1 fix round, after evaluator note 1). Once an image is loaded, an icon button in the header next to Undo, Redo and Share, on every layout, uses the Lucide image icon and is labelled "Replace image". It opens the drop zone's choices (Choose image, Paste, the three samples) in a menu styled like the theme menu. It is hidden on the empty screen, where the drop zone offers the same choices. At 320 px the header doesn't overflow: the project name truncates with an ellipsis and every control stays at least 44 px.

13. **Palette size** (layout fix round, L6). Palettes have 2 to 12 colors. This departs on purpose, by the user's choice, from spec 2.4's "2 to 32". `MAX_COLORS` in `src/state/defaults.ts` is 12, and `clampColors` clamps the slider, the number field, typed input (on commit), loaded settings and the pipeline. Up to 6 swatches sit in one row. With 7 to 12, the strip uses one row only when every swatch keeps at least 44 px, otherwise two even rows of at most 6.

14. **Settings that don't apply** (layout fix round, L7). Settings that don't apply to the selected algorithm are disabled, not hidden, so the layout doesn't jump, and they keep their values. The table is in `src/extract/applicability.ts` (Seed, iterations and restarts: k-means++ only; everything else applies to every algorithm), so M2 can extend it without new UI logic. In M1 only Seed and Randomize depend on the algorithm; the Seed row carries the muted note "Used by k-means++ only", which the controls reference with aria-describedby.

## Fix round (after the evaluation report)

- [x] M1-F1: Replace image button and menu in the header (decision 12). Hidden on the empty screen. In the compact header both menus anchor to the header's right edge so they fit at 320 px.
- [x] M1-F2: Vite `build.license` writes `dist/licenses.md` with the full licence text of every bundled dependency (preact, @preact/signals and @preact/signals-core, culori, lucide-preact); an e2e test checks each runtime dependency, its version and its text, and that the file is served (spec 7.10).
- [x] M1-F3: extraction errors carry `fromExtraction`, and the next successful extraction clears them; other messages (large-image note, file errors) stay. Unit test `tests/state/extraction.test.ts`.
- [x] M1-F4: the image client rejects pending requests on a worker `error` or `messageerror`, terminates that worker and creates a new one on the next job, which rebuilds its master by decoding the original file again (`setRestore`); the scheduler then resets `extracting` and shows the extraction error. The worker factory is injectable for tests. Unit tests: `tests/extract/client.test.ts` and `tests/state/extraction.test.ts`.
- [x] M1-F5: a toast with an action has no timeout and a 44 px Dismiss button (Lucide X); plain toasts still hide after 4 s. Unit test `tests/ui/toast.test.ts`; the copy e2e test checks that the failure toast is still there after 9 s and closes with Dismiss; the existing token case and a new axe case cover the failure toast.
- [x] M1-F6: (a) rasters are probed first with an image element, whose `naturalWidth` and `naturalHeight` are EXIF-oriented in Chromium, WebKit and Firefox (checked); anything over 4096 px decodes with `createImageBitmap(file, { imageOrientation, resizeWidth, resizeHeight, resizeQuality: "high" })` straight to the master size, where resize applies after orientation in all three. When the probe fails (for example HEIC outside Safari) decoding falls back to full size. The project keeps the original size. New fixture `exif-orientation-6-large.jpg` (5000 × 2500 stored), plus unit and e2e tests; pinned hexes are unchanged. (b) A new image no longer clears the palette: the old one stays, dimmed through loading (and sample fetches) and extraction, until the new result lands. An e2e test gates the sample fetch and checks the strip never empties.
- [x] M1-F7: (a) `e2e/theme-content.spec.ts` checks that the image well (inset past its border) and the centre of every swatch are pixel-identical (max channel difference 0) in light and dark, on desktop and phone, in every project; a temporary themed swatch made it fail as expected. (b) Not done, blocked upstream: all 8 high advisories come from `picomatch` (GHSA-fc5q-39xc-vjpf, range <=4.0.7), and 4.0.7 is the latest published version. vite 8.3.8, vitest 5.1.0 and @preact/preset-vite 2.10.6 are already the latest releases, and `npm audit fix --force` only offers major downgrades that stay inside the same advisory. All affected packages are dev-only build and test tools, not shipped. @playwright/test stays pinned at 1.65.1.

### Layout fix round (from the user's review of the running app)

- [x] M1-L1: below 1024 px the app uses the tabbed phone layout (decision 4 as revised; departs on purpose from spec 6.1's two-column row and its landscape rule). The two-column tablet layout, its row tabs and the duplicated strip are removed. The panel and the tab bar's tabs are centered at 640 px (`--space-8` × 20). Controls are 44 px and inputs 16 px everywhere below 1024 px. Tests updated: layout (820 × 1180, 601 to 1023 px portrait and landscape, landscape phones), copy (buttons under the strip at 820 px), and the token touch-target checks now cover the tablet screens. The studio-tablet shot now shows the tabbed layout.
- [x] M1-L2: the desktop header is a three-part grid (`minmax(0, 1fr) auto minmax(0, 1fr)`), so the Studio and Materials tabs stay centered. A layout test checks the centre at 1024, 1280 and 1920 px, and again with a long project name and the Replace image button showing.
- [x] M1-L3: on desktop the app fills the window (`100dvh`). The columns area takes the space between the header and the export drawer and scrolls inside itself (`overflow-y: auto`), so the drawer sits directly above the footer at the bottom of the window with no gap. Layout tests cover 1280 × 800, 1280 × 1200 and 1024 × 768, and a 680 px tall window with Advanced open where the columns scroll.
- [x] M1-L4: `body` has a minimum width of 320 px (`--space-8` × 10), so narrower windows scroll sideways instead of squashing the layout. The desktop app has a minimum height of 640 px (`--space-8` × 20), below which the page scrolls and the columns, drawer and footer keep their 640 px layout. Layout tests at 300 and 280 px wide (header controls stay 44 px) and at 600 and 480 px tall.
- [x] M1-L5: the footer text is now only "Your images never leave this browser." Its top border runs the full width of the viewport, extending past the safe-area padding, while its content keeps the page gutters (24 px on desktop, 16 px in the tabbed layout). The footer tests check the text and the edge-to-edge border at desktop, tablet, phone and 320 px widths.
- [x] M1-L6 (decision 13): Colors runs 2 to 12, with `clampColors` applied in the slider, the number field (typed values over 12 or under 2 are clamped on Enter or blur), `loadProject` and the pipeline. The swatch strip measures itself (`ResizeObserver`) and picks its columns with `stripColumns` in `src/ui/stripLayout.ts`. New fixture `twelve-colors.png`. Unit tests for clamping, the column rule and the pipeline cap; e2e tests with 12 colors at 1280, 1024, 820, 390 and 320 px (no clipping, at most 2 even rows, every swatch at least 44 px) and for typed clamping. No existing test used more than 12 settings colors.
- [x] M1-L7 (decision 14): `settingApplies` and `onlyForNote` in `src/extract/applicability.ts`. With Median cut the Seed field and Randomize are disabled and keep their value; switching back to k-means++ gives the same palette. `SettingRow` gained an optional note under the label. Disabled number fields use muted text and the divider border. Unit test for the table; e2e test (disabled with the note and aria-describedby, other settings enabled, same seed and hexes after switching back); token and axe cases for the disabled state in both themes.
- [x] M1-L8: the five Biome noDescendingSpecificity warnings are cleared by moving the `.header--desktop` placement rules and the `.shell--desktop .columns` and `.export-drawer` rules after the base rules they override. Those rules already won on specificity, so nothing renders differently. Review screenshots before and after differ only where repeated runs of the same CSS also differ (sample-thumbnail and image scaling noise, at most 6/255, inside images). `npm run lint` reports 0 warnings.
- [x] M1-L9: extraction tracks which image the palette belongs to. If the first extraction for a new image fails, the previous image's palette and selection are cleared (the strip empties; Copy is disabled in the drawer and hidden on the phone tabs) and the error stays. A failed re-extraction of the same image keeps its palette, no longer dimmed. Unit tests in `tests/state/extraction.test.ts`; the existing e2e "copy buttons are disabled with no palette" covers the empty state.
