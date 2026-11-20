# M2 plan: Extraction depth

Status: approved (2026-11-18)
Spec sections: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.6, 6 ("Image view", "Keyboard"), 6.1, 6.2, 6.3, 6.4, 6.6, 7.3, 7.4, 7.6, 7.7, 8, 9; design docs `ui-contract.md`, `mockup-state.md`, `visual-testing.md`; M1 plan decisions 5, 13, 14 and M1 report note 4

## Scope

In (roadmap row M2, spec 9, and the decisions below):
- Algorithms Wu, Balanced (Wu seed + weighted k-means + scoring), Exact colors, Even spread and Swatch roles (2.2, 7.6). Balanced becomes the default, replacing M1's k-means++ stand-in (2.4, M1 decision 5).
- Filters (2.1 step 3, 2.4): ignore dark and light, ignore background (auto-detect from border pixels), minimum chroma, and an alpha cutoff control. The cutoff is already in the model at 128.
- CIEDE2000 and the Distance metric setting (2.3, 2.4, 8).
- The rest of the 2.4 table: population vs. vividness, merge threshold, spatial weighting, keep one outlier, histogram bits, k-means iterations and restarts, and sort (decision 1).
- Presets Dominant, Balanced, Vibrant, Flat art, Accents and Swatch roles (2.5).
- Cluster map (2.6), with its no-hover path (6.1, decision 13d).
- Zoom and pan of the image (spec 6 "Image view", 6.1 "Gestures"; decision 15):
  - touch: pinch to zoom and one finger to pan
  - desktop: wheel or trackpad, and drag
  - visible zoom controls that also work from the keyboard
- Extend `src/extract/applicability.ts` for the new algorithms. This settles M1 report note 4 (decision 5b).
- Generated extraction fixtures from the spec 8 list: mostly white background, grayscale, and studio backdrop. Twelve-colors already covers flat art and pixel art.

Out (and where it lands instead):
- Region of interest: dropped by the user (decision 15). Extraction always uses the whole image.
- Octree: Later (2.2, 9).
- Sample-point markers (3.7), Palette and Values views (3.8), the swatch editor and its sheet, lock, undo/redo, and re-extraction that keeps locked swatches (3.6): M3.
- Close-pair warnings using the merge threshold (3.5): M3.
- Presets in project files and share links: M5.
- Keyboard shortcut R to re-extract (spec 6): M6 shortcut sheet.
- Phone sample size of 128 px (6.1): it stays 256 by M1 decision 5.

## Tasks

The order follows dependencies:
- T1 to T7: the extraction engine and the Advanced settings.
- T8 and T9: filters.
- T10 and T11: zoom and pan.
- T12: presets.
- T13 and T14: the cluster map.

Every task keeps `?demo=mockup` working without storage access. Every task that touches UI adds its screens to `e2e/helpers/screens.ts`, so the token and axe tests cover them in both themes.

