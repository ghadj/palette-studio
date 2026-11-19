# M3 evaluation report

Verdict: **FAIL**, on two small acceptance items. Everything automated passes:
- lint (262 files, no warnings), typecheck, and unit tests (75 files, 450 tests)
- build: 75.40 kB JS gzip in total (index 56.58, worker 18.22, theme-init 0.59), within the 150 kB budget
- full 5-project e2e: 3145 passed, 205 skipped, 0 failed, 0 flaky (11.4 min)
- axe (360) and tokens (1185)
- the review page (60 of 60 shots)
- the evaluator's own overlap and horizontal-scroll check: 186 cases clean

Commit evaluated: milestone/M3 at e40ea2c (the M3 change set is milestone/M2...HEAD: 141 files, M3-T1 to M3-T17). Date: 2026-11-20.

## Failures

1. **The close-pair warning and the 12-color note are not live regions** (spec 6.3; plan acceptance "…heard through a live region (the 12-color note, close pairs and the marker HEX announcement)").
   - The marker HEX is live.
   - Not live: `src/ui/ClosePairsMark.tsx:21` and the Contrast list (`ContrastPanel.tsx:104`), plus the 12-color notes in `SwatchStrip.tsx:446`, `SwatchDetails.tsx` (about line 510) and `RampPanel.tsx:114`.
   - No e2e test covers them.
2. **The Swatch row's HEX field doesn't set `autocorrect="off"`** (spec 6.1 "Text input"). `SwatchDetails.tsx:215-223` (`CommitField`) sets autocapitalize and spellcheck only. The editor's own HEX field is correct.

## Acceptance checklist

Every item passes except Failures 1 and 2: spec 3.2 to 3.8 acceptance, 6.1 to 6.4, the 8 phone and theme lists, the worker and UI-thread rule, keyboard, tokens, the review page, and demo storage. These need manual checks on real devices: iPhone marker drag and pinch, and the loupe.

## Visual findings (minor; for design review)

- **V1:** the zoom pill covers marker 5 at Fit. At 390 px the ring is 0 % visible and 13 % of the hit area is tappable; at 320 px, 0 % and 0 %; at 1280 px, 57 % visible. Selecting swatch 5 lifts it above the pill. This is the top design item.
- **V2:** column 2 has four chevron rows (Swatch, Adjustments, Contrast, CVD); the mockups draw "Adjustments" and "Contrast and CVD".
- **V3:** the "+" tile takes a full second row at 6 swatches.
- **V4:** the Values bracket sits below the "+" row, about 50 px from the swatches it marks.
- **V5:** L/C/H number fields show beside the sliders on desktop too (spec 3.2 asks for both).
- **V6:** the contrast matrix clips at 6 swatches (5 columns visible at 1280 px), with no scroll cue.
- **V7:** the phone loupe sits beside the finger, not above it.
- **V8:** the open Ramp panel pushes the chevron rows down.
- **V9:** the Swatch sheet is titled "Swatch" rather than "Swatch 3".

Not-drawn items needing design review:
- the Swatch row and sheet
- the Adjustments panel
- the contrast matrix and the close-pairs list
- the CVD strips
- the Ramp panel and harmonies
- the "+" tile and its menu
- the well tools and the eyedropper hint
- the loupe
- marker labels, fan-out and the selected ring
- the Out-of-sRGB indicator
- the bottom sheets
- the Values and Palette view options
- disabled Undo and Redo
- the tablet layout

User sign-off: not yet (deferred by the user).

## Notes

1. **Decisions worth the user's review:**
   - 1a with 1b: every edit locks, so adjustments skip any touched swatch. This contradicts spec 3.7's "adjustments apply on top of the picked color".
   - Marker color: T17 made markers show the adjusted color, but spec 3.7 says the ring shows the image color.
   - 2c: manual swatches are replaced on re-extraction.
   - T10 tie-break.
   - T11 views use alpha 128, not the user's alpha cutoff.
   - Loupe beside the finger on phones.
   - D8: changing a swatch's sample radius doesn't resample it.
   - "Place on image" is disabled in the demo.
2. The 12-color limit has three different wordings.
3. The plan has T3 unticked, and `visual-testing.md:69` still describes the "coming soon" stubs.
4. `e2e/a11y.spec.ts` was edited (harmless).
5. The test name `cvd.spec.ts` "strips update after an adjustment" is misleading.
6. `SwatchDetails.tsx` reimplements the sRGB↔HSL conversion outside `src/color/` (CLAUDE.md), and `fromHsl` has no reference test.
7. `ramp()` keeps an out-of-gamut source unchanged as one of its steps.
8. Rule checks found nothing: no network calls, no inline scripts, no literal colors, sizes or radii, no hover-only CSS, no locale formatting.
9. The bundle grew from about 52 kB to 75.4 kB gzip.
