# M1 evaluation report

Verdict: PASS WITH NOTES
Branch and commit evaluated: milestone/M1 at 80153b6 (13 task commits plus the plan commit; every message starts with its task id)
Date: 2026-11-17

Every acceptance item has passing evidence or is listed as a manual device check. The visual review found no blocking differences. Two findings need your decision before merge: notes 1 and 2.

## Checks run

| Check | Command | Result |
| --- | --- | --- |
| Clean install | `rm -rf node_modules && npm ci` | exit 0. npm reports 8 high-severity advisories and an allowScripts warning for esbuild and fsevents; the build still works |
| Lint | `npm run lint` | pass: "Checked 104 files … No fixes applied." |
| Type-check | `npm run typecheck` | pass, exit 0 |
| Unit tests | `npm test` | pass: 22 files, 82 tests |
| Build and bundle size | `npm run build`; `npx tsx tools/bundle-size.ts` | pass. Total gzip 38.02 kB (index 27.18 kB, worker 10.25 kB, theme-init 0.59 kB), within the 150 kB budget (spec 7.7). Expected warning: theme-init.js "can't be bundled without type=module" |
| End-to-end tests | `npm run e2e` (chromium, webkit, firefox, phone-webkit, phone-chromium) | pass: 666 passed, 34 skipped (all skips are deliberate viewport or Chromium-only skips), 2.4 min |
| Accessibility (axe-core) | part of `npm run e2e` (`@a11y`) | pass: 9 screens × 2 themes × 5 projects, plus Advanced open and theme menu with a toast; no rules disabled |
| Visual review | `npm run visual:review` | 14 shots written; page at `artifacts/visual-review/index.html` |
| Visual baselines | `visual` project | not run: no baselines exist (`e2e/visual/baselines` is absent), and running it would write baselines |
| Evaluator's extra checks | `npx playwright test -c artifacts/eval/eval.config.ts` (scratch specs in `artifacts/eval/`, gitignored) | Clipping, touch targets, theme content identity, keyboard focus, 48 MP load and 32 colors. Results below |

## Acceptance checklist