### M2-T1: CIEDE2000 and the distance metric in post-processing
- Files: `src/color/convert.ts` (add `oklabToLab`, OKLab to CIELAB D65 through sRGB-linear and XYZ), `src/color/delta-e.ts` (`deltaE2000(lab1, lab2)` with culori's `differenceCiede2000` from `culori/fn` or hand-rolled; `deltaE(metric, oklab1, oklab2)` dispatch), `src/extract/postprocess.ts` (`metric` option; under CIEDE2000 the threshold is in ΔE00 units, ×100, decision 7), `tests/fixtures/ciede2000-sharma.json` (all 34 pairs from Sharma, Wu and Dalal 2005, Table 1)
- Tests to write first:
  - `tests/color/delta-e.test.ts` › "CIEDE2000 matches all 34 Sharma pairs to 4 decimals"
    - Spot values in the test name list: pair 1 (50, 2.6772, −79.7751)/(50, 0, −82.7485) gives 2.0425; pair 4 (50, −1.3802, −84.2814)/(50, 0, −82.7485) gives 1.0000; pair 7 (50, 0, 0)/(50, −1, 2) gives 2.3669; pair 17 (50, 2.5, 0)/(73, 25, −18) gives 27.1492.
    - Also: "symmetric on every pair"; "zero for identical colors".
  - `tests/color/delta-e.test.ts` › "hex pairs from mockup-state.md, ±0.05":
    - #E8693A/#EA6B3B 0.64
    - #E8693A/#E96A3B 0.31
    - #14386B/#1B3C70 1.37
    - #D4527F/#D75481 0.83
  - `tests/extract/postprocess.test.ts`:
    - "metric 'ok' behaves exactly as M1"
    - "metric 'ciede2000' with threshold 3.0 merges a pair at ΔE00 2.5 and keeps a pair at 3.5"
- Done when: tests pass; the CIEDE2000 math lives only in `src/color/`; the bundle stays within 150 kB gzip.
- [x] Done
  - Note: CIEDE2000 is hand-rolled (checked against all 34 Sharma pairs, and culori agrees within 5e-5). `thresholdFor(metric, stored)` in `src/color/delta-e.ts` reads the stored merge threshold ×100 under CIEDE2000; the pipeline uses it from T2. Bundle total 39.97 kB gzip.

### M2-T2: Settings model and the pipeline frame (no visible change)
- Files:
  - `src/types.ts`: add `ignoreDark` and `ignoreLight` (each an on flag and a threshold), `ignoreBackground` ("off" or "auto"), `minChroma`, `vividness`, `distanceMetric` ("ok" or "ciede2000"), `spatialWeighting` ("uniform", "center" or "contrast"), and `keepOutlier`. There is no region field (decision 15).
  - `src/state/defaults.ts`: spec 2.4 defaults, with thresholds L 0.2 and 0.95 (decision 3). `SCHEMA_VERSION` stays 1, because no project file exists before M5.
  - `src/extract/pipeline.ts`: `extractPalette({ width, height, data }, settings)`.
  - `src/extract/histogram.ts`: optional per-pixel `mask` and `weights`; keep each entry's bin index (`bins: Uint32Array`) for Wu.
  - `src/extract/worker.ts` and `src/extract/client.ts`: pass the analysis width and height.
  - `src/extract/applicability.ts`: support "not used by" entries as well as "only for" entries.
  - `tests/extract/helpers.ts`: `image(width, height, fn)` builder.
- Tests to write first:
  - `tests/state/defaults.test.ts` › "SPEC_DEFAULT_SETTINGS holds every 2.4 default": ignore dark, light and background off (thresholds 0.2 and 0.95); min chroma 0; vividness 0; merge 0.03; metric ΔE OK; uniform weighting; outlier off; 5 bits; 25 iterations and 3 restarts; seed 1; sort by population.
  - `tests/extract/histogram.test.ts`:
    - "an all-zero mask gives no bins"
    - "weights 2:1 make a 50/50 image count 2:1"
    - "bin index of #E8693A at 5 bits is (29 << 10) | (13 << 5) | 7"
  - `tests/extract/pipeline.test.ts` › "M1 settings give the same hexes as before for two-color, single-color and twelve-colors pixels" (pin the current outputs first).
  - `tests/extract/applicability.test.ts` › "a 'not used by' entry disables a setting for that algorithm and gives the note 'Not used by swatch roles'".
- Done when: tests pass; the e2e suite still passes unchanged; the mockup fixture picks up the new defaults through `SPEC_DEFAULT_SETTINGS`.
- [x] Done
  - Note: `ignoreDark` and `ignoreLight` are `{ on, threshold }`. The client already sent the fallback's width and height, so only the worker changed. The "not used by" table already holds decision 10c's swatch-roles entries for Colors, merge threshold and keep one outlier, because the T2 test needs a real entry. Swatch roles can't be selected until T6, so nothing visible changes; T6 adds vividness and wires the UI. `onlyForNote` is renamed `settingNote`. The fixture colors moved to `tools/fixture-colors.ts`, so tests can import them without running `make-fixtures.ts`.

### M2-T3: Wu quantizer
- Files:
  - `src/extract/wu.ts`: Wu 1992 over the histogram grid, (2^bits + 1)^3 cumulative moment tables. Boxes are cut in sRGB bin-index space; variance and means use the working-space color. Cuts maximize between-class variance (7.6).
  - `src/extract/pipeline.ts`: add the `wu` case; rename `M1_ALGORITHMS` to `AVAILABLE_ALGORITHMS` in spec 2.4 order.
  - `src/ui/SettingsControls.tsx`: Wu becomes selectable.
- Tests to write first:
  - `tests/extract/wu.test.ts`:
    - "single color with N=6 gives one cluster with population 1"
    - "two-color 75/25 with N=2 gives both exact colors at 0.75 and 0.25"
    - "fully transparent gives an empty result without throwing" (spec 8)
    - "the 12 TWELVE_COLORS pixels with N=12 give exactly those 12 hexes"
    - "N larger than the distinct colors returns at most the distinct count"
    - "same input twice gives identical output"
    - "works at 4, 5 and 6 bits"
  - `e2e/extract.spec.ts` › "switching to Wu re-extracts; two-color.png gives its two hexes".
- Done when: tests pass; at 256 px and 6 colors, Wu on the 12 MP generated image is logged next to median cut (informational).
- [x] Done
  - Note: the timing is logged by a unit test on the 12 MP gradient at its 256 × 192 analysis size: Wu 0.81 ms and median cut 1.06 ms for the quantizer alone (1,460 bins). The worker doesn't report its time to the page, so an e2e test can't log it. The Algorithm select now lists algorithms in spec 2.4 order.

### M2-T4: Balanced, vividness scoring, and Balanced as the default
- Files:
  - `src/extract/kmeans.ts`: an `initialCentroids` option; with it, one deterministic run.
  - `src/extract/balanced.ts`: Wu to N, then weighted k-means seeded from Wu, then ranking (decision 5a). Deterministic.
  - `src/extract/postprocess.ts`: the score `(1 − v) × population + v × min(1, C / 0.2)`, normalized (decision 5c).
  - `src/extract/histogram.ts`: before quantizing, each bin is weighted by `(1 − v) + v × min(1, C / 0.2)`. This applies to every algorithm except Exact colors and Swatch roles (decision 6).
  - `src/state/defaults.ts`: `DEFAULT_SETTINGS` equals `SPEC_DEFAULT_SETTINGS`, so Balanced is the default.
  - `src/extract/applicability.ts`: Iterations apply to Balanced; Seed and Restarts don't (decision 5b).
  - `src/ui/SettingsControls.tsx`: Balanced is no longer a disabled placeholder.
- Tests to write first:
  - `tests/extract/balanced.test.ts`:
    - "deterministic; changing the seed doesn't change the result"
    - "two-color 75/25 gives both exact colors"
    - "weighted SSE after refinement is never above the Wu seed's SSE on the same histogram (fixed mulberry32 seed 7, 2,000 random bins, N = 2, 6, 12)"
    - "stable on single-color, two-color and transparent inputs" (spec 8)
  - `tests/extract/postprocess.test.ts`:
    - "vividness 0 ranks a 60% #808080 ahead of a 10% #FF0000"
    - "vividness 1 ranks #FF0000 (C 0.258) first"
  - `tests/extract/histogram.test.ts` › "vividness 1 gives a #808080 bin weight 0 and a #FF0000 bin its full count".
  - `tests/state/defaults.test.ts` › "DEFAULT_SETTINGS.algorithm is 'balanced'".
  - `e2e/extract.spec.ts`:
    - "a new image extracts with Balanced and the Algorithm select shows Balanced"
    - "with Balanced, Seed and Restarts are disabled with their notes"
    - "re-extraction with Balanced at 256 px is logged" (spec 7.7 target about 150 ms, informational)
  - `e2e/mockup-state.spec.ts` › "Algorithm shows Balanced, enabled".
- Done when: tests pass; every e2e test that pinned hexes under the old k-means++ default is updated, or sets k-means++ explicitly; the reviewer checks that each change is a default change and not a regression.
- [x] Done
  - Note: no e2e test pinned k-means++ hexes. Two e2e tests used Seed under the old default ("working space, sample size, resampling and seed all re-extract", and "Median cut disables Seed…"). Both now select K-means++ first, and their assertions are unchanged. In unit tests, the k-means seed check in `pipeline.test.ts` now sets `algorithm: "kmeans"`.
  - Note: the Restarts row doesn't exist until T7, so for now the Balanced e2e test checks Seed and its note; T7 extends it to Restarts.
  - Note: vividness multiplies the bin weights, as decision 6 says, so with vividness above 0 the populations are shares of the weighted histogram. Grays (OKLab C below 1e-6, which is conversion noise) get weight exactly 0 at vividness 1. A purely gray image at vividness 1 therefore gives an empty palette. (Superseded by decision 6b in M2-T7: the weight now has a floor of 0.05, so a gray image still gives a palette.)
  - Note: re-extraction with Balanced at 256 px takes 187 to 197 ms of wall time across the five projects, including the 120 ms debounce.

### M2-T5: Exact colors, even spread, keep one outlier
- Files:
  - `src/extract/exact.ts`: counts exact 24-bit sRGB colors among kept, weighted pixels and takes the top N; ties go to the lower packed RGB. Leftover pixels count toward their nearest chosen color in the population (decision 12).
  - `src/extract/even-spread.ts`: the first pick is the heaviest bin; each next pick is the bin with the largest distance to its nearest pick (working-space Euclidean); ties go to the lower bin. Populations come from nearest assignment.
  - `src/extract/outlier.ts` (decision 8):
    - Extract N − 1 colors.
    - Split the histogram into 4N median-cut boxes.
    - Keep the box farthest from its nearest kept swatch, if it holds at least 0.1% of the pixels.
    - Distances use the distance metric (decision 7).
  - `src/extract/pipeline.ts`, `src/ui/SettingsControls.tsx`: both algorithms become selectable.
- Tests to write first:
  - `tests/extract/exact.test.ts`:
    - "three flat colors plus one stray pixel, N=3, give the three exact hexes"
    - "anti-aliased edge colors lose to the flat colors"
    - "never averages: every output is an input color"
    - "leftover pixels raise the population of their nearest chosen color"
    - stable on single-color, two-color and transparent inputs
  - `tests/extract/even-spread.test.ts`:
    - "bins #808080 ×100, #000000 ×1, #FFFFFF ×1 with N=3 pick in extracted order #808080, #000000, #FFFFFF" (OKLab distances 0.60 and 0.40)
    - deterministic
    - stable on the three spec 8 inputs
  - `tests/extract/outlier.test.ts`:
    - "50% #14386B, 48% #5039B0, 2% #1DB07A with k-means++ N=2: off gives no swatch within ΔE OK 0.02 of #1DB07A, on gives one"
    - "on with N=2 still returns 2 swatches"
    - "a single-pixel outlier below 0.1% is not kept"
  - `e2e/extract.spec.ts` › "Exact colors with Nearest resampling on twelve-colors.png gives all 12 hexes".
- Done when: tests pass.
- [x] Done
  - Note: the outlier box takes its own share, and the N − 1 kept colors give up that share in proportion, so populations still sum to 1. A box at distance 0 from every kept color isn't added: on a single-color image, keep one outlier adds nothing.
  - Note: keep one outlier applies to every algorithm except swatch roles, Exact colors included. With Exact colors, the outlier is a median-cut box mean, not an input color.
  - Note: the extra unit tests cover exact ties (lower packed RGB), even-spread nearest populations, and the outlier under CIEDE2000. The "refuses algorithms that aren't built yet" test now uses swatch roles.

### M2-T6: Swatch roles
- Files:
  - `src/extract/swatches.ts`: six roles in this order: Vibrant, Muted, Dark vibrant, Dark muted, Light vibrant, Light muted. Candidates come from a 64-box median cut and are chosen by the Vibrant.js HSL targets and windows in decision 10a. The role name goes in `Swatch.name` (3.1).
  - `src/state/extraction.ts`: carry the role names into the swatches. Empty roles are left out of the strip, with a muted note naming them (decision 10b).
  - `src/extract/applicability.ts`: Colors, merge threshold, keep one outlier and vividness are "Not used by swatch roles" (decision 10c). Their controls are disabled with the note, per M1 decision 14.
- Tests to write first:
  - `tests/extract/swatches.test.ts`:
    - "six candidates placed exactly on each role's targets map to their roles, in role order, with role names"
    - "a grayscale image leaves the vibrant roles empty and returns only filled roles"
    - "no candidate is used twice"
    - deterministic
    - stable on the three spec 8 inputs
  - `e2e/extract.spec.ts`:
    - "Swatch roles: Colors is disabled with 'Not used by swatch roles' (aria-describedby)"
    - "the selection label shows the role name, such as 'Vibrant'"
    - "swatch aria-labels carry the role names"
    - "grayscale-plus-red.png names its empty roles in a muted note"
- Done when: tests pass; token and axe cases cover the disabled Colors row and the empty-roles note in both themes.
- [x] Done
  - Note: roles claim candidates in Vibrant.js order (Vibrant, Light vibrant, Dark vibrant, Muted, Light muted, Dark muted), so no candidate is used twice; `swatchRoles` returns them in the listed role order. Candidate HSL comes from each box mean converted to sRGB (`rgbToHsl` in `src/color/convert.ts`). Swatch populations are the boxes' shares; the pipeline then ranks them like every other algorithm (normalized, by population while Sort is Population), because 10c doesn't exclude Sort. Merging is skipped for swatch roles.
  - Note: vividness reads "Not used by exact colors and swatch roles", because decision 6 says exact colors don't use it either; the T6 text names only swatch roles.
  - Note: the Colors note shows only while Colors is disabled, so the always-visible rows keep the mockup layout (Seed's note in Advanced is unchanged and always shown). The empty-roles note is a muted hint under the strip (desktop Palette column, phone Source and Palette tabs): "No color fits the Dark vibrant or Light vibrant roles." Its wording goes to design review.
  - Note: `grayscale-plus-red.png` belongs to T8's `make-fixtures.ts`, which runs in parallel, so T6's e2e, token and axe tests build it in memory (`e2e/helpers/grayscale-plus-red.ts`, 240 × 60, under the 256 px sample size). The T2 and T5 unit tests that assumed swatch roles wasn't available now exclude it, and "refuses algorithms that aren't built yet" became "refuses an unknown algorithm".

### M2-T7: Advanced settings, sort, and decimal fields
- Files:
  - `src/ui/SettingsControls.tsx`. Inside the existing collapsed Advanced row, after Sample size, Resampling and Seed, it adds these rows:
    - Iterations (5 to 100) and Restarts (1 to 10)
    - Histogram bits (4, 5, 6)
    - Merge threshold (slider and number, 0 to 0.15; 0 to 15 under CIEDE2000, decision 7)
    - Distance metric
    - Population vs. vividness (0 to 1)
    - Spatial weighting (the row is wired in T9)
    - Keep one outlier (toggle)
    - Sort
  - `src/ui/Toggle.tsx`: contract Components "Toggle": pill track, round thumb, off, on, disabled and focus states, 44 px at phone width.
  - `NumberField`: decimals and a step; shows a period; accepts "," or "." when typed; `inputmode=decimal`; 16 px below 1024 px.
  - `src/extract/postprocess.ts`: sorting by population, lightness (dark to light), chroma (high to low), hue (ascending from 0°) or as extracted (decision 16).
  - `src/state/mockup.ts`: `rows=advanced` opens the Advanced row.
- Tests to write first:
  - `tests/extract/postprocess.test.ts`:
    - "the six mockup hexes sorted by lightness give #14386B, #5039B0, #1E8A2E, #D4527F, #E8693A, #1DB07A (L 0.345 to 0.672)"
    - "chroma sorts high to low"
    - "hue sort is ascending from 0°"
    - "as extracted keeps the algorithm order"
  - `tests/ui/number-field.test.ts` › "'0,05' commits 0.05"; "shows '0.05' with the locale forced to de-DE".
  - `e2e/extract.spec.ts`:
    - "every Advanced control re-extracts"
    - "Merge threshold 0.15 on twelve-colors.png gives fewer swatches than 0"
    - "switching the metric to CIEDE2000 shows the threshold as 3.0"
    - "iterations and restarts are disabled for algorithms that don't use them, with the note"
  - `e2e/tokens.spec.ts` and `e2e/a11y.spec.ts` › the "Advanced open" case gains the new rows and the toggle in both states.
- Done when: tests pass; all Advanced rows are at least 44 px and reachable at 320 px with no horizontal scroll.
- [x] Done
  - Note: Spatial weighting is left out; M2-T9 adds its row in Advanced, after Population vs. vividness.
  - Note: decimal fields use T8's `DecimalField` (one decimal field, decision from the coordinator after T8 landed first). T7 extends it with a `step`, `role=spinbutton` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and `aria-valuetext`, arrow and Page Up/Down steps, and a commit on blur that clamps only out-of-range values, so a value typed before a metric switch isn't read again in the new units. T8's `DecimalSlider` gains `decimals` and `describedBy`; Merge threshold and Population vs. vividness use it. Whole-number fields (Colors, Seed, Iterations, Restarts, Alpha cutoff) stay `NumberField` number inputs. The planned `tests/ui/number-field.test.ts` cases ("'0,05' commits 0.05", "shows '0.05' with the locale forced to de-DE") are in `tests/ui/decimal-field.test.ts`.
  - Note: Merge threshold steps by 0.005 and shows 3 decimals ("0.030"); under CIEDE2000 it steps by 0.5 and shows 1 decimal ("3.0"). Population vs. vividness steps by 0.05 and shows 2 decimals. These steps and decimals aren't in the spec.
  - Note: Keep one outlier uses T8's `src/ui/Toggle.tsx` and its CSS (one Toggle). The Advanced row opens with `rows=advanced` through T8's `initialOpenRows` and comma-separated `rows`, so `rows=filters,advanced` opens both.
  - Note: every Advanced row follows decision 14c, Seed included: its note and `aria-describedby` show only while the row is disabled. Iterations, Restarts, Merge threshold, Population vs. vividness and Keep one outlier read the applicability tables. Histogram bits, Distance metric and Sort apply to every algorithm, so they have no note. The "Median cut disables Seed" e2e test now also checks that Seed's note is gone under k-means++.
  - Note: built on T6, T8, T10 and T11 (rebased onto milestone/M2 at 4837800). T6's `.slider:disabled` style covers the new disabled sliders. The Advanced e2e locators name the Advanced row, as T8's do.
  - Note: `.select__control` gained `min-width: var(--hit)`, because the Histogram bits select ("5") was 38 px wide at phone width.
  - Note: hue sort puts grays at 0°, the same rule as `oklabToOklch`. Ties in lightness, chroma and hue sorts keep the population order.
  - Note: decision 6b is in `weightByVividness`. Two T4 histogram tests changed with it: the gray bin now weighs 0.05 of its count at vividness 1 instead of 0.
  - Note: the `advanced-desktop` shot is 1280 × 1280, so the open rows fit without scrolling column 1. It has no baseline yet, so the `visual` CI job fails on it until sign-off. The token and axe lists use 1280 × 800. `mockup-state.md` lists `rows=advanced`.

### M2-T8: Pixel filters: dark, light, minimum chroma, alpha cutoff
- Files:
  - `src/extract/filters.ts`: a per-pixel keep mask from OKLab L and C, whatever the working space, plus the alpha cutoff.
  - `src/extract/pipeline.ts`: when every pixel is filtered out, return an empty result with the reason "all-filtered".
  - `src/state/extraction.ts`: show "Every pixel is filtered out. Loosen a filter." in the message region (decision 18).
  - `src/ui/SettingsControls.tsx`: a collapsed "Filters" chevron row after Working space (decision 2b) with:
    - Ignore dark (toggle, plus a threshold slider at 0.2)
    - Ignore light (toggle, plus a threshold slider at 0.95)
    - Minimum chroma (0 to 0.2)
    - Alpha cutoff (0 to 255)
    - A threshold is disabled, not hidden, while its toggle is off (M1 decision 14).
  - `src/state/mockup.ts`: `rows=filters`.
  - `tools/make-fixtures.ts`: `white-background.png` (80% #FFFFFF, 20% #E8693A disk) and `grayscale-plus-red.png` (a gray ramp with a #FF0000 band).
- Tests to write first:
  - `tests/extract/filters.test.ts`:
    - "ignore dark drops #000000 (L 0) and #111111 (L 0.173), keeps #333333 (L 0.321)"
    - "ignore light drops #FFFFFF (L 1.000) and #F5F5F5 (L 0.970), keeps #E0E0E0 (L 0.907)"
    - "min chroma 0.05 drops #808080 (C 0) and keeps #FF0000 (C 0.258)"
    - "alpha cutoff 200 drops alpha 199 and keeps alpha 200"
    - "filters behave the same in all four working spaces"
  - `tests/extract/pipeline.test.ts` › "every pixel filtered gives an empty palette with reason 'all-filtered', no throw".
  - `e2e/filters.spec.ts`:
    - "Ignore light on white-background.png leaves no swatch with L above 0.95"
    - "Minimum chroma 0.05 on grayscale-plus-red.png gives only red"
    - "filtering everything shows 'Every pixel is filtered out. Loosen a filter.' in a live region and an empty strip; loosening it brings the palette back"
    - "the threshold slider is disabled while its toggle is off"
- Done when: tests pass; the screens `pixel-filters-desktop` and `pixel-filters-phone` are in the token and axe lists.
- [x] Done
  - Note: #111111 has OKLab L 0.178, not 0.173 (culori agrees). The test asserts 0.178; it is still dropped at 0.2.
  - Note: `runExtraction` returns `{ colors, reason }`, and the worker, client and extraction state carry the reason. `extractPalette` still returns the colors only. "All filtered" counts the alpha cutoff, because it is in the Filters row, so a fully transparent image shows the message too.
  - Note: each threshold has its own row under its toggle ("Dark threshold", "Light threshold"), with a slider and a number field. Both run over OKLab L 0 to 1 in steps of 0.01. Minimum chroma steps by 0.01. Alpha cutoff has a slider and an integer field.
  - Note: built in parallel with T7, so `src/ui/Toggle.tsx` is a minimal toggle (a switch button) and `src/ui/DecimalField.tsx` is a minimal decimal field. Reconcile both with T7's Toggle and NumberField on merge.
  - Note: the existing e2e locators `details.chevron-row:visible summary` now name the Advanced row, since Filters is a second chevron row. `pixel-filters-desktop` and `pixel-filters-phone` are also in the review shot list, without a mockup. `rows` isn't in `mockup-state.md` yet; T13 records it.
  - Note: `tests/fixtures/grayscale-plus-red.png` is byte-identical to the in-memory image from T6's `e2e/helpers/grayscale-plus-red.ts` (240 × 60, red band on rows 24 to 35). With Swatch roles, an all-filtered result shows only the filter message, not six empty roles.

### M2-T9: Ignore background and spatial weighting
- Files:
  - `src/extract/background.ts` (decision 4):
    - Sample a border band 2% of the shorter side wide.
    - If one color (within ΔE OK 0.04) covers at least 50% of the band, flood-fill the pixels of that color connected to the border and remove them.
    - Otherwise remove nothing.
  - `src/extract/weighting.ts` (decision 9a):
    - Center: a Gaussian on the normalized distance from the center, σ 0.35.
    - Contrast: 0.25 plus the normalized Sobel magnitude of OKLab L.
    - Populations are weighted shares (decision 9b).
  - `src/ui/SettingsControls.tsx`:
    - An Ignore background row (Off or Auto) in Filters. When Auto finds nothing, it shows a muted "None found" note (decision 18).
    - A Spatial weighting row in Advanced.
  - `tools/make-fixtures.ts`: `studio-backdrop.png` (400 × 300, #ECEAE6 backdrop, a centered subject in #14386B and #E8693A, and an #ECEAE6 patch enclosed inside the subject).
- Tests to write first:
  - `tests/extract/background.test.ts`:
    - "studio-backdrop pixels: detects #ECEAE6 and removes it"
    - "the enclosed #ECEAE6 patch is kept"
    - "a border split into 4 colors, none above 50%, detects nothing"
    - "a 1 × 1 image doesn't throw"
  - `tests/extract/weighting.test.ts`:
    - "center weight is 1 at the center and falls monotonically to the corners"
    - "contrast weighting on a flat image equals uniform"
    - "center-weighted: a centered 30% #E8693A disk on 70% #14386B ranks #E8693A first by population"
  - `e2e/filters.spec.ts`:
    - "Ignore background Auto on studio-backdrop.png leaves no swatch within ΔE OK 0.04 of #ECEAE6"
    - "a busy border shows 'None found'"
- Done when: tests pass.
- [x] Done (the blocked e2e test was fixed; e2e and the review page passed at c448dcd)
  - Note: e2e pending: browsers unavailable. While this task was being built, the macOS login session changed, so no browser can launch in this process (`bootstrap_check_in` error 141). The new filters tests passed in Chromium before that, and so did the token and axe cases and the Advanced e2e changes. The full five-project run is still to do.
  - Note (open question): the plan's e2e "Ignore background Auto on studio-backdrop.png leaves no swatch within ΔE OK 0.04 of #ECEAE6" can't hold together with the planned fixture and the unit test "the enclosed #ECEAE6 patch is kept". The kept patch forms its own small swatch (#E8E6E3 in Chromium, the 4th of 4). That test is not written. In its place, an extra e2e test checks that the backdrop is removed: the subject's two colors lead, and at most one swatch, the smallest, stays near #ECEAE6. To settle it, either allow the patch's small swatch in the e2e test, or shrink the patch to 1 or 2 px so that resampling at 256 px smears it away. The second option relies on how each browser resamples.
  - Note (2026-11-19, full five-project run): the studio-backdrop test failed in Firefox only. The resampled edges between the navy half and the patch form a swatch of their own, which Chromium ranks above the patch (#1E4171, 1.2%) and Firefox below it (#214372, 0.1%), so the patch's swatch isn't always the smallest. The test no longer checks its rank. It checks that at most one swatch is near #ECEAE6 and that its share is at most twice the patch's area share of the subject (0.33%); a backdrop that was left in would be far larger. The subject's two colors must still lead.
  - Note: the band is round(2% of the shorter side), at least 1 px. A pixel below the alpha cutoff is never background, but it still counts in the band, so a mostly transparent border has no background. The background color is the mean OKLab of the most common 4-bit sRGB bin in the band, re-centered once on the band pixels within ΔE OK 0.04 of it. The flood fill is 4-connected and starts from the outermost ring of pixels. Removed pixels join the filter mask in `keepMask(image, settings)` in `pipeline.ts`, so an image that is all background gives "all-filtered".
  - Note: the center weight uses the distance from the center divided by the distance to a corner, with each axis normalized to −0.5 to 0.5. With the corner at 1, the 30% disk test passes. With the raw −0.5 to 0.5 distance, it would not: the disk gets about 45%. The contrast weight divides the Sobel magnitude by the image's largest magnitude, with edge pixels repeated past the border. Weights reach the histogram and exact colors, so every algorithm uses them.
  - Note: "None found" is the Ignore background row's note (`SettingRow` gains `live`). Its `role=status` span stays in the page, empty, so the change is announced. The select's `aria-describedby` points to it only while it shows. It is a status note, so decision 14c doesn't apply. Ignore background is a select (Off, Auto) between Light threshold and Minimum chroma (decision 2b order). Spatial weighting uses the spec 2.4 labels: Uniform, Center-weighted, Edge/contrast-weighted. `ExtractionResult.background` ("found" or "none") is left out while Ignore background is off, so existing deep-equal tests are unchanged. The worker, message, client and signal changes are one field each.
  - Note: `studio-backdrop.png` geometry lives in `tools/fixture-colors.ts` (`STUDIO_BACKDROP`, `studioBackdropColor`): a 200 × 150 subject, #14386B on the left and #E8693A on the right, with a 10 × 10 patch in the #14386B half. Token and axe cases cover the "None found" note in both themes, desktop and phone. The 320 px Advanced test also checks the longest Spatial weighting option.
  - Note (CI, Linux WebKit): the near swatch's share was 2.0% against the 0.67% bound (twice the patch's share), because WebKit's downscale blends more edge pixels into it. The bound is now at most 5% of the kept pixels, far below the backdrop's own 75% share; the subject's two colors must still lead and at most one swatch may be near #ECEAE6.

### M2-T10: Zoom and pan: viewport model, zoom controls, desktop input
- Files:
  - `src/image/viewport.ts`: pure math for scale and offset:
    - `zoomAt(view, factor, anchor)`
    - `panBy(view, dx, dy)`
    - `clampView(view, well)`: scale 1 (fit) to 8, and the image always covers the well when zoomed
    - `fit()`
  - `src/state/signals.ts`: an `imageView` signal. It is view state: not saved in the project and not in undo (spec 3.6). It resets to Fit on a new image.
  - `src/ui/ImageWell.tsx`: the image content (canvas or the demo `<img>`) sits in a transformed layer. On desktop, drag pans once zoomed. Ctrl/Cmd + wheel and trackpad pinch (a wheel event with `ctrlKey`) zoom around the pointer; a plain wheel scrolls the page as before (decision 15f). The well is focusable: + and − zoom, 0 fits, and the arrows pan by 10% of the visible area.
  - `src/ui/ZoomControls.tsx`: icon buttons Zoom out, Zoom in and Fit, using Lucide `ZoomOut`, `ZoomIn` and `Maximize` (decision 15e):
    - in the image well's bottom-right corner
    - labelled for screen readers, with the zoom level announced ("200%")
    - 44 px at phone width
    - the buttons step through 100%, 200%, 400% and 800%
    - disabled at the ends of the range
  - `src/state/mockup.ts`: `zoom=<2|4|8>` opens the image at that zoom, centered.
  - `src/styles/app.css`.
- Tests to write first:
  - `tests/image/viewport.test.ts`:
    - "zoomAt from scale 1 to 2 with the anchor at the center of a 400 × 200 well gives offset (−200, −100)"
    - "the anchor point stays under the pointer for any factor"
    - "scale clamps to 1 and 8"
    - "at scale 2 in a 400 px wide well, x offset clamps to −400 to 0"
    - "fit() gives scale 1, offset 0"
    - "panBy at scale 1 doesn't move"
  - `e2e/zoom.spec.ts`:
    - "Zoom in twice gives 400% and the label says so; Fit returns to 100%"
    - "Ctrl + wheel over the image zooms around the pointer; a plain wheel scrolls the page"
    - "drag pans when zoomed and does nothing at Fit"
    - "keyboard: focus the image, + zooms, arrows pan, 0 fits"
    - "zooming never re-runs extraction (job count unchanged)"
    - "loading a new image resets to Fit"
    - "zoom isn't written to storage and isn't in the URL"
    - "zoom controls are at least 44 × 44 at phone width"
    - "the zoomed image keeps its colors in light and dark" (theme-content style)
  - `e2e/mockup-state.spec.ts` › "zoom=2 opens at 200%".
- Done when: tests pass; `zoom-desktop` and `zoom-phone` are in the token and axe lists and the shot list.
- [x] Done
  - Note: `fit()` is named `fitView()`, because Biome reads a `fit(` call as a focused test. `zoomAt` and `panBy` take the well size as a last argument, since the clamp needs it. `imageView` keeps offsets as fractions of the well, so a view survives a resize. At the ends of the range the buttons are `aria-disabled`, so keyboard focus stays on them. The zoom level is announced in a visually hidden live region; nothing visible shows the percentage. The existing theme-content test now hides the zoom controls (themed UI over the image) before its image shot, through the element's style because the CSP blocks injected style sheets. `playwright.config.ts` reads `E2E_PORT` (default 4173) and starts `vite preview` on it with `--strictPort`. The shots have no mockup (zoom isn't drawn); `mockup-state.md` and `visual-testing.md` list `zoom` and the two shots.

### M2-T11: Zoom and pan: touch gestures
- Files:
  - `src/image/viewport.ts`: `pinch(view, startPointers, currentPointers)`, which scales by the change in distance about the midpoint and pans by the midpoint's movement.
  - `src/ui/ImageWell.tsx` and `src/styles/app.css` (spec 6.1 "Gestures" and "Callouts"):
    - pointer events with pointer capture
    - two pointers pinch-zoom; one pointer pans
    - `pointercancel` ends the gesture and keeps the last valid view
    - at Fit, `touch-action: pan-x pan-y` so a one-finger swipe scrolls the page and only a two-finger pinch is handled; above Fit, `touch-action: none` so one finger pans the image (decision 15h)
    - `-webkit-touch-callout: none` and `user-select: none` on the well
    - updates once per animation frame
- Tests to write first:
  - `tests/image/viewport.test.ts`:
    - "a pinch from 100 px apart to 200 px apart doubles the scale about the midpoint"
    - "a pinch that moves its midpoint by (30, 0) also pans by (30, 0) when not clamped"
    - "a pinch below scale 1 clamps to Fit"
  - `e2e/zoom.spec.ts`:
    - "one-finger drag pans a zoomed image and window.scrollY stays the same" (phone-webkit, phone-chromium)
    - "at Fit, a one-finger swipe on the image scrolls the page" (phone-webkit, phone-chromium; decision 15h)
    - "two-finger pinch zooms" (phone-chromium, via CDP `Input.dispatchTouchEvent`; WebKit is a manual check)
    - "pointercancel mid-gesture leaves a valid view"
    - "the well has touch-action pan-x pan-y at Fit and none when zoomed; the callout is off"
- Done when: tests pass; nothing depends on hover.
- [x] Done
  - Note: `pinch` takes the well size as a last argument, like `zoomAt` and `panBy`. Lifting one finger of a pinch carries on as a one-finger pan; a third finger is ignored. The image and its layer use `touch-action: inherit`, so the well alone decides, and M1's mockup-state check that the image is `none` now expects `pan-x pan-y` at Fit (decision 15h). Playwright can inject real touches only in Chromium (CDP), so on phone-webkit the one-finger tests drive the well with synthetic pointer events, and "a swipe at Fit scrolls the page" checks the well's `pan-x pan-y` and that the handlers take nothing; the real WebKit scroll is a manual check. `-webkit-touch-callout` is iOS only and no Playwright engine computes it, so the test reads it from the shipped style sheet. Safari on macOS sends trackpad pinch as gesture events rather than Ctrl + wheel, so the well also zooms on `gesturechange` when no pointer is down (manual check: desktop Safari).

### M2-T12: Presets
- Files:
  - `src/extract/presets.ts`:
    - the six presets of spec 2.5 as field patches
    - `applyPreset` follows decision 11: the preset sets the fields it names and resets the other preset fields (algorithm, vividness, ignore dark and light, merge, resampling, outlier) to their defaults. It keeps Colors (except Dominant and Balanced, which set 6), Working space, Sample size, Seed and the filters it doesn't name.
    - `matchPreset` returns a preset id or "custom".
  - `src/ui/SettingsControls.tsx`: a Preset row above Algorithm (decision 2a), reading "Custom" when no preset matches.
- Tests to write first:
  - `tests/extract/presets.test.ts`:
    - "Dominant: median-cut, 6 colors, merge 0.03"
    - "Balanced: balanced, 6 colors"
    - "Vibrant: k-means, vividness 0.6, ignore dark and light on"
    - "Flat art: exact, nearest, merge 0"
    - "Accents: even spread, keep outlier on"
    - "Swatch roles: swatch-roles"
    - "apply then match returns the same preset, for all six"
    - "Vibrant keeps a Colors value of 8 and a Working space of CIELAB"
    - "after Vibrant, Accents turns ignore dark and light off again"
    - "changing any field a preset sets afterwards matches 'custom'"
    - "the mockup fixture's settings match Balanced"
  - `e2e/presets.spec.ts`:
    - "Flat art on twelve-colors.png gives all 12 hexes"
    - "Vibrant on white-background.png has no swatch above L 0.95"
    - "changing Colors after Dominant shows Custom"
    - "the Preset select is keyboard operable and 44 px at phone width"
  - `e2e/mockup-state.spec.ts` › "Preset reads Balanced".
- Done when: tests pass; studio-desktop, source-phone and studio-tablet review shots are regenerated (the Preset row changes them).
- [x] Done (e2e and the review page passed at c448dcd)
  - Note: the ignore dark and light preset fields are the toggles only. Their thresholds aren't in decision 11's list, so a preset keeps them, and `matchPreset` ignores them. It also ignores T9's ignore background and spatial weighting, and every other field a preset keeps.
  - Note: numbers match within 1e-9, so values the decimal fields commit (such as 0.6) still match. Each preset has its own algorithm, so at most one matches.
  - Note: the Custom option is listed, disabled, only while no preset matches, as the Algorithm select does for an unavailable algorithm. Choosing a preset replaces the whole settings object once, so it re-extracts once.
  - Note: `e2e/filters.spec.ts` "the Filters row starts collapsed after Working space" now expects Preset before Algorithm (decision 2a). `e2e/presets.spec.ts` adds "the Preset row sits above Algorithm and starts at Balanced" and "the Algorithm select follows a preset". The keyboard test focuses the select directly in WebKit, which tabs only to some form controls by default (as `zoom.spec.ts` does), and uses type-ahead elsewhere after Tab.
  - Note: `ui-contract.md` still lists "Algorithm, Colors, Working space" for the Image view rows. The Preset row goes to design review (decision 2a); the contract wasn't edited.
  - Note: Playwright browsers couldn't launch in the T12 worktree (Chromium's mach-port check-in fails and WebKit aborts, inside and outside the sandbox), so the e2e suite and `npm run visual:review` haven't run on this commit yet.
  - Note: on milestone/M2 (with T9 and T13), "changing Colors after Dominant shows Custom" failed: the Colors field kept its typed draft "8" after the preset set 6, because a draft was only dropped on blur. The integer field and `DecimalField` now drop a draft that no longer matches a value changed from elsewhere. They do it in a layout effect: a deferred `useEffect` could run after the user had typed again and drop the new draft, which made the T7 test "decimal fields step with the arrow keys and clamp on commit" read 0.00 instead of 1.00 under load in the full run. The targeted e2e specs (filters, presets, mockup-state, extract, theme-content) then passed in chromium, phone-chromium and phone-webkit; `npm run visual:review` is still to run.

### M2-T13: Cluster map engine (worker)
- Files:
  - `src/extract/cluster-map.ts`: `assignPixels(image, keepMask, colors, space)` gives a `Uint8Array` with the nearest swatch index per analysis pixel, 255 for filtered pixels, plus a share per swatch (decision 13a).
  - `src/extract/messages.ts`: the `extracted` reply carries `map` (width, height, transferred buffer); a new `assign` request rebuilds the map for a given palette without extracting, which M3 will also need.
  - `src/extract/worker.ts`, `src/extract/client.ts`.
  - `src/state/signals.ts`: a `clusterMap` signal.
  - `src/state/extraction.ts`: store it with the palette.
  - `src/state/mockup.ts` and `src/state/mockup-fixture.ts`. Demo mode decodes `mockup-scene.png` from BASE_URL, prepares it in the worker and calls `assign` with the fixture palette. The image well keeps showing the fixture `<img>`. No extraction runs and no storage is touched. The fixture populations become 0.832, 0.147 and 0.005 × 4, normalized (decision 14a).
  - `docs/design/mockup-state.md`: record those populations and the new `rows`, `cluster` and `zoom` parameters.
- Tests to write first:
  - `tests/extract/cluster-map.test.ts`:
    - "a two-color image with palette [A, B] labels every pixel exactly"
    - "filtered pixels are 255"
    - "shares over kept pixels sum to 1 within 1e-9"
    - "uses the working space of the settings"
  - `tests/state/mockup.test.ts` › "fixture populations are 0.832, 0.147, 0.005 × 4, normalized to sum 1, in swatch order 2, 1, 3 to 6".
  - `tests/extract/client.test.ts` › "assign resolves with the map; the buffer is transferred".
  - `e2e/mockup-state.spec.ts`:
    - "demo map shares: swatch 2 83.2%, swatch 1 14.7%, swatches 3 to 6 0.5% each (±0.3 pp, mockup-state.md)"
    - "still no localStorage or IndexedDB access"
- Done when: tests pass; no UI-thread code loops over the map's pixels; the overlay is drawn from an `ImageData` built in the worker, or through a canvas `putImageData` of a worker-made buffer.
- [x] Done
  - Note: the map is a `ClusterMap` (`width`, `height`, `labels: Uint8Array`, `shares`); the worker transfers `labels.buffer`. Shares are plain pixel counts over the kept pixels, without spatial weighting. The overlay itself is T14.
  - Note: `pipeline.ts` gains `keepPixels(image, settings)`. `runExtraction` takes its result as an optional third argument, so the extraction and its map use one keep mask. T9's background removal belongs in `keepPixels`.
  - Note: the demo loader is a new `src/state/mockup-map.ts`, started from `main.tsx`. This keeps fetch and worker code out of `mockup.ts`. It decodes the fixture with `decodeImageFile`, calls `prepare` and then `assign`, and stores the map only while the fixture palette is still shown and no image has been loaded.
  - Note: each strip swatch carries `data-share` while the map matches the palette. The e2e share test reads it, and it needs no UI change. The shares come out within ±0.3 pp at the 256 px analysis size in every browser project.
  - Note: the M1 e2e test "the mockup state shows its fixture without running extraction" (`e2e/extract.spec.ts`) used to assert that the page had no worker. T13's demo needs a worker to prepare the fixture and run `assign`, so that check is out of date. The test now records the messages sent to the worker, waits for the demo map, and asserts that no `extract` job was sent and the strip still has 6 swatches. This is the test's real intent: no extraction. Approved by the coordinator.

### M2-T14: Cluster map overlay, zoom-aware, with its no-hover path
- Files:
  - `src/ui/ClusterOverlay.tsx`: a canvas inside the image well's transformed layer, so it follows zoom and pan. It is `data-user-content`. The swatch's pixels show unchanged and every other pixel is dimmed toward a neutral mid-gray at about 70%, the same in both themes (decision 13b).
  - `src/ui/SwatchStrip.tsx`: hover (`pointer: fine`) and keyboard focus show the map.
  - `src/ui/SwatchStrip.tsx` (`SelectionLabel`): the share line, such as "Swatch 3 · 0.5% of the image" (decision 13c).
  - `src/ui/PalettePanel.tsx`: a "Cluster map" toggle row on the phone Palette tab that shows the selected swatch's map; it moves into the swatch sheet in M3 (decision 13d).
  - `src/state/mockup.ts`: `cluster=<1 to 6>` shows that swatch's map.
- Tests to write first:
  - `e2e/cluster-map.spec.ts`:
    - "hovering swatch 3 in demo mode shows the overlay; its undimmed pixels lie within 0.05 of (0.769, 0.167)"
    - "the label reads 'Swatch 3 · 0.5% of the image'"
    - "Tab focus on a swatch shows it; blur hides it"
    - "phone: the Cluster map toggle on the Palette tab shows the selected swatch's map" (phone-webkit, phone-chromium)
    - "at zoom 4 centered on (0.769, 0.167), the overlay stays aligned with the patch"
    - "while extracting, the old map stays dimmed with the palette"
  - `e2e/theme-content.spec.ts` › "overlay pixels are identical in light and dark".
  - `e2e/tokens.spec.ts`, `e2e/a11y.spec.ts` › `cluster-map-desktop`, `cluster-map-phone` and the Palette tab with the toggle, in both themes.
- Done when: tests pass; nothing depends on hover (phone acceptance 2); the review page has the new shots; `visual-testing.md` lists every new shot.
- [x] Done
  - Note: e2e and review page pending: browsers unavailable. Lint, typecheck, unit tests and build pass; the e2e specs are written but not yet run.
  - Note (orchestrator decision, provisional, pending the user): the "% of the image" share is the plain pixel share from the cluster map (kept pixels nearest the swatch over all kept pixels), not the swatch's weighted population.
  - Note: the selection label names the swatch whose map is showing, with its share ("Swatch 2 · 83.2% of the image" while swatch 2 is hovered, even with swatch 3 selected), so hovering any swatch shows its own share as spec 2.6 asks. With no map showing it reads "Swatch 3" as before, so the mockup shots keep their label. Confirmed by the user on 2026-11-19 (decision 13e).
  - Note (merge onto milestone/M2, 2026-11-19): the `overlay` request dims every label but the shown swatch's, so it follows the map's keep mask, which since the T13 merge is `keepPixels` (filters plus Ignore background). In "Tab focus on a swatch shows it", WebKit focuses the swatches directly instead of pressing Tab, as `zoom.spec.ts` and `presets.spec.ts` do. The computed demo shares vary by browser within `mockup-state.md`'s ±0.3 pp (chromium: 14.86%, 83.09%, 0.55%; phone-webkit: 14.69%, 83.26%, 0.56%), so exact labels for swatches 1, 2 and 4 failed in some projects. Swatch 3 is 0.49% ("0.5%") everywhere and keeps its exact check.
  - Note (coordinator decision, 2026-11-19): the swatch 1, 2 and 4 label checks now expect the swatch's own `data-share` formatted by `shareText`, and separately check that share against `mockup-state.md` to ±0.3 pp.
  - Note: the overlay pixels are built in the worker by a new `overlay` request (`overlayPixels` in `cluster-map.ts`) from a copy of the map's labels, then `putImageData` into a canvas at analysis size, scaled without smoothing (`image-rendering: pixelated`). They're cached per map and swatch. Mid-gray is sRGB 128 (#808080) at alpha 179 (70%).
  - Note: hover counts only for a mouse with `(pointer: fine)`; focus counts only when it is `:focus-visible`, so a click or tap never leaves a map showing. Precedence: hover, then focus, then the demo's `cluster` pin, then the phone toggle. The toggle row sits under the selection label on the phone Palette tab. Turning the toggle on or off clears the demo pin.
  - Note: while extracting, the overlay carries `data-busy` and the strip's 0.6 opacity. The test "overlay and the ROI outline" isn't in this plan's list, so there was nothing to remove (no region of interest, decision 15a).
  - Note: "undimmed pixels lie within 0.05 of (0.769, 0.167)" measures both axes in image widths (the patch's 46 px radius is 0.0575 of the 800 px height), and also checks their centroid.
  - Note: `e2e/visual/ready.ts` waits for the overlay on `cluster=` URLs and for no `[data-settling]` element. Two existing tests that click a swatch and then read the selection label (`e2e/mockup-state.spec.ts`, `e2e/extract.spec.ts`) now move the mouse off the strip first, since hovering shows the share.

## Screens affected (UI work only)

| Screen | ui-contract regions | New or changed screenshots | Mockup-state additions | Not-drawn items needing design review |
| --- | --- | --- | --- | --- |
| Desktop Studio view | Column 1 item 1 (image well: zoom controls, cluster overlay); item 4 (setting rows: Preset, Algorithm with all seven, Filters row, Advanced rows); Column 2 items 1 and 2 (strip hover and focus, share in the selection label) | changed: studio-desktop. New: pixel-filters-desktop (`?demo=mockup&rows=filters`), advanced-desktop (`&rows=advanced`), zoom-desktop (`&zoom=2`), cluster-map-desktop (`&cluster=3`) | `rows=filters\|advanced`, `zoom=<2\|4\|8>`, `cluster=<n>`; fixture populations (decision 14a) | Preset row; Filters row and its rows; new Advanced rows; Toggle component; zoom controls in the well's corner; cluster overlay look and share label; "None found" and all-filtered messages; the empty-roles note; disabled rows with their "Used by" and "Not used by" notes |
| Phone Source tab | items 1 and 5 (image well, setting rows) | changed: source-phone. New: pixel-filters-phone (`?demo=mockup&rows=filters`), zoom-phone (`&zoom=2`), cluster-map-phone (`&cluster=3`) | as above | same as desktop at phone width |
| Phone Palette tab | strip and selection label, plus the Cluster map toggle row | changed: palette-phone | none | the Cluster map toggle row (spec 6.1 puts it in the M3 swatch sheet) |
| Tablet | as phone (contract "Tablet") | changed: studio-tablet | none | as phone |
| Empty screens | unchanged | none | none | none |

The design-doc updates were approved under decision 14b; `zoom` is new and needs the user's approval (decision 15g). `visual-testing.md` gains the new shots and `mockup-state.md` the new parameters and populations. The `visual` CI job will fail on the changed shots until the user signs off and `visual-baselines.yml` is run. No baseline is updated by any task.

## Acceptance checklist (copied from the spec)

- [ ] Switch algorithm and settings with live updates; the same seed gives the same palette. (spec 8, v1 acceptance 2; now all seven algorithms and every 2.4 setting except region of interest, decision 15)
- [ ] ΔE implementations against published reference data (for CIEDE2000, the Sharma test pairs). (spec 8)
- [ ] K-means output identical for the same seed, and every algorithm stable on single-color, two-color and fully transparent images. (spec 8)
- [ ] Fixture images: photo with dominant sky, flat illustration, pixel art, low-contrast scene, mostly white background, transparent PNG, grayscale, very large image. (spec 8; M2 adds the generated extraction fixtures it uses)
- [ ] Hovering a swatch highlights the pixels that contributed to it as an overlay on the image and shows its population share. (spec 2.6)
- [ ] Presets Dominant, Balanced (default), Vibrant, Flat art, Accents and Swatch roles as defined. (spec 2.5)
- [ ] Every 2.4 setting has its range and default (Number of colors 2 to 12, default 6), except region of interest. (spec 2.4, decision 15)
- [ ] Image view: zoom and pan. (spec 6)
- [ ] Gestures: one finger elsewhere pans, two fingers pinch-zoom the image; `touch-action: none` on the image while zoomed (at Fit, page scroll is allowed, decision 15h); pointer events with pointer capture; `pointercancel` handled. (spec 6.1; marker drags are M3)
- [ ] Callouts: the iOS image callout and text selection are off on the image. (spec 6.1)
- [ ] View state (zoom, selection) isn't recorded in history. (spec 3.6; undo itself is M3, so M2 keeps zoom out of the project and storage)
- [ ] Debounce settings changes (about 120 ms); stale results are dropped; a progress indicator shows only after about 300 ms. (spec 7.4; existing, now covering the new settings)
- [ ] Re-extraction after a settings change under about 150 ms at 256 px. (spec 7.7, to be validated; logged for Balanced)
- [ ] Keyboard-operable with visible focus and sufficient UI contrast; the phone (6.1) and theme (6.2) acceptance lists pass. (spec 8, v1 acceptance 10, for M2 features, including zoom from the keyboard)
- [ ] Theme 3: Swatch, image and gradient colors are identical in both themes. (spec 6.2; adds the cluster overlay and the zoomed image)
- [ ] Theme 4: All text and controls meet AA contrast in both themes. (spec 6.2; markers remain M3)
- [ ] Phone 1: Every feature in Parts 1 and 2 is reachable on a 320 px wide screen without horizontal scrolling. (spec 8, M2 features)
- [ ] Phone 2: All controls are at least 44 × 44 px, and nothing depends on hover. (spec 8; the cluster-map toggle, zoom controls, toggles)
- [ ] Phone 4: Text fields don't trigger Safari's focus zoom. (spec 8; new number fields)
- [ ] Messages are plain sentences with at most one action, heard through a live region. (spec 6.3; all-filtered and "None found")
- [ ] Token conformance passes on every new and changed screen, desktop and phone, both themes. (`visual-testing.md` 1)
- [ ] The review page includes the new shots; baselines change only through `visual-baselines.yml` after sign-off. (`visual-testing.md` 2, 3)
- [ ] `?demo=mockup` shows the fixture with Balanced and never touches localStorage or IndexedDB. (`mockup-state.md`, spec 5.5)

## Manual checks for a person

- [ ] Real iPhone:
  - pinch-zoom and one-finger pan the image with no page zoom, scroll or callout
  - zoom buttons work
  - the Cluster map toggle works
  - the Filters and Advanced fields don't zoom on focus
  - check how page scrolling feels when a swipe starts on the image (see Risks)
- [ ] Android with Chrome: the same zoom, pan and cluster-map checks.
- [ ] Desktop Safari and Firefox: trackpad pinch zooms the image, not the page.
- [ ] Judge each preset on a few real photos, pixel art and a logo: Dominant, Balanced, Vibrant, Flat art (exact colors), Accents and Swatch roles give sensible results. No reference values exist for this.
- [ ] Ignore background on a real product photo against a studio backdrop.
- [ ] Time to re-extract with Balanced at 256 px on a mid-range laptop and a phone (target about 150 ms, spec 7.7).
- [ ] Non-text contrast (3:1) of the toggle track and the zoom buttons over very light and very dark images, in both themes.
- [ ] Open `artifacts/visual-review/index.html`, compare it with the mockups and the contract, and sign off or list changes.
- [ ] Design review of the not-drawn items in the table above.
- [ ] After sign-off, run `visual-baselines.yml` on milestone/M2 and check the committed baselines.

## Risks

- Scope: 14 tasks, above M1's 13. The user chose one milestone (decision 17).
- The default changes to Balanced in T4, so every e2e test that pins hexes under k-means++ changes at once. Each change must be checked as a default change, not a hidden regression.
- Balanced (Wu + k-means) and per-pixel filters at "full" sample size may miss the 150 ms target; spec 7.7 marks it "to be validated".
- Wu at 6 bits uses 65³ moment tables (about 11 MB in Float64): fine on desktop, worth watching on older iPhones.
- At Fit the image allows page scroll (decision 15h), so a pinch that starts as a one-finger swipe can turn into a page scroll and a `pointercancel`. A pinch with both fingers down must still zoom; check it on real phones.
- Zoom scales the display copy, which is capped at 2048 px (M1 `DISPLAY_MAX`). At 400% to 800%, large photos look soft (decision 15c).
- Multi-touch pinch can be automated only in Chromium (CDP). WebKit pinch is a manual check.
- M3 adds marker drags on the same gestures; spec 6.1 already splits them (one finger on a marker drags it, elsewhere it pans), so M3 hit-tests markers first.
- Demo mode now starts the worker for the cluster map. It must stay assignment-only, never extraction (`mockup-state.md`). The 0.5% patch shares were specified at full resolution; at 256 px, smoothing at the patch edges could push them near the ±0.3 pp tolerance.
- The cluster map is computed at analysis resolution (256 px), so it looks blocky when scaled, and more so when zoomed. The design review decides whether that is acceptable.
- Changed review shots fail the `visual` CI job until sign-off and the baseline workflow run; this is expected, not a reason to update baselines early.

## Decisions (answered by the user, 2026-11-18)

Decisions 1 to 14 and 16 to 18 accept the proposed option A. Decision 15 changes the plan, as decided by the user. Sub-items marked "default" fill gaps the spec leaves for zoom and pan. They follow spec 6, 6.1 and 3.6 and need only a yes from the user (decision 15g).

1. **Scope.** M2 builds every remaining 2.4 setting except the region of interest (decision 15).
2. **Placement.**
   - a. A Preset row above Algorithm. It is a new always-visible row, approved here and checked again at design review (spec 6.6 rule 5).
   - b. A collapsed "Filters" chevron row after Working space, holding Ignore dark, Ignore light, Ignore background, Minimum chroma and Alpha cutoff. Everything else goes in Advanced.
3. **Thresholds.** Ignore dark below OKLab L 0.2 and ignore light above 0.95, each adjustable with a slider.
4. **Ignore background.**
   - Sample a 2% border band.
   - A color within ΔE OK 0.04 that covers at least 50% of the band is the background.
   - Remove its pixels connected to the border (flood fill).
   - If no color qualifies, remove nothing and show "None found".
4b. **Studio-backdrop test** (user decision, 2026-11-19, T9). The e2e test of Ignore background on `studio-backdrop.png` allows the enclosed patch's small swatch near #ECEAE6, as the test is written.
5. **Balanced.**
   - a. Wu to N, then k-means seeded from Wu, then ranking; deterministic.
   - b. Iterations apply; Seed and Restarts don't. This settles M1 report note 4.
   - c. Score: `(1 − v) × population + v × min(1, C / 0.2)`, normalized.
6. **Vividness.** Bins are weighted by `(1 − v) + v × min(1, C / 0.2)` before quantizing, and results are ranked by the same score. Exact colors and Swatch roles don't use it.
6b. **Vividness floor** (user decision, 2026-11-18). The bin weight has a floor of 0.05: weight = max(0.05, (1 − v) + v × min(1, C / 0.2)). So a fully gray image at vividness 1 still gives a palette. With vividness above 0, populations are shares of the weighted histogram. The ranking score of decision 5c is unchanged.
7. **Distance metric.** It governs the merge threshold and the outlier distance; clustering stays Euclidean in the working space (7.6). Under CIEDE2000 the threshold is in ΔE00 units: range 0 to 15, default 3.0.
8. **Keep one outlier.** Extract N − 1 colors, then add the box from a 4N median-cut split that is farthest from its nearest kept swatch and holds at least 0.1% of the pixels.
8b. **Keep one outlier under Exact colors (user decision, 2026-11-19; fix M2-F6).** With Exact colors the outlier is the most distinct actual 24-bit input color: the one farthest from its nearest kept swatch, among colors holding at least 0.1% of the kept pixels. It isn't a median-cut box mean, so spec 2.2's "real colors only" holds. Other algorithms are unchanged.
9. **Spatial weighting.**
   - a. Center: a Gaussian with σ 0.35. Contrast: 0.25 plus the normalized Sobel magnitude of L.
   - b. Populations are weighted shares.
10. **Swatch roles.**
    - a. The Vibrant.js HSL windows (Dark L 0.26, max 0.45; Normal 0.5, 0.3 to 0.7; Light 0.74, min 0.55; Vibrant S 1, min 0.35; Muted S 0.3, max 0.4; weights saturation 3, lightness 6, population 1). Candidates come from a 64-box median cut.
    - b. Empty roles are left out of the strip, with a muted note naming them.
    - c. Colors, merge threshold, outlier and vividness are disabled, with "Not used by swatch roles".
11. **Presets.**
    - A preset sets the fields it names and resets the other preset fields to their defaults.
    - It keeps Colors (Dominant and Balanced set 6), Working space, Sample size, Seed and the filters it doesn't name.
    - When no preset matches, the row reads "Custom".
11b. **Presets and filter thresholds** (user decision, 2026-11-19, T12). A preset switches only the Ignore dark and Ignore light toggles and keeps their threshold values. Matching a preset ignores the thresholds.
12. **Exact colors.** Exact 24-bit counts; leftover pixels count toward their nearest chosen color.
13. **Cluster map.**
    - a. A swatch's pixels are those that pass the filters and are nearest to it in the working space.
    - b. Every other pixel is dimmed toward a neutral mid-gray at about 70%, the same in both themes.
    - c. The share shows in the selection label: "Swatch 3 · 0.5% of the image".
    - d. On phones, a temporary "Cluster map" toggle row sits on the Palette tab and moves into the swatch sheet in M3.
13e. **Selection label** (user decision, 2026-11-19, T14). The selection label names the swatch whose map is showing (the hovered or focused one), with its share.
13f. **Cluster map toggle on touch-only devices (user decision, 2026-11-19; fix M2-F5).** The "Cluster map" toggle shows on any device without a fine pointer (`(hover: none)` or `(pointer: coarse)`) at any width, including the desktop layout on an iPad in landscape, where it sits under the swatch strip in column 2. Fine-pointer desktops are unchanged.
14. **Mockup fixture.**
    - a. Populations become 0.832, 0.147 and 0.005 × 4, normalized.
    - b. The `rows` and `cluster` parameters and the new shots are approved. The `zoom` parameter is approved (15g).
14c. **Applicability notes** (user decision, 2026-11-18; it extends M1 decision 14 and is separate from item 14b above). A "Used by …" or "Not used by …" note shows under a setting only while its control is disabled. This covers every row, Seed included, whose note was always visible in M1. Colors follows it from T6, the Advanced rows from T7.
15. **Region of interest and zoom.**
    - a. **No region of interest. The user's final decision: extraction always uses the whole image.** This departs on purpose from spec 2.1 step 3 ("outside the region of interest"), spec 2.4 (the "Region of interest" row) and spec 6 "Image view" ("region-of-interest tool"). `docs/SPEC.md` is not edited. The earlier questions on the region's default, keyboard model and re-extraction no longer apply.
    - b. **Zoom and pan are in M2**, per spec 6 "Image view" and 6.1 "Gestures": pinch-zoom and one-finger pan on touch; wheel or trackpad and drag on desktop. There are also visible zoom controls, so zoom works without gestures and from the keyboard. Zoom is view state, outside undo (3.6) and outside the project. The cluster overlay follows zoom and pan.
    - c. Default: the zoom range is Fit (100%) to 800%. The buttons step 100%, 200%, 400% and 800%. Panning is clamped so the image always covers the well. The zoomed image scales the existing 2048 px display copy; rendering sharper crops from the master is not part of M2.
    - d. Default: keyboard on the focused image well: + and − zoom, 0 fits, arrows pan by 10% of the visible area.
    - e. Default: Zoom out, Zoom in and Fit icon buttons sit in the image well's bottom-right corner (spec 6.6 rule 1, attach to the thing acted on). They are not drawn and go to design review.
    - f. Default: Ctrl/Cmd + wheel and trackpad pinch zoom; a plain wheel scrolls the page, so the desktop columns still scroll.
    - g. Approved by the user: defaults c to f, and the new demo parameter `zoom=<2|4|8>` with the zoom-desktop and zoom-phone shots.
    - h. **User decision: at Fit, a one-finger swipe on the image scrolls the page**; only a pinch is captured. Above Fit, one finger pans the image and the page doesn't scroll. This departs from spec 6.1 (`touch-action: none` on the image) while the image is at Fit.
16. **Sort directions.** Lightness dark to light, chroma high to low, hue ascending from 0°.
17. **Milestone size.** One milestone of 14 tasks.
18. **Messages.** All-filtered: "Every pixel is filtered out. Loosen a filter." No background found: "None found".
19. **Sticky swatch strip on phone and tablet (user request, 2026-11-19).** Below 1024 px the swatch strip on the Source tab pins just under the header (`position: sticky`) while the setting rows scroll, so a setting change shows its effect even with Filters and Advanced open. Its container is opaque (`--color-surface`), spans the panel gutters, has a small vertical padding offset by negative margins (so the unscrolled layout is unchanged), and shows a `--color-border` divider while pinned. The page scrolls in the window. Desktop, the Palette tab and the image well are unchanged. This follows ui-contract Phone "Source tab" item 4 ("so the result stays visible") and is recorded there as intended deviation D4. Fix M2-F1.
20. **Clearly dimmed disabled setting rows (user request, 2026-11-19).** A setting row whose control is disabled stays visible (M1 decision 14) but is clearly dimmed: `SettingRow` takes `disabled` and sets `data-disabled`, and the row's label and value drop to 50% opacity on top of the controls' own disabled styles (divider-colored field border, muted text and thumb). Every label is already `--color-text-muted`, and `tokens.css` has no disabled color, so the dimming is reduced emphasis, not a new color. The "Used by" or "Not used by" note keeps its style and full opacity. It applies to every row with a disabled control: the Dark and Light thresholds while their Ignore toggle is off, Colors, Seed, Iterations, Restarts, Merge threshold, Population vs. vividness and Keep one outlier. Fix M2-F2.
21. **Setting-row padding on phone and tablet (user request, 2026-11-19).** Below 1024 px, setting rows and chevron rows get `--space-2` of padding above and below, so the 44 px controls don't fill the row from divider to divider. Desktop rows are unchanged. Fix M2-F4.
22. **Larger setting-row text on touch (user request, 2026-11-19).** Under `(max-width: 1023.98px), (pointer: coarse)`, setting-row labels, toggle rows, chevron-row titles and plain-text values use the new token `--text-row-touch` (`--text-md`, 15 px), beside the 16 px fields that stay at `--text-input-touch` (spec 6.1). Notes and hints keep their size; a fine-pointer desktop stays at 13 px. Fix M2-F7.

Remaining spec departures:
- No region of interest (15a).
- Phone sample size 256 instead of 128 (M1 decision 5).
- The cluster-map toggle on the Palette tab instead of the swatch sheet, until M3 (13d).
- Page scroll allowed on the image at Fit, instead of `touch-action: none` (15h).
23. **Setting rows keep label and value on one line (user request, 2026-11-19).** A setting row keeps its label group (label plus note) and its value on one line, vertically centered. To fit, in order: the label text wraps inside its group (minimum `--space-8` x 3, 96 px, flexing); a slider shrinks from its natural width (128 px, 96 px on touch) to `--space-8` x 2 (64 px); a select with long options shrinks, ellipsized, to 96 px; the number field, toggle and short selects keep their natural width. Only if those minimums still don't fit does the value wrap below, right-aligned (F3's fallback); that doesn't happen at 320 px or wider for any current row. Notes stay under the label inside the group. Rows that fit on one line before look as before. Fix M2-F10.

## Fixes after evaluation (2026-11-19)

- M2-F3 (evaluator failure 1): setting rows wrap (`flex-wrap`). The label group keeps its natural width and the value its own; when both don't fit, the value drops to its own line, right-aligned, instead of drawing over the label or note. Covered by `e2e/setting-rows.spec.ts` (no overlap, no clipping, centered on one line) at 1280, 1024, 820, 390 and 320 px.
- M2-F10: decision 23. `e2e/setting-rows.spec.ts` now checks one line and centers at 320, 360, 375, 390, 820, 1024 and 1280 px; F3's wrapped-value assertions apply only to the fallback.
- M2-F4: decision 21. M2-F5: decision 13f. M2-F6: decision 8b. M2-F7: decision 22.
- M2-F9 (final evaluation failure 1): `nudgeFocusClear` ignores focus inside the header, strip dock, tab bar, menus and dialogs, and mouse or touch focus; a keydown-recorded scroll position is restored when keyboard focus enters that chrome (Chromium's native scroll-padding). The shell breakpoint comment ties the 640 px media query to `.shell--phone`'s max-width (CSS can't share it). Covered by `e2e/focus-no-scroll-on-chrome.spec.ts`.
- The two visual shots `filters-desktop` and `filters-phone` were renamed `pixel-filters-desktop` and `pixel-filters-phone` and are listed in `docs/design/visual-testing.md`.

## Notes for the user's review (orchestrator, 2026-11-18, while the user was away)

Confirmed by the user before leaving:
- 6c. Vividness is disabled, with its note, for both Exact colors and Swatch roles.
- 14c. A "Used by" or "Not used by" note shows only while its control is disabled. This includes Seed.
- 10d. Swatch-roles results follow the Sort setting; "As extracted" gives role order.

Open points the implementers raised. Nothing was changed for these; they wait for the user:
- T8: a fully transparent image now shows "Every pixel is filtered out. Loosen a filter.", because the alpha cutoff counts as a filter.
- T8: when the filters empty the strip, the desktop Palette column still shows "Load an image to extract a palette." even though an image is loaded. M1 does the same for transparent images. Empty and error states are M6 (spec 6.3).
- T8: the filters review shots cover the viewport only, so the Minimum chroma and Alpha cutoff rows fall below the fold. Design review may need full-page shots.
- T10: the zoom controls in the bottom-right corner of the image cover patch 5 of the demo image. M3 markers there would sit under them.
