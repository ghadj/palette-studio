# M1 evaluation report

Verdict: PASS WITH NOTES
Branch and commit evaluated: milestone/M1 at dd13b68. This includes M1-T1 to T13, fix round M1-F1 to F7 and layout round M1-L1 to L9; every commit message starts with its task id.
Date: 2026-11-18
Earlier evaluations: 3d12289 (2026-11-17) and 414ffdb (2026-11-18), both PASS WITH NOTES; their notes are tracked under "Earlier notes" below.
Final visual re-check: 3df4c12 (2026-11-18), after ee95638 (spec and contract update) and M1-L10 (drawer border edge to edge). All checks pass: lint with no warnings, typecheck, 103 unit tests, build at 39.49 kB gzip, and e2e with 803 passed and 52 deliberate skips. L10 looks right with no regressions. Notes 1 to 3 are resolved; see "Resolution after this report".

All checks pass, now with 0 lint warnings. Every acceptance item has passing evidence or is listed as a manual device check. The visual review has no blocking differences.

Three choices depart from the spec and wait for the user (notes 1 to 3):
- the tabbed layout below 1024 px (spec 6.1)
- Replace image in the header (spec 6.6)
- 12 colors instead of 32 (spec 2.4)

## Checks run

| Check | Command | Result |
| --- | --- | --- |
| Clean install | `rm -rf node_modules dist && npm ci` | exit 0. 8 high-severity advisories, all from `picomatch` (dev-only, no fixed release); known and awaiting the user's decision |
| Lint | `npm run lint` | pass: "Checked 116 files … No fixes applied." No warnings (L8 cleared the earlier 5) |
| Type-check | `npm run typecheck` | pass, exit 0 |
| Unit tests | `npm test` | pass: 28 files, 103 tests |
| Build and bundle size | `npm run build`; `npx tsx tools/bundle-size.ts` | pass. Total gzip 39.49 kB (index 28.62 kB, worker 10.28 kB, theme-init 0.59 kB), within 150 kB (spec 7.7). `dist/licenses.md` written. Expected warning: theme-init.js "can't be bundled without type=module" |
| End-to-end tests | `npm run e2e` (chromium, webkit, firefox, phone-webkit, phone-chromium) | pass: 800 passed, 50 skipped (deliberate viewport or Chromium-only skips), 2.9 min |
| Accessibility (axe-core) | part of `npm run e2e` (`@a11y`) | pass. Covers 9 screens × 2 themes × 5 projects, plus Advanced open, theme menu with a toast, the copy-failure toast, and the disabled Seed row. No rules disabled |
| Visual review | `npm run visual:review` | 14 shots, page written |
| Visual baselines | `visual` project | not run: `e2e/visual/baselines` doesn't exist, and running the project would write baselines |
| Evaluator's extra checks | `npx playwright test -c artifacts/eval/eval.config.ts` (scratch, gitignored) | pass, 46 tests. Covers clipping and 44 px targets at 19 sizes, theme content identity, keyboard focus, a 48.8 MP load, the strip at 12 colors at 5 widths, and the Seed row in both themes |

## Acceptance checklist

