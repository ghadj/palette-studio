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

---

# M3 re-evaluation (round 2, at b3bb44b)

Verdict: **FAIL**, on one acceptance failure. Both round-1 failures are fixed. Everything automated passes:
- lint (276 files), typecheck, unit tests (484), and the build (78.5 kB JS gzip)
- full 5-project e2e: 3264 passed, 256 skipped, 0 failed, 0 flaky (16.5 min)
- axe (360/360), tokens (1185/1185), and the review page (60/60)

Decisions 24 to 40, 42 and 43 were checked one by one and pass, except where noted below.

## Failure

1. **A Swatch row edit while an adjustment is active applies the adjustment twice** (decision 24; spec 3.3 non-destructive; spec 3.2).
   - Cause: the row's fields show the output color (`SwatchDetails.tsx:443`), and a commit then writes that value as the new base (`setExact`, `:341` and `:363`). The editor gets this right: it edits the base and shows an "After adjustments" line.
   - Reproduce: set Lightness to 0.1, choose RGB in the Swatch row, change R by 1. Before: 47 84 137. After: 76 113 168. The editor's base L jumps from 0.345 to 0.446.
   - No e2e test covers this case.

## Visual findings (minor)

- **V-new-1:** an empty 7th column in the phone Source strip (it counts the "+" cell even when it's hidden); the strip wraps 4 + 2 at 320 px. A real bug.
- **V-new-2:** the zoom controls move to the left in the Palette and Values views.
- **V-new-3:** the zoom buttons are ordered Out, In, Fit (decision 42 says Out, Fit, In).
- **V-new-4:** the X chip covers the selected swatch's pin or lock badge.
- **V-new-5:** the toolbar row pushes "Advanced" below the fold in column 1 at 1280 × 800.
- **V-new-6:** at 12 swatches the disabled "+" takes a full row in the phone dock.
- **Carried over:** V5 (L/C/H number fields on desktop), V6 (contrast matrix clipped), V8 (the open Ramp panel pushes rows down), V9 (sheet title).

## Notes

1. Duplicate can't be reached on touch devices (D key only). This goes against the user's principle and spec 6.6 rule 6.
2. Other removals are covered: retargeting by marker drag, typing via "+" then HEX, delete via X or the Delete key.
3. Focus is lost after Unpin, and after removing the last swatch on the phone Source tab.
4. A typed-and-pinned swatch's marker ring shows the typed color, not the image color under its point.
5. Closing a sheet doesn't restore the earlier scroll position.
6. Performance: a 1024 px cluster map is built on every extraction and every "+"; measure against spec 7.7.
7. Rule checks found nothing.

---

# M3 final evaluation (round 3, at 1173c82)

Verdict: **FAIL**, on one regression introduced in M3-F15 (decision 46). The round-2 failure (a Swatch row edit applying adjustments twice) is fixed: an R + 1 edit with Lightness +0.1 now moves only R, with the adjustment applied once. Every other new decision (44 to 52) checks out.

Checks:
- lint (283 files), typecheck, unit tests (484), and the build (about 79.4 kB JS gzip)
- e2e, 5 projects: 3405 passed, 339 skipped, 1 failed. The one failure is flaky: phone-webkit `extract.spec.ts:171` passes 5 out of 5 when rerun alone.
- axe (360/360), tokens (1185/1185), and the review page (60/60)

## Failure

1. **The drawer lock blocks touch gestures inside sheets whose content doesn't scroll vertically** (decision 46; spec 3.5 and 6.1).
   - Cause: `src/ui/sheetDock.ts:75-80` cancels every `touchmove` inside a `.bottom-sheet__body` that has no vertical overflow.
   - On phones (390 to 430 px), the contrast matrix can't be panned sideways, so columns 5 and 6 can't be reached.
   - On tablets (820 × 1180), sliders in the Adjustments, Filters and Advanced sheets jump to the touch point and don't follow the finger.
   - Evidence is Chromium touch emulation, with and without the listener; iOS needs a device check.
   - No test covers it.

## Visual findings (minor)

- **V-new-5:** "Advanced" sits below the fold at 1280 × 800 (carried over).
- **Duplicate HEX elements:** with the Swatch row open there are two HEX fields, two "After adjustments" lines and two buttons both named "Copy adjusted HEX".
- **Swatch drawer:** focus lands on "Duplicate swatch" when it opens, so an immediate Enter duplicates. The title reads "Swatch" (V9).
- **Pinned desktop strip:** the "PALETTE" label scrolls away while the strip stays pinned.
- **320 px:** the strip wraps 4 + 3 with the "+" tile.
- **Carried over:** V5, V6, V8 and V9.

## Notes

1. Decisions 52 and 39/48d depart from the spec (3.8, 3.5, 3.2) and need the user's own confirmation. With dots only, a sighted user can't tell which swatches pair with which.
2. The live sentence doesn't re-announce when the flagged set changes within the same kind.
3. `src/ui/closeFlags.ts` has no unit tests.
4. Three similar copy names exist, and two buttons share the name "Copy adjusted HEX".
5. Stale wording: `ui-contract.md:143`, and the decision citation in the `sheetDock.ts` comment.
6. Rule checks found nothing.
7. Carried over: the marker ring color for a typed swatch, and the cluster-map cost.

## After the final evaluation (orchestrator, 2026-11-20)

- **M3-F20 (ccdd18c, 1496a3e):** the drawer lock now cancels touches only outside the sheet, so the contrast matrix pans and sliders drag inside sheets. New `e2e/sheet-touch.spec.ts`: 4 of its 6 tests failed on the old code and all 6 pass now. This fixes the final-evaluation failure.
- **Cleanups (cd17ec6):**
  - the live region names the flagged swatches, so it re-announces when the set changes
  - `closeFlags` unit tests
  - distinct copy-icon names
  - sheets focus Close on open
  - stale wording fixed
- **M3-F21 (1eb025c, db93cdc):** a thin footer, one row on phones (decision 54).
- **M3-F22 (705de78):** one Lock toggle; Unlock clears both the lock and the pin (decision 55, approved by the user).
- **b3c50f1:** the filters 320 px test waits for the drawer to settle; it now passes 25 of 25 runs across the 5 projects.
- **Verification:**
  - Last full 5-project run, before F22: 3456 passed, 1 failed (the sub-pixel flake, since fixed).
  - After F22: lint, typecheck, unit (491) and build pass; the affected specs on 5 projects pass.
  - No further evaluator round was run (the fix-round limit was reached; the user had authorised autonomous decisions).

**M3 status:** implementation complete. Waiting on the user: visual sign-off, real-device checks, confirmation of the orchestrator and spec-departure decisions, and push/PR.
