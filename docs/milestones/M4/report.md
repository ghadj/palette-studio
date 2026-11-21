# M4 evaluation report

## Round 1 (2026-11-21, milestone/M4 at 7cd23ec)

Verdict: **FAIL**, on one acceptance item. Unpicked palette chips in the Technique rows are dimmed with `opacity: 0.4`, so the swatch colors change with the theme (spec 6.2). Everything automated passes, and the user-requested fixes check out.

Commit evaluated: milestone/M4 at 7cd23ec (`main...HEAD`: 148 files, M4-T1 to T16 plus two merges).

### Checks

- `npm ci`, lint (353 files), typecheck, build: pass.
- Unit tests: 98 files, 660 tests, all pass.
- JS gzip about 100.4 kB in total (index 80.66, worker 19.15, theme-init 0.62), within the 150 kB budget (spec 7.7). CSS 8.08 kB gzip.
- Full e2e (`E2E_PORT=5067`, 4 workers, 5 projects): 4325 passed, 535 skipped, 0 failed, 0 flaky (16.7 min).
- Perf (`npm run e2e:perf`): 2 of 2 pass (stop-bar drag and marker drag, no long task over 50 ms).
- Tokens (1495 cases) and axe (450 cases) pass on every registered M4 screen in both themes.
- Review page: 78 of 78 shots. Visual baselines not run (expected to change until sign-off).

### Failure

1. **Unpicked palette chips in the Technique rows are dimmed with opacity** (spec 6.2 "Content is never themed").
   - Cause: `src/styles/app.css:2886-2894`, `.technique-chip { opacity: 0.4 }` on `data-user-content` chips (Colors/Picked and Derived From, `TechniqueRows.tsx:219-228`).
   - Measured on `?demo=mockup` at 1280 × 800:

     | Swatch | Light | Dark |
     | --- | --- | --- |
     | 1, #E8693A | #F6C3B0 | #6B3825 |
     | 3, #14386B | #A1AFC4 | #162439 |
     | 5, #1E8A2E | #A5D0AB | #1A4520 |

   - Tests miss it because `gradient-preview.spec.ts:140` and `theme-content.spec.ts` check only the preview and the strip.

### The user's specific checks

- Removed features (surround, cluster map, preview controls) have no functional leftovers. Small leftovers are listed under suggestion 1. The orphaned `cluster-map-*` baselines go through the baselines workflow.
- Row-group gap fix verified (`app.css:1591-1598`, `.row-list` at 1569; `row-groups-gap.spec.ts`, `gradient-rows-gap.spec.ts` pass on 5 projects). One exception: M3.
- Alpha and Midpoint commit only on Enter, blur or an arrow step: verified (`stop-details.spec.ts:229`).
- Flaky tests: none.

### Per-task findings

| Task | Result | Notes |
| --- | --- | --- |
| T1 model, state, history, sync | Pass | |
| T2 scaffolding, dock | Pass | `rows=preview` leftover (suggestion 1) |
| T3 interpolation, easing | Pass | reference values checked |
| T4 ordering | Pass | |
| T5 derive, image sample, ring | Pass | ring sampling in the worker (spec 7.4) |
| T6 chips, geometry, dial | Pass, minor | M1, V3 |
| T7 stop bar | Pass, minor | M2 |
| T8 Stop row | Pass, minor | M1 |
| T9 Interpolation row and options | Pass, minor | V2 |
| T10 bake, CSS, render | Pass | native vs baked within 3/255 on Chromium |
| T11 technique rows | **Fail** | Failure 1; M4 |
| T12 preview | Pass | |
| T13 / T16 surround | Pass | built, then removed cleanly |
| T14 integration sweep | Pass, minor | `rows=preview` leftover |
| T15 cluster map removal | Pass | stale comments only |

### Minor findings

