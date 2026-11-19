# M2 evaluation report

Verdict: **FAIL**. Every automated check passes. The milestone fails on one blocking visual problem (Failure 1): when a setting row is disabled with its note, the slider and fields draw over the label and note text.
Branch and commit evaluated: milestone/M2 at c448dcd (18 commits, main..HEAD)
Date: 2026-11-19

All checks ran in a fresh clone at c448dcd. The user's preview server (port 4999) and the other implementer's port were not touched.

## Checks run

| Check | Command | Result |
| --- | --- | --- |
| Clean install | `npm ci` | pass (warns that the esbuild and fsevents install scripts aren't in allowScripts) |
| Lint | `npm run lint` | pass, exit 0 (159 files) |
| Type-check | `npm run typecheck` | pass, exit 0 |
| Unit tests | `npm test` | pass: 46 files, 267 tests |
| Build and bundle size | `npm run build`, then `gzip -9` per file | pass. JS gzip: index 35.6 kB, worker 16.0 kB, theme-init 0.6 kB, about 52 kB in total, well under the 150 kB budget (spec 7.7). CSS is 4.2 kB gzip. |
| End-to-end tests | all 5 projects, `E2E_PORT=4573` | pass: 1413 passed, 77 skipped, 0 failed, 0 flaky (6.6 min). Every skip is a project-specific `test.skip`. |
| Accessibility (axe-core) | `e2e/a11y.spec.ts` | pass on every screen, light and dark, all 5 projects, including the new zoom, filters, advanced and cluster-map screens |
| Token conformance | `e2e/tokens.spec.ts` | pass on every new and changed screen, both themes, desktop and phone, including the 44 px target checks |
| Visual review page | `npm run visual:review` | 28 of 28 shots captured |
| Visual baselines (local, for information only) | `--project=visual` | 28 of 28 fail locally, which is expected (see "Visual check") |
| Re-extraction timing (spec 7.7, for information only) | e2e "re-extraction with Balanced at 256 px is logged" | 188 to 215 ms of wall time including the 120 ms debounce, so about 70 to 95 ms of work, within the target of about 150 ms |

## Acceptance checklist

| Item | Spec | Result | Evidence |
| --- | --- | --- | --- |
| Algorithm and settings switch with live updates; the same seed gives the same palette (all 7 algorithms) | 8, v1 acc. 2 | pass | e2e: "switching to Wu re-extracts…", "Exact colors with Nearest…gives all 12 hexes", "every Advanced control re-extracts", "reloading and loading the same image with the same seed gives the same hexes"; unit "same settings and seed give identical palettes" |
| ΔE checked against reference data (Sharma pairs for CIEDE2000) | 8 | pass | `tests/color/delta-e.test.ts`: all 34 Sharma pairs to 4 decimals, symmetry, mockup hex pairs |
| K-means is identical for the same seed; every algorithm is stable on single-color, two-color and transparent images | 8 | pass | `tests/extract/pipeline.test.ts` stability test across every algorithm and all 4 working spaces, plus per-algorithm stability tests |
| Fixture images (M2 adds mostly white background, grayscale, studio backdrop) | 8 | pass | `white-background.png`, `grayscale-plus-red.png`, `studio-backdrop.png` |
| Hovering a swatch highlights its pixels as an overlay and shows its population share | 2.6 | pass, with an open point | e2e `cluster-map.spec.ts`. Open point: the share is the plain pixel share, a provisional orchestrator decision the user still has to confirm. |
| Presets Dominant, Balanced (default), Vibrant, Flat art, Accents and Swatch roles | 2.5 | pass | `tests/extract/presets.test.ts`; e2e `presets.spec.ts` |
| Every 2.4 setting has its range and default (except region of interest) | 2.4, dec. 15 | pass | `tests/state/defaults.test.ts`; ranges in `SettingsControls.tsx` |
| Image view: zoom and pan | 6 | pass | e2e `zoom.spec.ts` |
| Gestures: pinch and pan, touch-action, pointer capture, pointercancel | 6.1 | pass in Chromium; manual check for WebKit pinch | e2e zoom gesture tests |
| Callouts: the iOS callout and text selection are off on the image | 6.1 | pass (from the stylesheet); manual check on a real iPhone | e2e reads the shipped CSS |
| View state isn't recorded (zoom is kept out of the project and storage) | 3.6 | pass | e2e "zoom isn't written to storage…", "zooming never re-runs extraction" |
| Debounce, dropping stale results, progress indicator after 300 ms | 7.4 | pass | M1 e2e tests; "while extracting, the old map stays dimmed with the palette" |
| Re-extraction under about 150 ms at 256 px | 7.7 | pass (for information) | about 70 to 95 ms of work; real devices are a manual check |
| Keyboard-operable with visible focus and enough UI contrast | 8, acc. 10 | pass | e2e keyboard tests for swatches, toggle, decimal fields and presets; axe passes |
| Theme 3: content colors identical in both themes | 6.2 | pass | e2e overlay and zoomed-image theme tests |
| Theme 4: AA contrast in both themes | 6.2 | pass for axe-checkable text | axe doesn't detect the text Failure 1 hides under a control |
| Phone 1: every feature reachable at 320 px without horizontal scroll | 8 | pass | e2e 320 px tests for the Advanced and Filters rows |
| Phone 2: controls at least 44 × 44, nothing depends on hover | 8 | pass at phone width | token 44 px tests; zoom controls; Cluster map toggle |
| Phone 4: text fields don't trigger Safari's focus zoom | 8 | pass | all visible fields and selects are 16 px on iPhone 13 WebKit |
| Messages are plain sentences in a live region | 6.3 | pass | e2e all-filtered and "None found" tests |
| Token conformance on every new or changed screen, both themes | visual-testing 1 | pass | `tokens.spec.ts` |
| Review page has the new shots; baselines change only through the workflow | visual-testing 2, 3 | pass | 28 shots; no baseline file changed |
| `?demo=mockup` shows Balanced and never touches storage | mockup-state, 5.5 | pass | e2e mockup-state and storage tests |

## Visual check

Review page: `artifacts/visual-review/index.html` (regenerated at c448dcd). Evaluator shots: `artifacts/eval/M2/`. Token conformance passes in both themes on every screen.

Baseline comparison (local, for information only; CI's Docker run is the authority):
- 14 shots have no baseline yet, which is expected: advanced-desktop, zoom-desktop and zoom-phone, filters-desktop and filters-phone, cluster-map-desktop and cluster-map-phone, each light and dark.
- These changed shots differ from the M1 baselines: studio-desktop, source-phone, palette-phone, studio-tablet, empty-desktop, empty-phone. gradient-phone's local difference is fonts only (it is pixel-identical to a local build of main).
- empty-desktop and empty-phone really did change against main: M2 adds the Preset and Filters rows and the Balanced default. The plan lists them as "unchanged", so they need sign-off too.

| Shot | Theme | Region | Mockup / contract shows | Build shows | Severity |
| --- | --- | --- | --- | --- | --- |
| Not in the shot list (Advanced open, Exact colors or Swatch roles) | both | Setting rows "Population vs. vividness" and "Seed" | Muted label left, value right | The disabled slider draws over the note "Not used by exact colors and swatch roles" at 1280, 1024 and 320 px in all three engines. The Seed field cuts off "Used by k-means++ only" at 1024 px. | **blocking** (Failure 1) |
| source-phone, zoom-phone, cluster-map-phone, studio-desktop, studio-tablet | both | Image well | Patch and marker 5 visible bottom right | The zoom-controls pill covers it: fully on phone, half on desktop. M3 marker 5 would sit underneath. | minor (design review) |
| studio-desktop, source-phone, studio-tablet, empty-* | both | Setting rows | "Algorithm, Colors, Working space" | Preset row above Algorithm; Filters row after Working space | minor (approved under decisions 2a and 2b; the contract text hasn't been updated) |
| filters-desktop, filters-phone | both | Filters row | n/a | Viewport-only shots cut off the lower Filters rows. Full shots are in `artifacts/eval/M2/`. | minor |
| empty-desktop, filters-desktop | both | Header | `--header-height` | The header shrinks from 49 to 48 px when column 1 overflows the window | minor |
| advanced-desktop | both | Advanced rows | n/a | Advanced child rows have no indent or grouping | minor (design review) |
| cluster-map-desktop, cluster-map-phone | both | Overlay | Not drawn | Swatch 3 clear, the rest dimmed; identical in light and dark; other patches still faintly visible | minor (design review of the dim) |

Not-drawn items built in this milestone (need design review):
- Preset row, including the disabled "Custom" option
- Filters row: Ignore dark and light toggles with threshold rows, Ignore background with "None found", Minimum chroma, Alpha cutoff
- New Advanced rows, including Merge threshold's decimals
- Toggle component
- Zoom controls, and how they cover image content
- Cluster map overlay look and the share text
- The phone Cluster map toggle row
- The all-filtered message, "None found", and the empty-roles note
- Disabled rows with their notes (decision 14c)
- The tablet layout and the empty screens with the new rows

User sign-off: not yet (deferred by the user).

## Failures (each blocks the milestone)

1. **Setting-row controls draw over the label and note text when a row is disabled with a note (spec 6.1, contract Components "Setting row", plan T6 and T7).**
   - Where: `src/styles/app.css:718-723`. `.setting-row__value { min-width: 0; justify-content: flex-end }` lets the value box shrink below the slider group's fixed width (`app.css:792-801`), so the controls spill left over `.setting-row__label-group` (`app.css:707-711`), which has no width protection.
   - Rows affected: Population vs. vividness (under Exact colors and Swatch roles) and Seed. The vividness label alone also overlaps at 320 px.
   - How to reproduce: open `?demo=mockup&rows=advanced` at 1280 × 1280 and choose Algorithm "Exact colors" or "Swatch roles".
   - Overlaps measured, the same in all three engines: at 1280 px, note × slider 8 × 15 px; at 1024 px, note × slider 26 × 15, label × slider 30 × 7, Seed note × field 4 × 15; at 320 px, label × slider 25 × 13, note × slider 20 × 15; Firefox at 320 px, Seed note × field 23 × 15.
   - Screenshots: `artifacts/eval/M2/vividness-note-overlap-light.png`, `overlap-vividness-1024-light.png`, `overlap-vividness-320-dark.png`, `overlap-seed-1024-light.png`, `swatch-roles-disabled-light.png`.
   - No test covers this. A fix should come with an e2e check that each row's label group and value don't intersect.

## Notes (not blocking)

1. `docs/design/visual-testing.md` doesn't list the `filters-desktop` and `filters-phone` shots, although `e2e/visual/shots.ts` has them. The names are also easy to confuse with the Part 2 shots `filters-all-phone` and `filters-medium-phone`.
2. The cluster map has no tap path at desktop width on a touch-only device (for example an iPad in landscape, which gets the desktop layout). Spec 6.1 "No hover" asks for a tap equivalent. Decision 13d scoped the toggle to phones only, so the user should decide.
3. The plan's checkboxes for T9, T12 and T14 are still unchecked, waiting on "e2e and review page". Both have now run at c448dcd.
4. The "% of the image" share is the plain pixel share (orchestrator decision, provisional); the user still needs to confirm it.
5. With Exact colors, Keep one outlier adds a median-cut box mean, which isn't an input color (plan T5 note). This weakens the spec 2.2 promise that Exact colors keeps the real colors. Flat art turns the outlier off, so only a custom setup is affected.
6. `tests/extract/client.test.ts` has two tests named "assign resolves with the map; the buffer is transferred".
7. The approved spec departures still stand: no region of interest (15a), phone sample size 256 (M1 dec. 5), the cluster toggle on the Palette tab (13d), page scroll at Fit (15h).
8. Rule checks found nothing: no new network calls, no inline scripts or styles, no literal colors, font sizes or radii in the new CSS, a period as the decimal separator, and all pixel loops in the worker.

## Manual checks for a person

- [ ] Review page and evaluator shots; sign off or list changes, including empty-desktop and empty-phone.
- [ ] Design review of the not-drawn items above. Most urgent: the zoom controls covering patch and marker 5, and the Preset and Filters rows.
- [ ] Real iPhone: pinch-zoom and one-finger pan with no page zoom or callout; zoom buttons; Cluster map toggle; no focus zoom; page scroll from the image at Fit.
- [ ] Android Chrome: the same zoom, pan and cluster-map checks.
- [ ] Desktop Safari and Firefox: trackpad pinch zooms the image, not the page.
- [ ] iPad in landscape: whether the cluster map needs a tap path (Note 2).
- [ ] Judge each preset on real photos, pixel art and a logo.
- [ ] Ignore background on a real product photo against a studio backdrop.
- [ ] Balanced re-extraction time at 256 px on a laptop and a phone (about 150 ms target).
- [ ] Non-text contrast (3:1) of the toggle track and the zoom buttons over very light and very dark images.
- [ ] After the fix and sign-off: run `visual-baselines.yml` on milestone/M2.

## Fixes since this evaluation

- M2-F1, sticky swatch strip on phone and tablet (user request, decision 19)
- M2-F2, clearly dimmed disabled setting rows (user request, decision 20)

---

# M2 re-evaluation (after fix round 1)

Verdict: **FAIL**. Failure 1 of the first evaluation is fixed: no setting row overlaps at any width, in any engine, under any algorithm. The full e2e suite (1617 passed, 103 skipped, 0 failed), axe (200 of 200), token checks (625 of 625), unit tests (268) and the build all pass. Two new failures block the milestone.
Commit evaluated: milestone/M2 at 9d77b64 (27 commits, main..HEAD). Date: 2026-11-19.
Evaluator shots for this round: `artifacts/eval/M2-r2/`.

## Changes since the previous evaluation

| Commit | Change | Checked against | Result |
| --- | --- | --- | --- |
| c22b870 M2-F1 | Sticky swatch strip below 1024 px | decision 19, D4 | Matches. Side effect: Failure 2 |
| 7854083 M2-F2 | Dimmed disabled rows | decision 20 | Matches |
| 2261235 M2-F3 | Rows wrap instead of overlapping | Failure 1 | Fixed. No overlaps, clipped labels or horizontal scroll in 3 engines, 11 widths and all 7 algorithms |
| 16d2648 M2-F4 | Row padding below 1024 px | decision 21 | Matches |
| dd72c1d M2-F7 | 15 px row text on touch | decision 22 | Matches |
| 3fceee6 M2-F6 | Exact colors outlier is a real color | decision 8b | Matches |
| ada37fd, 9d77b64 M2-F5 | Cluster map toggle without a fine pointer | decision 13f | Matches |
| c21f9ec | Shot rename, plan ticks, test rename | previous notes 1, 3, 6 | Done. Introduces Failure 1 (lint) |

## Failures

1. **Lint fails** (CLAUDE.md definition of done). `e2e/helpers/screens.ts:58` is too long after the `pixel-filters-phone` rename (c21f9ec). **Fixed after this evaluation in 9b3580c.**
2. **Keyboard focus lands fully hidden behind the pinned swatch strip on phone and tablet** (spec 8 v1 acceptance 10, "visible focus"; WCAG 2.2 SC 2.4.11).
   - The sticky `.strip-dock` (`src/styles/app.css:663-675`) adds an 80 px band under the 48 px header, and nothing sets `scroll-padding`, so focused controls scroll under it.
   - Example: at 320 × 568 on `?demo=mockup&rows=filters,advanced`, scroll to the bottom, focus Sort, then Shift+Tab: Distance metric sits at y 72 to 116, entirely under the strip.
   - Stops fully hidden only because of the strip, per engine:

     | Engine | 320 × 568 | 390 × 844 | 820 × 1180 |
     | --- | --- | --- | --- |
     | Chromium | 6 | 1 | 1 |
     | Firefox | 10 | 1 | 1 |
     | WebKit | 10 | 0 | 2 |

   - The M1 sticky header and fixed tab bar also hide some stops; for example, forward Tab at 390 × 844 puts controls under the tab bar.
   - Evidence: `artifacts/eval/M2-r2/focus-obscured.txt`.
   - Suggested fix: below 1024 px, `scroll-padding-top` (header plus strip) and `scroll-padding-bottom` (tab bar), plus an e2e test that tabs both ways.

## Visual findings (minor; for design review)

- V1: taller phone and tablet rows with 15 px text (decisions 21 and 22); the contract doesn't record them yet.
- V2: the `pixel-filters-phone` shot now shows only the Filters summary and half a row.
- V3: rows wrap unevenly at 320 px and 1024 px (correct per F3).
- V4: on tablet, the pinned strip container extends 16 px past the row column on each side.
- V5: dimmed disabled labels are very faint in dark mode.
- V6: the zoom pill covers patch and marker 5 (carried over).
- V7 to V10: carried over (Preset and Filters rows, the 48 to 49 px header, no indent for Advanced rows, the overlay look).

Diff ratios against the M1 baselines (local, for information only): studio-desktop 0.01/0.02, source-phone 0.03/0.04, palette-phone 0.02/0.01, studio-tablet 0.01/0.02, empty-desktop 0.02/0.02, empty-phone 0.07/0.06, gradient-phone 0.01 (fonts only). 14 new shots have no baseline yet.

## Notes

1. Two commits are labelled M2-F5, and "report cleanups" carries code changes.
2. `docs/milestones/M2/plan.md` Screens affected still names `filters-desktop`.
3. "D1 to D3" is still written in `docs/design/visual-testing.md:75`, `CLAUDE.md:41` and `.claude/agents/evaluator.md:25`. `ui-contract.md:225`, under the new D4, contradicts itself.
4. Decisions 21 and 22 aren't recorded in `ui-contract.md`.
5. Decision 8b's unit tests miss these edge cases: no color reaches 0.1%, the CIEDE2000 metric, spatial weights, and fewer distinct colors than N.
6. Still open: the "% of the image" share definition (provisional), and the approved spec departures.

User sign-off: not yet (deferred by the user).

---

# M2 final evaluation (after fix round 2)

Verdict: **FAIL**, on one regression from M2-F8. Both failures of round 2 are fixed: lint passes, and the evaluator's own probe found 0 hidden or partly covered focus stops at 320, 390 and 820 px in Chromium, Firefox, WebKit, and emulated iPhone 13 and Pixel 7. Every check passes: e2e 1632 passed, 103 skipped, 0 failed, 0 flaky; axe 200/200; tokens 625/625; unit 272; build 52.9 kB JS gzip; review page 28 shots.
Commit evaluated: milestone/M2 at 146113c. Date: 2026-11-19. Evidence: `artifacts/eval/M2-r3/`.

## Failure

1. **The F8 focus nudge scrolls the page when focus lands inside the header, the pinned strip or the tab bar, including on tap or click** (regression of decision 19 / D4, spec 6.1).
   - Where: `src/ui/focusClearance.ts:10-22`. `nudgeFocusClear` never checks whether the focused element is inside the chrome.
   - Measured from scrollY 600: a tap on strip swatch 3 goes to 520 on Pixel 7, Chromium 390 and Firefox 390; the header project button goes to 466; the Theme button goes to 0 and unpins the strip. WebKit doesn't focus on click, so it doesn't move. The build before F8 (39a1250) stays at 600 in every case.
   - Shift+Tab into the pinned strip also scrolls up by up to 148 px.
   - The e2e test misses it: it skips elements the chrome contains and never checks scroll position.
   - Suggested fix: return early when `el.closest("header, [data-testid=strip-dock], .tabbar, [role=menu]")` matches, and add an e2e test that taps a pinned swatch and a header button and asserts `scrollY` doesn't change.

## Notes

1. The `@media (max-width: 640px)` strip-dock rule repeats the shell's maximum width as a literal.
2. Native `scroll-padding` also makes Chromium scroll when keyboard focus enters the pinned strip.
3. Two commits are labelled M2-F5; history only.
4. Still open for the user: the "% of the image" share definition, and the approved spec departures.
5. Rule checks found nothing.

The fix rounds are used up (two), so this failure goes to the user. Visual sign-off is still deferred.