| Item | Spec | Result | Evidence |
| --- | --- | --- | --- |
| Load by drop, paste or picker; palette in under a second | 8 v1-1 | pass | load-image.spec: picker, drop and paste (Chromium) tests; replace-image.spec. Time to first palette for 12 MP: 239 / 269 / 211 / 247 / 234 ms across the five projects. A 48.8 MP PNG took 437 ms in Chromium and 499 ms in WebKit. Paste in Safari and Firefox is manual |
| Live algorithm and settings; same seed gives the same palette | 8 v1-2 | pass | extract.spec: Colors, Median cut, every setting re-extracts, same seed gives the same hexes, fallback parity, and the L7 test (Seed disabled with Median cut; switching back to k-means++ gives the same hexes); pipeline.test |
| Static site under a subpath, no network after load | 8 v1-9 | pass (deployed URL is manual) | security.spec "every request during load and use is same-origin"; smoke "loads under the base path" |
| Keyboard operable, visible focus, UI contrast | 8 v1-10 | pass | Chromium tab-through: every stop shows a 2 px solid accent ring (27 on desktop with the mockup, 23 on the empty desktop, 26 on the phone). Replace image menu supports arrows, Home, End and Escape. axe color-contrast passes. Non-text 3:1 contrast is manual |
| Color conversions against reference values | 8 | pass | convert.test |
| K-means same seed; every algorithm stable on single-color, two-color and transparent images | 8 | pass | kmeans.test, median-cut.test, pipeline.test |
| Period decimal separator under any locale | 5, 8 | pass | format.test and palette-css.test with the locale forced to de-DE |
| CI on every push and PR | 8 | pass (read, not run; actionlint not installed) | `.github/workflows/ci.yml` |
| axe checks each panel in light and dark | 8 | pass | a11y.spec |
| Deploys only from main after every check passes | 8 | pass (read, not run) | `deploy.yml`: `workflow_run` with conclusion success, event push, branch main |
| Layout at 320, 375, 390 and 430 px, portrait and landscape | 8 small-device | pass | layout.spec tests. Check at 19 sizes (including 820×1180, 1023×768, 1000×700) × 4 tabs × mockup and empty states × Chromium and WebKit: 0 controls outside the viewport, 0 clipped, 0 under 44 px |
| Theme 1: first visit, persistence, live switch | 6.2 | pass | theme.spec |
| Theme 2: no flash | 6.2 | pass | theme.spec "no flash…" |
| Theme 3: content colors identical in both themes | 6.2 | pass | `e2e/theme-content.spec.ts` in all 5 projects; the evaluator's own check also measured a max channel difference of 0 |
| Theme 4: AA contrast (markers are M3) | 6.2 | pass for M1 | axe color-contrast |
| Phone 1: every feature reachable at 320 px | 8 | pass | Replace image; replace-image.spec "at 320 px the header doesn't overflow…"; the project name truncates to "twe…" with every control at 44 px |
| Phone 2: 44 × 44 controls, nothing depends on hover | 8 | pass | tokens.spec touch targets on phone and tablet screens; strip-layout.spec "12 colors at … px: … every swatch at least 44 px"; no `:hover` rules |
| Phone 4: no Safari focus zoom | 8 | pass (real iPhone is manual) | extract.spec "Colors field has inputmode=decimal and 16 px type" |
| Phone 5: 48 MP loads and extracts | 8 | manual (desktop evidence passes) | Decode straight to the master size (`src/image/load.ts`); load.test; e2e with `exif-orientation-6-large.jpg`; 48.8 MP load |
| Phone 7: tab bar clears the home indicator | 8 | manual | safe-area padding on the tab bar |
| Unsupported file, very large image, copy done | 6.3 | pass | load-image.spec; copy.spec, including that the failure toast persists and closes with Dismiss |
| CSP in production only, no inline scripts, BASE_URL | 7.8 | pass | security.spec; `vite.config.ts` `apply: "build"`. The swatch strip's `style` is set through the CSSOM, which the CSP allows; the console-error smoke test passes |
| viewport-fit, safe area, dvh, 16 px inputs, inputmode | 6.1 | pass | `index.html:5`; `app.css`; `inputMode="decimal"` |
| Token conformance on every M1 screen, both widths, both themes | visual-testing 1 | pass | tokens.spec in all 5 projects, including the Replace image menu and the disabled Seed row; allowed lists unchanged |
| `visual:review` page; CI upload; `visual-baselines.yml` manual only | visual-testing 2, 3 | pass | ran it; `visual-baselines.yml` is `workflow_dispatch` only; no baselines committed |
| `?demo=mockup` fixture with no storage access | mockup-state, 5.5 | pass | mockup-state.spec |

## Earlier notes: status

Report at 3d12289:

| # | Earlier note | Status | Evidence |
| --- | --- | --- | --- |
| 1 | No way to load a second image without reloading | resolved | Replace image (decision 12, M1-F1); replace-image.spec. Its placement is open as note 2 |
| 2 | Dependency licence notices missing (spec 7.10) | resolved | `dist/licenses.md` lists the full texts for preact, @preact/signals, @preact/signals-core, culori and lucide-preact (ISC); security.spec checks the contents and that the file is served |
| 3 | No repo test for Theme 3 | resolved | `e2e/theme-content.spec.ts` |
| 4 | A new image cleared the old palette immediately | resolved | The old palette stays dimmed until the new one lands; extract.spec |
| 5 | Extraction errors were never cleared | resolved | `fromExtraction` flag; `tests/state/extraction.test.ts` |
| 6 | Worker crash left the app stuck | resolved | `src/extract/client.ts` `stop()` and `setRestore`; `tests/extract/client.test.ts` |
| 7 | Download toast disappeared after 8 s | resolved | Toasts with an action persist and have a 44 px Dismiss button; `tests/ui/toast.test.ts`; copy.spec |
| 8 | Phone sample size 256 instead of 128 | open by the user's choice | Decision 5 |
| 9 | Large photos held decoded at full size | resolved where the browser allows | Probe, then decode to the master size. It falls back to full size only when the probe fails. A real iPhone remains the deciding test |
| 10 | Small items | partly resolved | Duplicated tablet strip gone; advisories known. Slider-track contrast and workflow action versions are still manual |