- **M1.** Position, Angle, Center X/Y, Count, Min ΔE, Min contrast and sample Count commit on every keystroke, one undo step each (`StopDetails.tsx:234`/`DecimalField.tsx:86`, `GeometryPanel.tsx:137`).
- **M2.** A locked stop handle has no `aria-disabled` and its name does not say "locked" (`StopBar.tsx:333-362`).
- **M3.** Custom easing leaves a 13 px gap at the end of Interpolation options; the `:has(.setting-row:last-child)` selector (`app.css:1591`) is fragile.
- **M4.** "Needs an image" is not live and not a sentence (`TechniqueRows.tsx:443-446`).

### Visual findings

- **V1.** Type chips are one full-width segmented control; the mockups draw three compact pills (contract says "Segmented chips"; minor).
- **V2.** Gamut select clips on phones ("Reduce chr…" at 390 px, "Reduc…" at 320 px); M2 decision 23 says the value wraps.
- **V3.** Angle presets wrap unevenly ("315°" alone on desktop).
- **V4.** The preview is inset about 8 px in the column (surround stage padding leftover).
- **V5.** With Colors set to Picked, Geometry is below the fold at 1280 × 800 (column scrolls).

### Required fixes

1. Stop dimming user-content chips with opacity; mark picked versus unpicked without changing the fill; add a light-vs-dark pixel test for the Technique chips.

### Optional suggestions

1. Clean up removed-feature leftovers (`rows=preview` in `mockup.ts`, its tests and `mockup-state.md`; compare comments in `signals.ts:105`, `css.ts:201-207`; cluster map comments in `pipeline.ts:71,93`, D11(c) glow text in `ui-contract.md:233`).
2. Deferred commit for the other numeric gradient fields (M1).
3. `aria-disabled` and "locked" on locked handles (M2).
4. Custom-easing group flush; tighter selector (M3).
5. "Needs an image." live with a period (M4).
6. Gamut select wraps (V2); balanced angle presets (V3).
7. Update the plan's acceptance checklist and T16 note to match decisions 68 and 70.

## Round 2 (2026-11-21, milestone/M4 at 2030572)

Verdict: **PASS WITH NOTES.** The round-1 failure and every minor and visual item rechecked are fixed. No required fixes.

### Checks

- Lint, typecheck, build: pass. JS gzip about 100.5 kB.
- Unit tests: 98 files, 659 tests (one fewer: the compare-mode override test went with the parameter).
- e2e on the touched specs plus tokens, a11y, theme-content, gradient-rows-gap and layout-m4-sheets, 5 projects: 2323 passed, 72 skipped, 0 failed, 0 flaky.
- Implementer's full run at 2030572: 4366 passed, 539 skipped, 0 failed, 0 flaky; perf 2 of 2.
- Review page: 78 of 78 shots.

### Items

1. Technique chips (decision 71): exact fills in light and dark for Picked and Derived; opacity 1, no outline; check badge on picked chips only. Test: `technique.spec.ts` "chip centers equal the swatch HEX, picked or not".
2. M1: Position, Angle, Center X, Min contrast commit on Enter, blur or arrow step only, one undo step each. Stepper clicks not verified headless (code reviewed).
3. M2: locked handle named "…, locked" with `aria-disabled="true"`.
4. M3: Custom easing ends flush; the `:has()` selector looks only at the group's own last element.
5. M4: "Needs an image." with a period, live row.
6. V2: Gamut value wraps whole below at 320 px, shares a line at 390 px; no clipping.
7. V3: angle presets in a 4 × 2 grid, 44 px buttons.
8. V4: preview spans the full column at 2:1.
9. Leftovers and plan checklist: done.

The edit to `e2e/interpolation.spec.ts` is legitimate: at 320 px the 96 px label minimum plus the 190 px select exceed the 288 px row, and wrapping below is M2 decision 23's fallback.

For design review: V1 (type chips as one segmented control), V5 (Geometry below the fold at 1280 × 800), and the check badge (not drawn in the mockups).

### Optional suggestions

1. In `interpolation.spec.ts`, allow wrapping only when one line cannot fit, so Hue and Easing stay held to one line.
2. A test for the live "Needs an image." note.
3. An e2e test that a stepper click on a deferred field commits one step.