| Item | Spec | Result | Evidence |
| --- | --- | --- | --- |
| Load by drop, paste or picker; palette in under a second | 8 v1-1 | pass | load-image.spec "picker loads two-color.png…", "drop loads an image", "paste loads an image (Chromium)". Time to first palette for 12 MP: 232 / 243 / 215 / 264 / 290 ms across the five projects. A 48.8 MP PNG: 549 ms (Chromium), 659 ms (WebKit). Paste in Safari and Firefox is manual |
| Live algorithm and settings; same seed gives the same palette | 8 v1-2 | pass | extract.spec "changing Colors to 3…", "switching to Median cut…", "working space, sample size, resampling and seed all re-extract", "reloading … same seed gives the same hexes", "the main-thread fallback gives the same palette"; pipeline.test "same settings and seed give identical palettes" |
| Static site under a subpath, no network after load | 8 v1-9 | pass (deployed URL is manual) | security.spec "every request during load and use is same-origin"; smoke "loads under the base path…"; every asset in `dist/index.html` is under `/palette-studio/` |
| Keyboard operable, visible focus, UI contrast | 8 v1-10 | pass | theme.spec "theme menu is keyboard operable…". Tab-through: all 26 desktop-mockup, 23 empty and 25 phone stops show a 2 px solid accent outline. axe color-contrast passes. Non-text 3:1 is manual |
| Color conversions against reference values | 8 | pass | convert.test "sRGB white maps to OKLab L = 1…", "round trip error below 1e-6 on a 17×17×17 grid", Ottosson pairs, #FF0000 OKLCH and CIELAB |
| K-means same seed; every algorithm stable on single, two-color and transparent inputs | 8 | pass | kmeans.test "same seed gives identical output", "single-color, two-color and fully transparent inputs are stable"; median-cut.test; pipeline.test "both algorithms × 4 working spaces are stable…" |
| Period decimal separator under any locale | 5, 8 | pass | format.test and palette-css.test "…identical with the locale forced to de-DE"; no `toLocaleString` or `Intl` in `src` |
| CI on every push and PR | 8 | pass (by reading; actionlint not installed) | `.github/workflows/ci.yml`: the checks job runs lint, typecheck, test, build and the bundle report; the e2e job runs Chromium, WebKit and Firefox |
| axe checks each panel in light and dark | 8 | pass | a11y.spec, as above |
| Deploys only from main after every check passes | 8 | pass (by reading) | `deploy.yml`: `workflow_run` on CI with `conclusion == 'success'`, `event == 'push'` and `head_branch == 'main'`; takes effect after merge |
| Layout at 320, 375, 390 and 430 px, portrait and landscape | 8 small-device | pass | layout.spec "…no horizontal scroll". Check at 16 sizes × all 4 tabs × mockup and empty states × Chromium and WebKit: 0 controls outside the viewport, 0 clipped, 0 under 44 px. layout.spec asserts `env(safe-area-inset-bottom)` on the tab bar |
| Theme 1: first visit, persistence, live switch | 6.2 | pass | theme.spec "first visit follows…", "choosing Dark survives a reload", "in System, changing the emulated scheme updates colors without a reload" |
| Theme 2: no flash | 6.2 | pass | theme.spec "no flash: with the app bundle delayed 2 s…" |
| Theme 3: content colors identical in both themes | 6.2 | pass (evaluator's check only) | No test in the repo covers this. Scratch `eval.spec.ts`: the image well and all 6 swatch centers are pixel-identical (max channel diff 0) between light and dark, on desktop and phone, in Chromium and WebKit |
| Theme 4: AA contrast (markers are M3) | 6.2 | pass for M1 | axe color-contrast; tokens are documented at 3:1 for control borders |
| Phone 1: every feature reachable at 320 px | 8 | pass, with the caveat in note 1 | 320×568 and 568×320 checks |
| Phone 2: 44 × 44 controls, nothing depends on hover | 8 | pass | tokens.spec "every button, link, input, chip, tab is at least 44 × 44" on all phone screens; 320 px check; `app.css` has no `:hover` rule |
| Phone 4: no Safari focus zoom | 8 | pass (real iPhone is manual) | extract.spec "Colors field has inputmode=decimal and 16 px type at phone width"; `app.css:616` |
| Phone 5: 48 MP loads and extracts | 8 | manual (desktop evidence passes) | tiers.test "8064×6048 (48 MP) gives a 4096×3072 master"; 48.8 MP load in Chromium and WebKit. See note 9 |
| Phone 7: tab bar clears the home indicator | 8 | manual | `app.css:791` and `:803` use `env(safe-area-inset-bottom)` |
| Unsupported file, very large image, copy done | 6.3 | pass | load-image.spec "not-an-image.txt shows the inline message and the previous image stays", "a generated 31 MP image shows the large-image note"; copy.spec toast, clipboard failure and reduced-motion tests |
| CSP in production only, no inline scripts, BASE_URL | 7.8 | pass | security.spec (CSP meta exact; no inline script, style element or style attribute); `vite.config.ts` plugin uses `apply: "build"`; sample URLs come from `import.meta.env.BASE_URL` |
| viewport-fit, safe area, dvh, 16 px inputs, inputmode | 6.1 | pass | `index.html:5`; `app.css:95` (`100dvh`), `:791`, `:803`; `SettingsControls.tsx` `inputMode="decimal"` |
| Token conformance on every M1 screen, both widths, both themes | visual-testing 1 | pass | tokens.spec in all 5 projects, plus the self-test; allowed lists unchanged |
| `visual:review` page; CI upload; `visual-baselines.yml` manual only | visual-testing 2, 3 | pass | ran it; tools/visual-review.test; `visual-baselines.yml` is `workflow_dispatch` only; no baselines committed |
| `?demo=mockup` fixture with no storage access | mockup-state, 5.5 | pass | mockup-state.spec "never reads or writes localStorage or IndexedDB", fixture hexes, "swatch 3 has the selected outline" |

## Visual check

Review page: `artifacts/visual-review/index.html` (14 shots: studio-desktop, studio-tablet, source-phone, palette-phone, gradient-phone, empty-desktop and empty-phone, each in light and dark)
Token conformance: pass in both themes, all 5 projects
Baseline comparison: not yet (no baselines exist)

The header, frame, column order, three equal columns with a 16 px gutter, export drawer halves, tab bar and selected states all match the contract. Dark mode keeps identical content colors (measured, diff 0). No region is missing out of order or broken. Absences owned by later milestones are not blocking (decision 10).

| Shot | Theme | Region | Mockup shows | Build shows | Severity |
| --- | --- | --- | --- | --- | --- |
| studio-desktop, source-phone | both | Column 1 items 1 and 3 | markers on the image; hint "Drag a marker to resample" | no markers, no hint | minor (M3) |
| studio-desktop | both | Column 1 item 4, setting rows | muted label, plain value ("Balanced", "6", "OKLab") | select controls with chevrons; Colors has a slider plus a number field; an extra "Advanced" chevron row | minor (not drawn; decision 5) |
| studio-desktop | both | Column 2 items 3 to 5 | L/C/H sliders, HEX, Lock, Ramp, chevron rows | absent | minor (M3) |
| studio-desktop, gradient-phone | both | Column 3 / Gradient tab | preview, chips, stop bar, rows | one-line hint | minor (M4; decision 6) |
| studio-desktop, studio-tablet | both | Export drawer | muted format lists | Copy HEX and Copy CSS pills; "Coming in a later version" | minor (decision 7) |
| source-phone, palette-phone | both | below the swatch strip | nothing | Copy HEX and Copy CSS row | minor (decision 7; not drawn) |
| source-phone | both | Swatch strip spacing | gaps about 1/5 of the swatch width | 4 px gap (`--space-1`, `app.css:504`) on 56 px swatches, so the swatches look crowded | minor |
| source-phone, studio-tablet | both | Setting row values | value about the same size as the label | values at 16 px, labels at 13 px | minor (the 16 px rule in spec 6.1 wins) |
| any palette over about 8 colors (not in the fixture) | light | Swatch strip | "the swatches in one row" | wraps: 28 swatches give 3 rows on desktop and 5 rows at 320 px (`artifacts/eval/many-desktop.png`, `artifacts/eval/many-phone.png`; `app.css:499`) | minor; needs a design decision (one row versus 44 px targets) |
| studio-tablet | both | Right column | not drawn | repeats the swatch strip shown under the image | design review |

Not-drawn items built in this milestone (need design review):
- Theme menu popover (System, Light, Dark).
- Tablet layout:
  - Source column with the strip under the image.
  - Row-style Palette, Gradient and Materials tabs with an underline indicator.
  - Compact header.
  - Duplicated swatch strip.
  - Phones in landscape (for example 568 × 320) also get this layout.
- Phone Palette tab: strip, "Swatch 3" label, copy buttons.
- Gradient and Materials one-line hints, and the "Load an image to extract a palette." hint.
- Empty state (empty-desktop, empty-phone): drop zone with Choose image (primary), Paste and three generated samples. The Source column carries two accent elements, Choose image and the selected Image segment (spec 6.6 rule 4).
- Messages:
  - inline unsupported-file message
  - HEIC message
  - large-image note
  - paste fallback note
  - progress bar after 300 ms
  - dimming while extracting
- Copy controls in the drawer and under the phone strip.
- Toasts:
  - "Copied HEX" and "Copied CSS"
  - failure toast with a Download action
  - "Coming in a later version" toast on Undo, Redo, Share, the project chevron, the Materials view tab and the Palette, Values and Grid chips
- Setting-row editing affordances: selects, Colors slider with number field, and the Advanced row (Sample size, Resampling, Seed with Randomize).
- Footer: no-upload line, MIT License link, GitHub link.

User sign-off: not yet

## Failures (each blocks the milestone)

None.

## Notes (not blocking)

1. **You can't load a second image without reloading (decision needed).**
   - Once an image is loaded, the drop zone is replaced (`src/ui/ImageWell.tsx:44-45`), so Choose image and the samples are no longer reachable.
   - Desktop can still use drop and paste. On a phone the only way is a page reload, and with no autosave until M5 that loses the palette.
   - The spec doesn't say where this control goes, and the implementer correctly didn't invent one (T9 note). Decide its placement now or accept it until M5's Import file.
2. **Dependency licence notices are missing from the build (spec 7.10: "keep each dependency's license notice in the build output").**
   - A grep of `dist/assets/*` finds no licence text for Preact, culori or Lucide (ISC); the only match is the app's own footer link.
   - The site goes public on merge, so fixing this first is recommended, for example with Vite's `build.license` option or a licence plugin.
   - It isn't an M1 acceptance item, so it doesn't fail the verdict.
3. **No test in the repo covers Theme 3.** The evaluator's scratch check passed. Consider adding it to `e2e/` so it runs in CI.
4. **A new image clears the old palette at once** (`src/state/load-image.ts:62`) instead of keeping it visible and dimmed. Spec 6.3 asks for that during "extracting or rendering", though it may only mean re-extraction.
5. **An extraction error message is never cleared** by a later successful extraction (`src/state/extraction.ts:54`; `applyColors` doesn't reset `imageMessage`).
6. **Worker crashes can leave the app stuck.** If the worker throws an uncaught error after connecting, pending requests never resolve and `extracting` stays true (`src/extract/client.ts:67` only resolves the connect promise).
7. **The Download fallback toast disappears after 8 s** (`src/ui/Toast.tsx:20`), and it is the only way to the Download fallback. This is a WCAG 2.2.1 timing concern.
8. **Phone sample size is 256, not 128.** This departs from spec 6.1 by the user's choice (decision 5) and should be revisited.
9. **Large photos are briefly held at full size.**
   - `createImageBitmap(file, { imageOrientation })` at `src/image/load.ts:101` holds the full-resolution bitmap (about 190 MB at 48 MP) on the main thread before handing it to the worker.
   - Spec 7.4's data flow implies this path, but its tier text says the original is "never held decoded at full size".
   - A real iPhone is the deciding test. `resizeWidth`/`resizeHeight` could reduce the peak.
10. **Other small items:**
    - The tablet duplicates the swatch strip (flagged by the implementer).
    - The slider track uses the divider color as the contract says; check that it is still clear enough on screen.
    - `npm ci` reports 8 high-severity advisories.
    - The workflow action versions (checkout@v7, upload-pages-artifact@v5, and so on) weren't verifiable offline.

## Manual checks for a person

- [ ] Set Pages source to GitHub Actions. After merge, open `/<repo-name>/` and confirm DevTools shows only same-origin requests. Confirm the first CI and deploy runs go green, since actionlint wasn't available.
- [ ] Real current iPhone:
  - the picker offers Photo Library, Take Photo and Files
  - a HEIC photo loads or shows the message
  - a 48 MP photo loads and extracts without the tab reloading
  - the tab bar clears the home indicator
  - the Colors field doesn't zoom
  - the Safari toolbar color follows the theme
- [ ] Older iPhone on older iOS: does the theme still work (`light-dark()` needs Safari 17.5)?
- [ ] Android with Chrome: load, extract, copy.
- [ ] Paste an image in Safari and Firefox.
- [ ] Copy HEX and CSS in Safari on iPhone and paste into Notes.
- [ ] Reload with Dark chosen on a light-mode device: no flash.
- [ ] Time to first palette for a 12 MP photo on a mid-range laptop. The automated runs measured 215–290 ms.
- [ ] Non-text contrast (3:1) of control borders and the slider track, in both themes.
- [ ] Decide notes 1 and 2.
- [ ] Open `artifacts/visual-review/index.html`, compare with the mockups, and sign off or list changes.
- [ ] Design review of the not-drawn items above, including the swatch strip wrapping at higher color counts.
- [ ] After sign-off, run `visual-baselines.yml` on milestone/M1 and check the committed baselines.