Report at 414ffdb:

| # | Note | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Tabbed layout below 1024 px departs from spec 6.1 and the contract | open, awaiting the user | Note 1 below |
| 2 | Replace image in the header departs from spec 6.6 rules 1 and 3 | open, awaiting the user | Note 2 below |
| 3 | Five Biome `noDescendingSpecificity` warnings | resolved | L8. `npm run lint` shows no warnings. Review shots match the earlier run except for the Colors slider thumb, which moved because the range is now 2 to 12 |
| 4 | Phone sample size 256 | open by the user's choice | Decision 5 |
| 5 | A failed extraction for a new image left the old image's palette copyable | resolved | L9: `src/state/extraction.ts` tracks which image the palette belongs to and clears it on that failure. Unit test "if a new image's extraction fails, the previous image's palette is cleared and the error stays (L9)". A failed re-extraction of the same image keeps its palette |
| 6 | Large-image probe on iOS | open as a manual check | Note 6 below |
| 7 | Swatch strip wrapped above about 8 colors | resolved under decision 13 | See the strip results below |

Strip results at 12 colors (evaluator's `many.spec.ts`, in Chromium and WebKit, after typing 40 into Colors, which clamped to 12):

| Width (px) | Rows | Smallest swatch | Overflow |
| --- | --- | --- | --- |
| 1280 | 2 rows of 6 | 60 × 80 | none |
| 1024 | 2 rows of 6 | 45.8 × 80 | none |
| 820 | 1 row of 12 | 47 × 64 | none |
| 390 | 2 rows of 6 | 56.3 × 64 | none |
| 320 | 2 rows of 6 | 44.7 × 64 | none |

strip-layout.spec covers the same widths.

## Visual check

Review page: `artifacts/visual-review/index.html`. It has 14 shots, each in light and dark: studio-desktop, studio-tablet, source-phone, palette-phone, gradient-phone, empty-desktop and empty-phone.
Token conformance: pass in both themes, all 5 projects
Baseline comparison: baselines created on 2026-11-18 by `visual-baselines.yml` run 44345966156 on milestone/M1 (commit 711c0af, 14 images: the 7 M1 shots in light and dark), after the user's sign-off; spot-checked against the approved build (drawer border inset, footer border edge to edge, centered view tabs, tabbed tablet layout)

What matches the contract:
- The header order, with the Studio and Materials tabs centered.
- Three equal columns with a 16 px gutter.
- The export drawer split into two halves, directly above the footer.
- Phone tab bar with the accent indicator above the active tab.
- Swatch 3 selected, with the 2 px text-color outline.

Dark mode keeps content colors identical (measured difference 0). No region is missing, out of order or broken. Since 414ffdb the review shots differ only in the Colors slider thumb position, because 6 now sits on a 2 to 12 range. Absences owned by later milestones are not blocking (decision 10).

| Shot | Theme | Region | Mockup shows | Build shows | Severity |
| --- | --- | --- | --- | --- | --- |
| studio-desktop, source-phone, palette-phone | both | Header item 4 (desktop) and phone header icons | desktop: text buttons Undo, Redo, Share; phone: Undo, Redo, Share icons | an extra image-icon "Replace image" button before Undo; on desktop it is an icon among text buttons | minor; design review (decision 12, note 2) |
| studio-desktop, source-phone | both | Column 1 items 1 and 3 | markers on the image, hint "Drag a marker to resample" | no markers, no hint | minor (M3) |
| studio-desktop | both | Column 1 item 4 | muted label with a plain value | selects with chevrons; Colors has a slider plus a number field; an extra Advanced row. In Advanced, the Seed row has a muted note and is disabled except for k-means++ | minor (not drawn; decisions 5 and 14) |
| studio-desktop | both | Column 2 items 3 to 5 | sliders, HEX, Lock, Ramp, chevron rows | absent | minor (M3) |
| studio-desktop, gradient-phone | both | Column 3 / Gradient tab | preview, chips, stop bar, rows | one-line hint | minor (M4) |
| studio-desktop | both | Export drawer | muted format lists, drawer right under the columns | Copy HEX and Copy CSS pills, "Coming in a later version"; the drawer is pinned to the bottom of the window, leaving empty space below the columns | minor (decision 7, L3) |
| source-phone, palette-phone, studio-tablet | both | Under the swatch strip | nothing | Copy HEX and Copy CSS row | minor (decision 7) |
| source-phone | both | Swatch strip spacing | gaps about 1/5 of a swatch | 4 px gap on 56 px swatches | minor |
| source-phone, studio-tablet | both | Setting row values | value about the size of the label | 16 px values next to 13 px labels | minor (spec 6.1's 16 px rule wins) |
| 7 to 12 colors (not in the fixture) | light | Swatch strip | "in one row" | two even rows of 6 when one row would make swatches narrower than 44 px; one row of 12 at 820 px | minor; follows decision 13 |
| studio-tablet | both | Whole screen | not drawn (contract: "follow spec 6.1: Source and Palette beside the active panel") | tabbed phone layout with the panel centered at 640 px; the header, footer border and tab bar span the full width | design review; departs from spec 6.1 by the user's choice (note 1) |

Not-drawn items built in this milestone (need design review):
- Theme menu popover (System, Light, Dark).
- Replace image button and menu: Choose image, Paste and three samples with thumbnails (decision 12).
- Medium screens and landscape phones (601–1023 px): tabbed layout with the panel centered at 640 px (revised decision 4).
- Desktop window behavior:
  - the columns scroll between the header and the drawer
  - minimum 320 px width and 640 px height
- Two-row swatch strip for 7 to 12 colors (decision 13).
- Disabled Seed and Randomize with the muted note "Used by k-means++ only" (decision 14). The disabled number field uses the divider border and muted text.
- Phone Palette tab: strip, "Swatch 3" label, copy buttons.
- Gradient and Materials one-line hints, and "Load an image to extract a palette."
- Empty state (empty-desktop, empty-phone): drop zone with Choose image (primary), Paste and three samples. The Source column carries two accent elements, Choose image and the selected Image segment (spec 6.6 rule 4).
- Messages:
  - inline unsupported-file message
  - HEIC message
  - large-image note
  - paste fallback note
  - progress bar after 300 ms
  - dimming while loading and extracting
- Copy controls in the drawer and under the phone strip.
- Toasts:
  - "Copied HEX" and "Copied CSS"
  - failure toast with Download and Dismiss, which stays until dismissed
  - "Coming in a later version" toast on Undo, Redo, Share, the project chevron, the Materials view tab and the Palette, Values and Grid chips
- Setting-row editing affordances and the Advanced row (Sample size, Resampling, Seed with Randomize).
- Footer: "Your images never leave this browser.", MIT License, GitHub; top border edge to edge.

User sign-off: approved by the user on 2026-11-18. The user reviewed the running build and the review page at dd13b68 (shots: studio-desktop, studio-tablet, source-phone, palette-phone, gradient-phone, empty-desktop and empty-phone, each in light and dark) and approved them. In the same answer the user asked for the drawer border to run edge to edge, which M1-L10 delivered at 3df4c12; the evaluator's re-check confirmed it changes only the studio-desktop and empty-desktop shots, as intended. The user then asked for the drawer border to stay inside the page gutters after all; M1-L11 (9b150f3) reverted the drawer part of L10, and the user confirmed the result in the running build on 2026-11-18. Only the footer's top border runs edge to edge. Checks at 9b150f3: lint, typecheck and 103 unit tests pass; e2e 803 passed and 52 deliberate skips (4.2 min); `visual:review` wrote all 14 shots. An earlier run on a heavily loaded machine (load average about 30, 27 min) counted 8 tests outside "passed" with exit 0; the clean re-run shows no failures or flaky tests.

## Failures (each blocks the milestone)

None.

## Notes (not blocking)

1. **Revised decision 4 departs from spec 6.1 and `ui-contract.md` (open, awaiting the user).**
   - Spec 6.1 says "601 to 1023 px: two columns" and "landscape uses the two-column layout". The contract's Tablet section says the same.
   - The plan records the tabbed layout as the user's choice, but neither `docs/SPEC.md` nor `docs/design/ui-contract.md` has been updated, so later milestones would read conflicting sources.
   - Confirm, and decide whether the spec and contract should change.
2. **Replace image sits in the header (decision 12; open, awaiting the user).**
   - Spec 6.6 rule 3 limits the header to project, views, Undo, Redo, Share and theme. Rule 1 says to attach features to what they act on.
   - Contract header item 4 lists only text buttons on desktop.
   - Confirm the departure, or move the button at design review. M5's Import file, behind the project name, may make it redundant.
3. **Decision 13 departs from spec 2.4 ("Number of colors: 2 to 32").**
   - The plan records 2 to 12 as the user's choice, and it is applied everywhere through `clampColors` (`src/state/defaults.ts`).
   - Like note 1, the spec still says 32. Confirm and decide whether spec 2.4 should be updated.
   - This also affects M2 presets and M5 project files and share links: loaded settings with more than 12 colors are clamped silently in `loadProject`.
4. **The Seed rule from decision 14 may need revisiting in M2.**
   - `src/extract/applicability.ts` makes Seed apply to k-means++ only. In the mockup state (Balanced), Seed and Randomize show disabled with "Used by k-means++ only".
   - Spec 2.4 says Seed "makes k-means and random ordering repeatable", and Balanced is "Wu seed + weighted k-means refinement" (spec 2.2).
   - The plan already expects M2 to extend the table. When Balanced lands, decide whether Seed applies to it.
5. **Phone sample size is still 256, not the spec's 128** (decision 5, by the user's choice). Revisit later.
6. **The large-image probe loads the file into an image element** (`browserDecoders.probe` in `src/image/load.ts`). Browsers normally decode an unattached image lazily; whether iOS Safari does this for a 48 MP photo is part of the real-iPhone check.
7. **Desktop WebKit skips buttons when tabbing** unless Safari's "Press Tab to highlight each item" setting is on. That is a platform setting, not an app bug.

## Resolution after this report (2026-11-18)

- Notes 1 to 3: resolved. The user asked for the spec to be updated; commit ee95638 updates `docs/SPEC.md` 2.4 (2 to 12 colors), 6.1 (tabbed layout for 601 to 1023 px and landscape) and 6.6 rule 3 (Replace image in the header), and `docs/design/ui-contract.md` (header items, Tablet section).
- Note 4 (Seed and Balanced): left for M2 by the user's choice.
- Note 5 (phone sample size 256): still the one unreconciled spec departure. Spec 6.1 says 128 px; decision 5 keeps 256 until revisited.
- picomatch advisories: accepted by the user on 2026-11-18 (dev-only, no fixed release); revisit when picomatch publishes a fix.

## Manual checks for a person

- [x] Confirm notes 1 to 3 and update the spec and contract (ee95638).
- [x] Decide on the picomatch advisories: accepted.
- [ ] Set Pages source to GitHub Actions. After merge, check:
  - [ ] `/<repo-name>/` makes only same-origin requests.
  - [ ] `/<repo-name>/licenses.md` is served.
  - [ ] The first CI and deploy runs go green, which also confirms the action versions (actionlint wasn't available).
- [ ] Real current iPhone:
  - picker offers Photo Library, Take Photo and Files
  - a HEIC photo loads or shows the message
  - a 48 MP photo loads and extracts without the tab reloading
  - Replace image works
  - the tab bar clears the home indicator
  - the Colors field doesn't zoom
  - the Safari toolbar color follows the theme
- [ ] iPad or a 601–1023 px window, portrait and landscape: the tabbed layout and the 12-color strip read well.
- [ ] Older iPhone on older iOS: does the theme still work (`light-dark()` needs Safari 17.5)?
- [ ] Android with Chrome: load, replace, extract, copy.
- [ ] Paste an image in Safari and Firefox, from the drop zone and from the Replace image menu.
- [ ] Copy HEX and CSS in Safari on iPhone and paste into Notes.
- [ ] Reload with Dark chosen on a light-mode device: no flash.
- [ ] Time to first palette for a 12 MP photo on a mid-range laptop. The automated runs measured 211–269 ms.
- [ ] Non-text contrast (3:1) of control borders, the slider track and the disabled Seed field, in both themes.
- [x] Open `artifacts/visual-review/index.html`, compare with the mockups, and sign off or list changes (approved 2026-11-18; L10 followed).
- [ ] Design review of the not-drawn items above, including the two-row strip and Replace image's placement.
- [x] After sign-off, run `visual-baselines.yml` on milestone/M1 and check the committed baselines (run 44345966156, commit 711c0af).
