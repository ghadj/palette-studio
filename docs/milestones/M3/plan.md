# M3 plan: Palette editing

Status: provisionally approved (2026-11-18). The user is away and asked for every unanswered question to take its proposed option. See "Decisions (provisional)".
Spec sections: 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8 (not the transfer grid), 6 ("Image view", "Keyboard"), 6.1, 6.2, 6.3, 6.4, 6.6, 7.3, 7.4, 7.5, 7.6, 7.9, 8, 9; design docs `ui-contract.md`, `mockup-state.md`, `visual-testing.md`; M2 plan decisions 13d and 15a to 15h

This plan assumes M2 is complete as written in `docs/milestones/M2/plan.md`. It builds on M2's zoom and pan (`src/image/viewport.ts`, the `imageView` signal, the transformed layer in `ImageWell.tsx`), the cluster map (`assignPixels`, the worker's `assign` request, `ClusterOverlay.tsx`), `Toggle.tsx`, `NumberField` and the `rows=` demo parameter. Start M3 only after M2 is merged.

## Scope

In (roadmap row M3, spec 9, plus the work M2 deferred to M3):
- Color editor (3.2):
  - L, C and H sliders with number fields
  - HEX, RGB, HSL and OKLCH fields
  - out-of-gamut indicator (3.5, 7.9)
- Per-swatch actions (3.2):
  - lock, duplicate, delete, add
  - drag to reorder, and arrow keys (spec 6 "Keyboard")
  - copy value
  - rename, with the nearest CSS color name suggested (7.6)
  - eyedropper
  - generate a ramp
- All ten global adjustments (3.3): non-destructive, resettable, with a before/after compare toggle (3.6).
- Ramps and harmonies (3.4).
- Contrast matrix (WCAG 2.x, AA/AAA badges), CVD simulation of the palette, close-pair warnings using the merge threshold (deferred from M2), and the gamut indicator (3.5).
- History (3.6):
  - undo and redo, 50 steps
  - live header Undo and Redo, plus Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (6, 6.1)
  - reset to extracted
  - re-extraction that keeps locked swatches
- Sample points (3.7):
  - placement at extraction
  - markers, linked to swatches both ways, with a show/hide toggle
  - drag with a loupe by mouse, touch, pen and keyboard
  - sample radius
  - a moved swatch becomes picked and locked; a drag is one undo step
  - reset to extracted, and Place on image
- Marker gestures together with M2 zoom and pan (6.1, M2 decision 15h):
  - one finger on a marker drags it
  - elsewhere, one finger pans above Fit and scrolls the page at Fit
  - two fingers pinch
- Palette and Values image views (3.8):
  - area-share bar and legend, dither
  - bands, Close in value, and the bracket on the strip
  - computed in the worker and cached
- The cluster-map toggle moves from the phone Palette tab into the swatch sheet (M2 decision 13d). The cluster map can show together with the markers (3.7).
- On phones, the swatch editor, adjustments and ramps open as bottom sheets (6.1).

Out (and where it lands instead):
- Transfer grid and its export: M5 (roadmap). The Grid chip stays "coming in a later version".
- CVD applied to gradients, and Image-sample gradient stops taken from markers (4.2): M4.
- These land in M5:
  - saving view settings, adjustments and points in project files
  - hiding markers when a project is reloaded without its image
  - the warning when a different image is loaded
  - share links

  In M3 they exist only in memory.
- "Colors from: Matched paints" in the Palette view: Part 2 (M7 to M9).
- APCA and the preview surround setting (6.2): see Q6.
- Shortcuts R and ?: M6, as M2 decided.
- Region of interest: dropped (M2 15a). Spec 3.7's line "Dragging outside the region of interest is allowed" doesn't apply.
- Display-P3 boundary: Later (3.5, 7.9).
- Phone sample size 128 px: stays 256 (M1 decision 5).

## Tasks

The order follows dependencies:
- T1 and T2 lay a shared foundation, serially.
- T3 to T11 run in parallel.
- T12 to T16 build the marker and view UI on the T10 and T11 engines.
- T17 is an integration sweep.

See "Parallel execution".

Rules that hold for every task:
- Every task keeps `?demo=mockup` working without storage access.
- No task edits `src/types.ts`, `src/state/signals.ts`, `src/palette/model.ts`, `e2e/helpers/screens.ts`, `e2e/visual/shots.ts`, `src/state/mockup.ts` parsing, `src/extract/messages.ts` or the design docs after T2. A task that needs something new adds it in its own module.
- Each task puts its e2e tests in its own spec file. Shared specs such as tokens, a11y and coming-soon iterate registries and need no edits.
- The plan's choices that the spec leaves open are listed as D1 to D21 under "Defaults (Q7)". Answers to Q1 to Q6 may change the tests marked with that question.

### M3-T1: Palette model, history store, Undo and Redo
- Files:
  - `src/types.ts`:
    - `Swatch.extracted: { color: Oklch; point: ImagePoint | null } | null` (for reset to extracted, 3.7)
    - `Swatch.sampleStat: "mean" | "median"` (D8)
    - `Adjustments`, with the fields of 7.5 plus `evenOut` and `harmonize { anchor, amount }` (D1)
    - `ImageViewMode` ("image", "palette" or "values")
    - `ViewSettings { mode, bands: "continuous" | 3 | 5, closeInValue, colorsFrom, dither }`
    - `Project` gains `adjustments` and `view`. `SCHEMA_VERSION` stays 1, because there are no project files before M5.
  - `src/state/defaults.ts`: `DEFAULT_ADJUSTMENTS` (identity) and `DEFAULT_VIEW_SETTINGS` (image, 5 bands, 0.03, palette, dither off).
  - `src/state/signals.ts`:
    - `palette` stays the stored base list (7.5 "base swatches").
    - New: `adjustments`; `outputPalette`, computed as `applyAdjustments(palette, adjustments)` (7.5 "palette"); `viewSettings`.
    - New view state, kept out of undo: `compareBefore`, `hoveredSwatchId`, `markersVisible`, `eyedropperMode`.
  - `src/palette/adjust.ts`: `applyAdjustments` as an identity stub. T6 fills it in.
  - Every reader of displayed colors switches to `outputPalette`: SwatchStrip, the selection label, CopyButtons, the cluster-map `assign` call and the export drawer.
  - `src/palette/model.ts`: pure operations: `addSwatch`, `duplicateSwatch`, `deleteSwatch`, `moveSwatch(from, to)`, `setLocked`, `renameSwatch`, `setSwatchColor`, `setSwatchPoint` and `resetToExtracted`. Also `MAX_SWATCHES = 12` (Q4a) and `canAdd(palette)`.
  - `src/color/gamut.ts` (7.9): `inGamut(oklch)` and `clampChroma(oklch)`, a binary search on C to 1e-4 that keeps L and H (D3). T3, T6 and T7 use it.
  - `src/state/history.ts`:
    - snapshots of `{ palette, adjustments, settings }` (Q3a)
    - `commit(label)`, plus `begin()` and `end()` to coalesce a drag into one step (D16)
    - `undo()` and `redo()`, with `canUndo` and `canRedo` signals and the step labels
    - a limit of 50 steps
    - `clear()`
    - Applying a snapshot sets a `restoring` flag.
  - `src/state/extraction.ts`:
    - When a re-extraction caused by a settings change lands, commit one step labelled with the setting (Q3a).
    - While `restoring` is set, a settings change doesn't extract.
    - A new image calls `history.clear()` (Q3b).
    - `applyColors` fills `extracted` from the extracted color.
  - `src/ui/Header.tsx`:
    - Undo and Redo work: text buttons on desktop, icons on phones.
    - Disabled when there is nothing to undo or redo.
    - The accessible name includes the step, such as "Undo Colors".
  - `src/ui/shortcuts.ts`:
    - one keydown listener, with `registerShortcut(key, handler)`
    - shortcuts are off while a text field has focus (spec 6)
    - Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z
  - `src/ui/comingSoon.ts`: controls for later features carry `data-coming-soon`. Undo and Redo lose it.
  - `e2e/coming-soon.spec.ts`: becomes registry-free: every `[data-coming-soon]` control shows the toast. Later tasks then remove a control by editing only its own component.
- Tests to write first:
  - `tests/state/history.test.ts`:
    - "51 commits keep the last 50"
    - "undo restores palette, adjustments and settings; redo re-applies them"
    - "a commit after undo clears redo"
    - "begin/end around 30 updates gives one step"
    - "undo leaves selectedSwatchId, activeTab, imageView, viewSettings, markersVisible and compareBefore unchanged" (3.6)
    - "clear() empties both stacks"
  - `tests/palette/model.test.ts`:
    - "moveSwatch(0, 2) on [A, B, C] gives [B, C, A]"
    - "duplicate inserts after the source with a new id, origin manual, unlocked, point null" (D12)
    - "add and duplicate refuse at 12" (Q4a)
    - "delete keeps the other swatch objects' identity"
    - "resetToExtracted restores color and point, sets origin extracted and unlocks"
    - "setSwatchColor keeps `extracted`"
  - `tests/color/gamut.test.ts`:
    - "#E8693A is in gamut"
    - "oklch(0.7 0.3 150) is not"
    - "clampChroma keeps L and H to 1e-9, the result is in gamut (channels within [0, 1] ± 1e-6), and C + 0.001 is out of gamut"
  - `tests/state/extraction.test.ts`:
    - "a settings change commits one step after its result lands"
    - "undo restores settings and palette and starts no job"
    - "a new image clears history"
  - `e2e/undo.spec.ts`:
    - "Undo and Redo are disabled at start"
    - "Colors 6 → 8, then Undo, gives back the same 6 hexes with no new job; Redo gives 8"
    - "Ctrl/Cmd+Z undoes, but not while the Colors field has focus"
    - "phone Undo and Redo icons are at least 44 × 44"
    - "demo mode: undo works in memory and touches no storage"
- Done when:
  - Tests pass.
  - The UI looks the same apart from the live Undo and Redo.
  - Copy HEX and the strip read `outputPalette`.
- [x] Done
  - Note: Undo and Redo are `aria-disabled` rather than `disabled` when empty, so keyboard focus stays on them. Settings steps are named in `src/state/setting-labels.ts`. T1's choices for step labels, the selection after undo, cancelling a pending job and a duplicate's population were confirmed by the user as decisions 3c to 3f.

### M3-T2: Scaffolding for parallel work (shells, slots, registries, docs)
- Files:
  - `src/ui/ChevronRow.tsx` (contract "Chevron row"):
    - expands in place at 1024 px and up; below that, opens a `BottomSheet`
    - uses `aria-expanded`
    - opens from the `rows=` parameter
  - `src/ui/BottomSheet.tsx` (contract "Bottom sheet"):
    - grabber, title and close button (44 px), over `--color-scrim`
    - traps focus; Esc, a scrim tap or a downward swipe closes it and returns focus
    - pads with `env(safe-area-inset-bottom)`
    - no motion when reduced motion is requested
  - `src/ui/Slider.tsx`:
    - The M2 Colors slider plus `NumberField`, made generic: a large thumb and a number stepper (6.1).
    - The Colors row switches to it with no visible change.
  - `src/ui/PalettePanel.tsx`, following contract column 2:
    1. the strip
    2. the selection label
    3. `<SwatchEditor/>`
    4. chevron rows: Swatch (Q5a), Adjustments, Contrast and CVD
  - Stub components, each in its own file:
    - `SwatchEditor.tsx`: has the Lock pill (`data-coming-soon`) and a Ramp pill that opens `<RampPanel/>`, inline on desktop and as a sheet on phones
    - `SwatchDetails.tsx`, `AdjustmentsPanel.tsx`, `ContrastPanel.tsx`, `CvdPanel.tsx` and `RampPanel.tsx`
    - Each stub shows the muted line "Coming in a later version".
  - The phone Cluster map toggle moves from PalettePanel into the `SwatchDetails` stub (M2 decision 13d).
  - `src/ui/ImageWell.tsx` slots:
    - `<ViewLayer/>` inside the transformed layer
    - `<MarkerLayer/>`: an untransformed overlay that maps normalized points through `imageView`, so markers keep their size at any zoom (3.7)
    - `<WellTools/>`: in the corner beside `ZoomControls`
    - Every slot is a stub.
  - Pointer routing in `ImageWell.tsx`: pan and pinch ignore a pointerdown on `[data-marker]`, and every pointerdown while `eyedropperMode` is on.
  - `src/ui/StripMarks.tsx`: a stub under the strip.
  - `SwatchStrip.tsx`:
    - sets `data-linked` when `hoveredSwatchId` matches
    - pointer enter and leave and focus set `hoveredSwatchId`
  - `src/extract/messages.ts`, `worker.ts` and `client.ts` reserve three requests:
    - `sample` (point, radius, stat): returns OKLab plus a 15 × 15 crop for the loupe
    - `place` (colors, indexes): returns points
    - `view` (mode, palette, bands, dither): returns an `ImageBitmap`, shares and band shares
    - The handlers call `src/extract/markers.ts`, `src/image/sample.ts` and `src/image/views.ts`, which are stubs that throw "not built". The main-thread fallback routes the same functions (7.4).
  - `src/state/mockup.ts`: parse these parameters (D20):
    - `image=image|palette|values`
    - `rows=swatch|adjustments|ramp|contrast|cvd`, extending M2's `rows`
    - `loupe=<1 to 6>`
  - `e2e/helpers/screens.ts` and `e2e/visual/shots.ts`: register every M3 screen and shot from "Screens affected" now.
  - `docs/design/mockup-state.md`: add the parameters above.
  - `docs/design/visual-testing.md`: add the shots.
  - `src/styles/app.css`: one empty, labelled section per task, such as `/* M3-T6 adjustments */`.
- Tests to write first:
  - `tests/state/mockup.test.ts`:
    - "parses rows=adjustments, image=values, loupe=3"
    - "ignores unknown values"
  - `tests/extract/client-reserved.test.ts`: "sample, place and view round-trip through the worker and the fallback and reject with 'not built'".
  - `e2e/sheets.spec.ts`:
    - "desktop: Adjustments expands in place and aria-expanded toggles"
    - "phone: Adjustments opens a sheet with focus inside; Esc, the close button, a scrim tap and a downward swipe each close it and return focus"
    - "the sheet's bottom padding includes the safe-area inset"
    - "the phone Cluster map toggle is in the Swatch sheet, not on the Palette tab" (13d)
  - `e2e/tokens.spec.ts` and `e2e/a11y.spec.ts`: no edits. They pick up every registered M3 screen and pass with the stubs, in both themes.
- Done when:
  - Tests pass.
  - The visible changes are the four chevron rows and the Lock and Ramp pills (all "coming later").
  - T3 to T16 can each be done without touching a registry, a design doc, `PalettePanel.tsx`, `messages.ts` or another task's file.
- [x] Done
  - Note: `e2e/tokens.spec.ts` got one edit after all. Its phone touch-target test clicks the header's Theme button, which is inert behind a modal sheet. It now checks the screen with the sheet open, then presses Esc before the theme-menu step. Nothing it checked before is dropped.
  - Note: three M2 phone tests in `e2e/cluster-map.spec.ts` now open the Swatch sheet before using the Cluster map toggle, which moved there (13d). Their assertions are unchanged.
  - Note: the reserved requests:
    - `view` replies with RGBA pixels (like `overlay`), not an `ImageBitmap`. `client.view()` returns them, and T14's `ViewLayer` draws them with `putImageData`. The fallback worker may have no OffscreenCanvas, and the client test runs in Node.
    - `place` also carries the settings, as `assign` does, for the analysis copy and filters.
    - `sample` sends a master window (`readWindow`, `SAMPLE_WINDOW_HALF` = 32 px in `src/image/tiers.ts`). The worker reads it from its master; the fallback reads it on the main thread with a canvas read. Both pass the same `MasterWindow` to `samplePatch`.
    - The fallback sends display-size pixels for `view` once per image version, and the worker keeps them.
    - The `extracted` reply reserves `points?`, and `client.extract()` passes them through, so T10 needn't edit `messages.ts` or `client.ts`.
  - Note: other additions:
    - `src/ui/EyedropperLayer.tsx`, an extra slot for T16.
    - The `well-tools` class, whose pointers pan ignores.
    - `keysIgnored`: the well's arrow keys don't pan while focus is on a marker.
  - Note: `image=` and `loupe=` have their own parsers (`parseMockupImage`, `parseMockupLoupe`), like `zoom` and `cluster`, so `MockupParams` keeps its M1 shape. `main.tsx` sets `viewSettings.mode` and the new `initialLoupe` signal from them. A row opened by `rows=` opens once per page load.
  - Note: two moves with no behavior change. `useLayout` moved to `src/ui/layout.ts`, which `Shell.tsx` re-exports, so panels can use it without a cycle. `NumberField` moved to `src/ui/NumberField.tsx`, and `Slider` uses it for whole numbers and `DecimalField` for decimals. `Slider` has `onDragStart`/`onDragEnd` for history `begin`/`end`.
  - Note: the desktop `rows=` shots are 1280 × 1280, like advanced-desktop, so an open row fits in column 2 without scrolling it.
  - Note: rebased onto milestone/M2 with fixes F1 to F7.
    - The Cluster map toggle now lives only in the Swatch row's content (13d). It shows in the phone layout and on any device without a fine pointer (13f, `useNoFinePointer` in `src/ui/layout.ts`), so on an iPad in landscape it is in the Swatch row, expanded in place in column 2. F5's separate column-2 copy is gone; `e2e/cluster-toggle-touch.spec.ts` opens the Swatch row first.
    - On the phone Source tab, `StripMarks` sits inside F1's sticky `strip-dock` with the strip, so the marks pin with it.
    - The chevron-row button keeps F4's padding and F7's 15 px touch text. `setting-rows`, `setting-row-padding` and `setting-row-text` now also cover the Palette tab's rows and the Swatch sheet.

### M3-T3: Color editor: L, C, H, HEX, gamut indicator, Lock
- Files:
  - `src/ui/SwatchEditor.tsx` (contract column 2 items 3 and 4):
    - L (0 to 1), C (0 to 0.4) and H (0 to 360) sliders with number fields
    - A HEX field: autocorrect, autocapitalize and spellcheck off (6.1). It accepts 3 or 6 digits, with or without #.
    - Out-of-gamut indicator: a warn dot plus "Out of sRGB" text, since warn is always paired with a label (tokens.css)
    - Lock pill with `aria-pressed`
    - Each edit follows Q1b. A slider drag is one undo step (D16).
  - `src/color/hex.ts`: `parseHex`.
  - `app.css`: the T3 section.
- Tests to write first:
  - `tests/color/hex.test.ts`:
    - "'#e8693a', 'E8693A' and 'e63' parse"
    - "'xyz' and '#12345' are rejected"
  - `e2e/editor.spec.ts`:
    - "demo: Swatch 3 shows L 0.345 and HEX #14386B" (mockup-state)
    - "typing #1E8A2E updates strip swatch 3 and is one undo step"
    - "one L-slider drag is one undo step"
    - "C 0.4 at H 150 shows 'Out of sRGB'"
    - "Lock toggles aria-pressed and is undoable"
    - "an edit locks the swatch" (Q1b A)
    - "number fields show '0.345' with the locale forced to de-DE"
    - "fields are 16 px with inputmode=decimal at phone width"
    - "arrow keys move a focused slider"
- Done when: tests pass; the T2 Lock stub is replaced; Ramp still opens the T2 stub.
- [x] Done

### M3-T4: Swatch row and sheet: formats, name, copy, duplicate, delete, reset, sample settings
- Files:
  - `src/ui/SwatchDetails.tsx` (Q5a). It contains:
    - a format choice (HEX, RGB, HSL, OKLCH) with editable fields
    - a Name field with a suggestion chip (D15)
    - Copy (D14), Duplicate and Delete
    - Reset to extracted, with the ΔE (D13)
    - Sample radius (Auto, 1, 3, 5, 11) and Mean or Median (D8)
    - the Cluster map toggle, which works on desktop too (D21)
  - `src/color/css-names.ts`: the CSS Color 4 named colors, with `nearestCssName(oklab)`.
  - `src/export/format.ts`: `formatRgb`, `formatHsl` and `formatOklch`, always with a period as the decimal separator.
  - `app.css`: the T4 section.
- Tests to write first:
  - `tests/color/css-names.test.ts`:
    - "#FF6347 → tomato"
    - "#FE6347 → tomato"
    - "#FFFFFF → white"
    - "gray and grey count once"
  - `tests/export/format.test.ts`:
    - "#E8693A → rgb(232 105 58)"
    - "#E8693A → hsl(16 79% 57%)"
    - "oklch keeps 3 decimals for L and C and 1 for H, with periods under de-DE"
  - `e2e/swatch-details.spec.ts`:
    - "rename to 'Harbor' shows in the label and is undoable"
    - "the suggestion chip applies the name"
    - "Duplicate adds the copy right after swatch 3; at 12 it is disabled with 'A palette holds up to 12 colors'" (Q4a)
    - "Delete, then Undo, restores the swatch in place"
    - "Copy writes the selected format" (Chromium clipboard)
    - "Reset to extracted is disabled for an unedited swatch; after an edit it restores the color and shows the ΔE"
    - "the radius and Mean/Median are stored on the swatch"
    - "phone: the Cluster map toggle in the swatch sheet shows the overlay" (13d)
- Done when: tests pass.
- [x] Done
  - Note: the fields show the output (adjusted) color; an edit stores that exact color and locks the swatch (1a, 1b), like T3. Copy writes the same color. Only the Cluster map row uses `.setting-row`; the other controls use `.swatch-field`, so `setting-row-text.spec.ts` (which expects the sheet to hold one visible `.setting-row__label`) still passes unchanged. Edits commit on Enter or blur (D16). The desktop case in `cluster-toggle-touch.spec.ts` now expects the toggle (D21).

### M3-T5: Strip actions: add, drag to reorder, arrow keys
- Files:
  - `src/ui/SwatchStrip.tsx`:
    - A "+" tile at the end. It opens a menu with "Pick from image" (switches to eyedropper Add once T16 lands; until then `data-coming-soon`) and "Type a color" (adds a manual mid-gray swatch and focuses HEX) (Q5b).
    - Drag to reorder (D10).
    - Arrow keys on a focused swatch move it one place; Tab moves focus (spec 6).
    - Each move is one undo step.
    - The layout at 7 to 12 colors still follows M1 decision 13.
  - `app.css`: the T5 section.
- Tests to write first:
  - `e2e/strip-actions.spec.ts`:
    - "mouse drag of swatch 1 onto swatch 3 gives the order 2, 3, 1, 4, 5, 6; Undo restores it"
    - "ArrowRight on focused swatch 2 swaps it with 3 and keeps focus on it"
    - "phone: a quick swipe on the strip scrolls the page; a 300 ms press, then a drag, reorders" (phone-webkit, phone-chromium)
    - "'+' then 'Type a color' adds swatch 7, origin manual, with the HEX field focused"
    - "the '+' tile is disabled at 12"
    - "the '+' tile is at least 44 × 44 at 320 px"
  - `e2e/strip-layout.spec.ts` gets no edits; it must still pass.
- Done when: tests pass; nothing depends on hover.
- [x] Done
  - Note: "Type a color" focuses the HEX field only when it is visible (phones keep the editor in the Palette tab).

### M3-T6: Global adjustments and before/after compare
- Files:
  - `src/palette/adjust.ts`:
    - the ten adjustments of 3.3, in table order with Gamut last (D1, D2)
    - locked swatches are skipped (Q1a)
    - `resetAdjustments`
  - `src/ui/AdjustmentsPanel.tsx`:
    - one `Slider` per adjustment
    - Even out as a `Toggle`
    - Harmonize: anchor and amount
    - Gamut: Off or Clamp
    - Reset
    - Compare: a view-state toggle that shows base colors in the strip, the editor and the views
  - `app.css`: the T6 section.
- Tests to write first:
  - `tests/palette/adjust.test.ts`:
    - "identity parameters return equal colors"
    - "Lightness +0.1: L 0.5 → 0.6; clamps at 1"
    - "Chroma 150%: C 0.1 → 0.15"
    - "Hue +30: H 350 → 20"
    - "Contrast 120%: L 0.3 → 0.26"
    - "Temperature +0.02 adds 0.02 to OKLab b; Tint +0.02 adds 0.02 to a"
    - "Gamma 2: L 0.5 → 0.25"
    - "Lightness range 0.2 to 0.8: 0.1 → 0.2 and 0.9 → 0.8"
    - "Even out: L [0.2, 0.3, 0.8] → [0.2, 0.5, 0.8], order kept"
    - "Harmonize anchor 0°, 50%: H 60 → 30. Anchor 10°, 50%: H 350 → 0 (shorter arc)"
    - "Gamut clamp makes oklch(0.7 0.3 150) in gamut with L and H kept"
    - "locked swatches are unchanged" (Q1a)
  - `e2e/adjustments.spec.ts`:
    - "Lightness +0.1 moves swatch 3 from L 0.345 to 0.445 in the editor and changes the strip hex"
    - "a locked swatch stays the same"
    - "one slider drag is one undo step"
    - "Reset returns the base hexes"
    - "Compare shows the base hexes and isn't an undo step"
    - "Copy HEX copies the adjusted hexes"
- Done when: tests pass.
- [x] Done
- Note: Compare is applied in `outputPalette`, so the strip, editor and views all show base colors.

### M3-T7: Ramps and harmonies
- Files:
  - `src/color/ramps.ts`: `ramp(oklch)` returns 11 steps from 50 to 950 (D4).
  - `src/color/harmony.ts`: `harmonies(oklch)` (D5).
  - `src/ui/RampPanel.tsx`:
    - two sections, Ramp and Harmonies
    - each step or color is a tile that can be added to the palette (Q4b)
    - adding is disabled at 12, with a note (Q4a)
    - each add is one undo step
  - `app.css`: the T7 section.
- Tests to write first:
  - `tests/color/ramps.test.ts`:
    - "11 steps labelled 50, 100, 200, …, 900, 950"
    - "L is 0.97 at 50 and 0.25 at 950, strictly decreasing"
    - "#E8693A (L 0.668) sits exactly at step 400 (target L 0.682 is the nearest)"
    - "C at 500 equals the source C; C at 50 and 950 is 0.3 × the source C before the gamut clamp"
    - "every step is in gamut"
    - "H is unchanged"
  - `tests/color/harmony.test.ts`, for oklch(0.6 0.1 30):
    - "complementary 210"
    - "split-complementary 180 and 240"
    - "triadic 150 and 270"
    - "tetradic 120, 210 and 300"
    - "analogous 0 and 60"
    - "L and C are kept unless gamut-clamped"
  - `e2e/ramp.spec.ts`:
    - "Ramp on swatch 1 shows 11 tiles with #E8693A at 400"
    - "adding 700 adds a manual swatch; Undo removes it"
    - "harmonies show 5 groups"
    - "phone: opens as a sheet"
    - "tiles are data-user-content and at least 44 px on phones"
- Done when: tests pass.
- [x] Done
  - Note: the panel uses the selected swatch's output color and adds tiles as manual swatches at the end without changing the selection. `e2e/sheets.spec.ts` now expects the real panel instead of the stub text. That spec's desktop Adjustments test still fails on the `Lock` coming-soon check, which T4 made stale (not caused by T7).

### M3-T8: Contrast matrix and close-pair warnings
- Files:
  - `src/color/contrast.ts`: WCAG 2.x relative luminance, `contrastRatio` and `badge` (D7).
  - `src/palette/close-pairs.ts`: pairs closer than the merge threshold under the distance metric, using M2's `thresholdFor` and `deltaE`.
  - `src/ui/ContrastPanel.tsx` (Q6c):
    - an N × N matrix with sample cells marked `data-user-content`
    - the ratio and a text badge in each cell
    - a "Close pairs" list
  - `src/ui/ClosePairsMark.tsx`: a warn dot plus text next to the strip. It renders inside `StripMarks` only in the Image view.
  - `app.css`: the T8 section.
- Tests to write first:
  - `tests/color/contrast.test.ts`:
    - "#FFFFFF/#000000 is 21.00"
    - "#767676 on #FFFFFF is 4.54 and gets AA"
    - "#777777 on #FFFFFF is 4.48 and gets AA large only"
    - "the ratio is symmetric"
    - "badge thresholds are 3, 4.5 and 7"
  - `tests/palette/close-pairs.test.ts`:
    - "under CIEDE2000 with stored threshold 0.03 (3.0), #E8693A/#EA6B3B (ΔE00 0.64) is a pair and #14386B/#E8693A is not"
    - "the mockup palette has no close pairs at ΔE OK 0.03"
    - "locked and unlocked swatches are both checked"
  - `e2e/contrast.spec.ts`:
    - "demo: the Contrast row shows a 6 × 6 matrix and the diagonal reads 1.00"
    - "badges are text, not only color"
    - "a runtime-generated #E8693A/#EA6B3B image with merge threshold 0 gives two swatches and a 'Swatches 1 and 2 are very close' warning"
    - "the matrix cells are identical in light and dark"
- Done when: tests pass.
- [x] Done
  - Note: the plan's e2e premise (a #E8693A/#EA6B3B image at merge 0 shows a warning) can't hold. Both colors share one histogram bin even at 6 bits, so extraction gives one swatch; and at threshold 0 nothing is "closer than the threshold". The generated image uses #E8693A/#F0693A (two swatches, no warning at 0); the warning itself is tested by editing Swatch 3 to #EA6B3B in the demo, on the strip mark and in the Contrast row. Close pairs are checked on the adjusted palette. The diagonal shows no badge. The matrix scrolls sideways inside its own region at 12 swatches.

### M3-T9: CVD simulation
- Files:
  - `src/color/cvd.ts` (D6): Machado 2009 at severity 1 for protanopia, deuteranopia and tritanopia, applied in linear sRGB and clipped. Achromatopsia uses the Rec. 709 luminance gray.
  - `src/ui/CvdPanel.tsx`: a Normal strip plus one strip per type, each labelled and marked `data-user-content`.
  - `app.css`: the T9 section.
- Tests to write first:
  - `tests/color/cvd.test.ts`:
    - "each matrix row sums to 1 ± 1e-5"
    - "protanopia of linear (1, 0, 0) is (0.152286, 0.114503, −0.003882) before clipping"
    - "grays are unchanged within 1/255 for all three"
    - "achromatopsia gives R = G = B"
    - "output is in gamut"
  - `e2e/cvd.spec.ts`:
    - "demo: the CVD row shows 5 strips of 6 swatches"
    - "strips update after an adjustment"
    - "phone: opens as a sheet"
    - "strip colors are identical in light and dark"
- Done when: tests pass.
- [x] Done. Note: "strips update after an adjustment" edits the swatch through the HEX field (T3), since the Adjustments panel is T6; it is desktop-only because the sheet covers the editor on phones.

### M3-T10: Marker placement and patch sampling (engine)
- Files:
  - `src/extract/markers.ts` (3.7):
    - `placeMarkers(labels, width, height, colors, analysis)` uses the cluster map's per-pixel labels (M2 T13).
    - A box blur with radius 3% of the shorter side runs on integer counts (a summed-area table), so ties are exact.
    - It takes the highest density; ties go to the smallest ΔE to the swatch, then the lowest y, then the lowest x.
    - Output is normalized.
    - A swatch with no pixels gets the pixel with the smallest ΔE.
  - `src/image/sample.ts`:
    - `autoRadius(w, h)` is max(2, round(0.005 × shorter side)).
    - `samplePatch(master, point, radius, stat)` gives the mean in OKLab or the per-channel median, plus a 15 × 15 crop clamped at the edges.
  - `src/extract/worker.ts`:
    - `extracted` carries `points`
    - the `sample` and `place` handlers work on the working master (7.4)
  - `src/state/extraction.ts`: `applyColors` stores `point` and `extracted.point`.
- Tests to write first:
  - `tests/extract/markers.test.ts`:
    - "a 20 × 20 #FF0000 block plus 5 stray red pixels on #808080 (64 × 64) puts red at the block center ± 1 px"
    - "ties follow ΔE, then y, then x"
    - "points lie in [0, 1]"
    - "mockup-scene.png at 256 px: all six points within 0.02 of the fixture points" (mockup-state)
    - "a swatch with no pixels gets its closest pixel"
  - `tests/image/sample.test.ts`:
    - "Auto is 4 px on 1600 × 800 and 2 px on 300 × 200"
    - "on a half #FF0000, half #0000FF 100 × 100, the mean at (0.25, 0.5) with radius 3 is #FF0000"
    - "on the boundary, the mean mixes and the median returns one of the two"
    - "the crop is 15 × 15 and clamped at the corners"
  - `tests/extract/client-markers.test.ts`: "extraction returns one point per color; sample resolves with OKLab and a transferred crop".
- Done when:
  - Tests pass.
  - No UI-thread code loops over pixels.
  - Re-extraction at 256 px with Balanced stays near M2's logged time (informational).
- [x] Done
  - Note: one tie-break added. After ΔE, ties go to the tied pixel nearest the tied pixels' centroid, and only then to the lowest y and x. With a 3% box blur, every pixel of a flat patch wider than the box has the same density, so "lowest y, then x" alone puts the marker at the plateau's top-left corner: 7.5 px off the 20 × 20 block's center in the plan's own test. The ΔE, y and x order is otherwise as planned. Needs the user's confirmation, since it goes beyond the plan.
  - Note: in Node, placement takes about 7 ms at 256 × 128 (mockup-scene: every point within 0.003 of the fixture) and about 70 ms at 1600 × 800.
  - Note: other choices the plan leaves open:
    - Samples use the disc of the radius around the point's pixel.
    - Transparent pixels count only when the whole patch is transparent.
    - The median is the lower middle value, so it is always a sampled value.
    - The crop repeats edge pixels past the image edge, so the point stays at its center, where the loupe's crosshair is.
    - A swatch with no pixels takes the nearest kept pixel, or the nearest pixel of all when the filters keep none.
  - Note: `tests/extract/client-reserved.test.ts` (T2) now expects `sample` and `place` to resolve; only `view` still rejects with "not built".

### M3-T11: Palette and Values views (engine)
- Files:
  - `src/image/views.ts` (3.8):
    - `paletteView`: each pixel takes its nearest swatch in OKLab. Dither is optional: Floyd–Steinberg with error in OKLab (D18). Shares are fractions of all opaque pixels.
    - `valuesView`: continuous, 3 or 5 bands, each band drawn as the gray at its middle L.
    - Both are drawn from the working master at display size.
  - `src/palette/values.ts`: `closeInValue(palette, threshold)`.
  - `src/extract/worker.ts`: the `view` handler, cached by image version, mode, palette hexes, bands and dither. Switching views never extracts.
- Tests to write first:
  - `tests/image/views.test.ts`:
    - "on a two-color image with palette [A, B], every pixel is A or B and shares sum to 1 within 1e-9"
    - "with dither on, every pixel is still a palette color"
    - "a 50% gray area over a [black, white] palette dithers to 50% ± 2% black"
    - "5 bands over a full L ramp give exactly #030303, #2E2E2E, #636363, #9E9E9E and #DEDEDE"
    - "3 bands give grays at L 1/6, 1/2 and 5/6"
    - "mockup-scene.png: shares 83.2% (swatch 2), 14.7% (swatch 1) and 0.5% each (3 to 6), ± 0.3 pp; band 5 is 96.8%" (mockup-state)
  - `tests/palette/values.test.ts`:
    - "the fixture at 0.03 flags exactly swatches 1 and 2 (ΔL 0.004)"
    - "1 and 4 (ΔL 0.046) aren't flagged"
    - "the threshold clamps to 0.01 to 0.10"
  - `tests/extract/client-views.test.ts`: "a second request with the same key is served from the cache (no recompute)".
- Done when: tests pass.
- [x] Done
  - Note: the worker keeps one cached view per mode (the last Palette view and the last Values view), so memory stays bounded at display size; a new image clears it. The key holds only what a view depends on: the version and mode, plus the palette hexes and dither for the Palette view, or the bands for the Values view. So a palette change doesn't recompute the Values view. `viewKey` is in `views.ts`.
  - Note: the Palette view compares and draws each color by its hex (as the strip shows it), so an out-of-gamut swatch draws as its clamped hex, and the hex cache key is exact.
  - Note: a view request carries no extraction settings, so "opaque" means alpha of at least 128, the default alpha cutoff (spec 2.4). Other pixels are drawn transparent and left out of the shares.
  - Note: the dither test's "50% gray" is the gray at OKLab L 0.5 (`#636363`), since the error diffuses in OKLab.
  - Note: `tests/extract/client-reserved.test.ts` now expects `view` to resolve; `sample` and `place` still expect "not built" until T10. Unit tests read PNGs with a small decoder, `tests/image/decode-png.ts`.

### M3-T12: Markers on the image, the link to swatches, show/hide, loupe component
- Files:
  - `src/ui/MarkerLayer.tsx` (3.7, contract "Marker"):
    - one ring per swatch with a point: `--marker-ring-outer` and `--marker-ring-inner` around a swatch-color fill marked `data-user-content`, with the number beside it
    - the selected marker has the accent ring and sits on top
    - a 44 px hit area with `touch-action: none`, `-webkit-touch-callout: none` and `user-select: none`
    - the same on-screen size at any zoom
    - labels fan out when rings are within 44 px (D9)
    - a tap or click selects; pointer enter and focus set `hoveredSwatchId`, which links the marker and the swatch both ways
    - accessible names such as "Swatch 3 marker, 77%, 17%"
    - shown only in the Image view (3.8 "Behavior")
  - `src/ui/WellTools.tsx`: the Markers show/hide toggle (Lucide `MapPin`, Q5c).
  - `src/ui/Loupe.tsx`:
    - draws a sample crop at 8× with a crosshair and the live HEX
    - sits above the point on touch and beside the pointer with a mouse
    - `loupe=<n>` shows it over that marker
  - `src/ui/SourcePanel.tsx`: the hint "Drag a marker to resample", shown only in the Image view (contract column 1 item 3).
  - `app.css`: the T12 section.
- Tests to write first:
  - `e2e/markers.spec.ts`:
    - "demo: six markers at the fixture points (± 2 px); marker 3 is selected"
    - "hovering marker 2 sets data-linked on swatch 2, and the reverse"
    - "tapping marker 5 selects swatch 5 (phone)"
    - "the marker diameter is the same at zoom 1 and 4, and markers stay on their patches at zoom 4"
    - "the hit area is at least 44 × 44"
    - "the show/hide toggle hides all markers and is view state (not in undo)"
    - "the cluster overlay and the markers can show together"
    - "loupe=3 shows #14386B"
    - "markers are visible on all-white and all-black runtime images: both ring colors are present in a screenshot crop"
  - `e2e/theme-content.spec.ts` (an M2 test, not edited): it covers the marker fills through `data-user-content`.
- Done when: tests pass; markers hide in the Palette and Values views.
- [x] Done
  - Note: the Markers toggle sits bottom-left (the zoom pill keeps the bottom-right), and hides outside the Image view. A selected, focused or linked marker rises above the zoom pill, so one under it stays reachable by keyboard and from the strip. `Loupe` takes `{hex, crop, at, well, touch}`; T15 and T16 feed it the crop from `ExtractClient.sample`. The demo `loupe=<n>` crop is read from the fixture image. `e2e/theme-content.spec.ts` got one edit: it also hides `.well-tools` and the selected marker's accent ring (themed UI) before comparing; marker fills and rings stay compared. The desktop toggle is 32 px (`--hit`), 44 px on phones. The phone tap test for marker 5 taps the part of its hit area above the pill.

### M3-T13: Re-extraction keeps locked swatches; Place on image; reset position
- Files:
  - `src/palette/reextract.ts`: `mergeLocked(previous, extracted, metric)`, following Q2.
  - `src/state/extraction.ts`:
    - uses `mergeLocked`
    - locked swatches keep their id, point and origin; unlocked swatches get fresh points
    - asks the worker to place only the new swatches
  - `src/ui/SwatchDetails.tsx`:
    - "Place on image", for swatches without a point (3.7 "Edge cases")
    - Reset to extracted also restores the point
- Tests to write first:
  - `tests/palette/reextract.test.ts`:
    - "previous [A, B*, C] (B locked) and extracted [X, Y, Z] with Y nearest B give [X, B, Z]" (Q2a A, Q2b A)
    - "with locked ≥ Colors, all locked are kept and none added"
    - "locked keep id, point, origin and extracted"
    - "unlocked manual swatches are replaced" (Q2c A)
  - `e2e/reextract.spec.ts`:
    - "lock swatch 2, change Colors 6 → 5: 5 swatches; swatch 2 has the same hex, position and point"
    - "Undo restores 6"
    - "Place on image gives a manual swatch a marker on its best-matching patch"
    - "Reset to extracted restores the marker position"
- Done when: tests pass.
- [x] Done
  - Note: the extraction already returns a point for every new color (T10), so the worker is not asked to place anything on re-extraction; `place` is used only by Place on image (`placeOnImage` in `extraction.ts`, one undo step "Place on image"; disabled with "Load an image first" when there is no image).
  - Note: locked swatches are kept only when the result is for the same image; a new image keeps none, since their points belong to the old one. With a locked swatch mixed in, the cluster map (indexed by the extracted colors) is dropped, as the strip does on reorder.
  - Note: "Reset to extracted restores the marker position" is covered by `tests/palette/model.test.ts` (T1) only. It needs a marker drag to move a point, which is T12/T15, so there is no e2e for it yet; T17 should add it.

### M3-T14: Palette and Values views (UI)
- Files:
  - `src/ui/SourcePanel.tsx`: the view bar works for Image, Palette and Values. Grid stays `data-coming-soon`. The rows under the image swap with the view (3.8, contract "Image views").
  - `src/ui/ViewLayer.tsx`: draws the view's `ImageBitmap` in the transformed layer, marked `data-user-content`, so it zooms and pans.
  - `src/ui/PaletteViewRows.tsx` (contract Palette view items 3 to 5):
    - area-share bar, largest first
    - legend, with equal small shares merged into one entry ("0.5% each")
    - Colors from: Palette, with Matched paints disabled and the note "Needs paint matching" (D18)
    - Dither toggle
  - `src/ui/ValuesViewRows.tsx` (Values view items 3 to 5):
    - band strip with "Dark" and "Light"
    - Bands row
    - Close in value row with a warn dot and the count; it expands to the threshold slider (D19)
    - the flagged pairs, with their chips
  - `src/ui/StripMarks.tsx`: the warn bracket and "Close in value" under the flagged pair (contract Values view item 6).
  - The selection label shows the Palette-view share of the selected swatch (3.8 "in each swatch's details").
  - `app.css`: the T14 section.
- Tests to write first:
  - `e2e/image-views.spec.ts`:
    - "image=palette: legend 83.2%, 14.7% and '0.5% each' (± 0.3 pp)"
    - "every pixel of the view canvas is one of the six hexes (dither off)"
    - "image=values: 5 bands; the canvas has exactly the 5 grays; Close in value reads '1 pair'; the strip bracket spans swatches 1 and 2; 'Swatch 1 and 2, ΔL 0.004'"
    - "switching views starts no extraction job and a cached switch takes under 100 ms" (3.8 acceptance 1)
    - "an adjustment updates the Palette view"
    - "markers hide outside the Image view"
    - "the view isn't in undo"
    - "Bands 3 gives 3 grays"
    - "Dither on keeps palette colors only"
- Done when: tests pass.
- [x] Done
  - Note: legend, share bar and band strip are `PaletteViewSummary`/`ValuesViewSummary` (above the strip on phones, as in mockup 11), the pure legend text is in `src/palette/view-legend.ts`, and `viewShares` (`src/state/view-result.ts`) carries the worker's shares. The view draws RGBA with `putImageData` (T2 note), not an ImageBitmap. "Matched paints" is a disabled option labelled "(needs paint matching)", so the row keeps the mockup layout. The Values canvas holds the 4 used grays: band 1 is empty in the fixture (mockup-state.md), so the test checks a subset of the 5. The marker-hiding test checks that no `[data-marker]` exists; T12 owns the hiding. A pair outside the strip's last row gets no bracket (it stays in the pairs list). The mockup state now sets `masterThread` after preparing the fixture, so views can draw.

### M3-T15: Dragging markers (mouse, touch, pen, keyboard)
- Files:
  - `src/ui/MarkerLayer.tsx`:
    - pointer events with pointer capture
    - while dragging: once per animation frame, a `sample` request; the swatch and the loupe update live
    - on release: the swatch becomes picked and locked (3.7), the whole drag is one undo step (`begin`/`end`), and the views recompute
    - `pointercancel` and Esc restore the start
    - a second pointer cancels the drag and hands over to the pinch (D10)
    - keyboard: arrows nudge 1 master px and Shift+arrows 10 px (D9), each nudge one undo step; a live region announces the new HEX
  - `src/state/marker-drag.ts`: the drag state machine, pure.
- Tests to write first:
  - `tests/state/marker-drag.test.ts`:
    - "a move updates at most once per frame"
    - "cancel restores color and point"
    - "release commits exactly one step"
  - `e2e/marker-drag.spec.ts`:
    - "mouse: dragging marker 3 onto patch 5 (0.889, 0.778) makes swatch 3 #1E8A2E (Auto radius 4 px inside the 46 px patch), picked and locked"
    - "Undo restores #14386B, the point and unlocked"
    - "keyboard: focus marker 3, ArrowRight ×10 moves x by 0.00625 (10 / 1600) and announces the HEX"
    - "Esc mid-drag restores"
    - "touch at Fit: dragging a marker leaves window.scrollY unchanged, while a swipe elsewhere on the image scrolls" (phone-webkit, phone-chromium; M2 15h)
    - "touch at zoom 2: one finger on a marker drags it; elsewhere it pans"
    - "pointercancel mid-drag restores"
    - "a locked, moved swatch survives re-extraction" (3.7 acceptance 3)
- Done when: tests pass; small-device acceptance 3 holds in the automated profiles.
- [x] Done
  - Note: the drag logic is `MarkerDrag` in `src/state/marker-drag.ts` (deps injected, so the unit test drives frames and samples by hand). A press becomes a drag after 4 px; a click or tap only selects, so it never samples, locks or makes a step. The marker keeps its grab offset. Live, the swatch takes each sample's color and the loupe its crop; release waits for the sample of the final point, then ends the history group ("Move marker", one step). Cancel puts back the exact start palette, so no step is recorded.
  - Note: the hand-over (D10) goes through `src/ui/markerPress.ts`: the marker registers its pointer, and `Gesture` in `ImageWell.tsx` calls `takeMarkerPress` on a second pointerdown, which cancels the drag and adds the marker's pointer to the pinch. `pointerRouting.ts` got `panIgnoresExceptMarkers`.
  - Note: keyboard nudges run in order, one sample and one undo step each; a live region (`data-testid="marker-status"`) says "Swatch 3 marker moved, #RRGGBB". Nudges count working-master pixels (`masterSize` of the image's size).
  - Note: Esc and the real two-finger case have no phone-webkit e2e (no keyboard, and WebKit has no touch injection); the second-finger hand-over runs there with synthetic pointer events. The page-scroll checks run on phone-chromium only, as in zoom.spec.ts.
  - Note: the re-extraction test picks a marker nothing covers, since twelve-colors.png is wide and short and its rings overlap.

### M3-T16: Eyedropper
- Files:
  - `src/ui/WellTools.tsx`: an Eyedropper toggle (Lucide `Pipette`) with `aria-pressed`, and the E shortcut (D17).
  - `src/ui/EyedropperLayer.tsx`:
    - A press shows the `Loupe`, a move updates it, and release samples.
    - Add mode adds a picked, locked swatch with its point (D11).
    - The hint row's "Replace swatch N" chip switches to retargeting the selected swatch (Q5c).
    - Each pick is one undo step.
    - The "+" tile's "Pick from image" uses this.
  - `app.css`: the T16 section.
- Tests to write first:
  - `e2e/eyedropper.spec.ts`:
    - "Eyedropper, then a click on patch 4, adds swatch 7 #D4527F with a marker there"
    - "in Replace mode, a click on patch 6 makes swatch 3 #5039B0"
    - "Undo removes or restores"
    - "E toggles it, but not in a text field"
    - "disabled at 12 in Add mode"
    - "phone: a tap with the loupe works and the page doesn't scroll during the press"
- Done when: tests pass; nothing uses the browser EyeDropper API (6.1).
- [x] Done
  - Note: pure parts are in `src/state/eyedropper.ts` (`pointFromWell`, `addPicked`, `replaceWithPick`, `startEyedropper`). The hint row (`EyedropperHint`, with the "Replace swatch N" chip) lives in `EyedropperLayer.tsx` and replaces the marker hint `<p>` in `SourcePanel.tsx` (one edit there). The E button turns it on in Add mode (it always starts in Add; at 12 the hint says so and the chip still retargets). The layer sits above markers, and `.well-tools` and the zoom pill rise above it by a sibling rule. Pick undo labels: "Add picked color", "Replace color". "Pick from image" no longer has `data-coming-soon`, so the strip-actions test for it now expects the eyedropper to start. Deviation in T12's `Loupe.tsx`: on a well too short for the loupe above or below the finger (phones), `loupePosition` puts it beside the finger, so it doesn't sit under it. The phone e2e picks patch 6, since patch 5 sits under the zoom pill.

### M3-T17: Integration sweep, phone and theme pass, review page
- Files:
  - Fixes only, anywhere.
  - `docs/design/visual-testing.md` and `mockup-state.md`: reconcile them with what was built.
- Tests to write first:
  - `e2e/undo-all.spec.ts`: one session that edits, locks, reorders, adjusts, drags, picks and re-extracts, then undoes back to the start, ending with the same hexes, order, points and lock flags (v1 acceptance 3).
  - `e2e/layout.spec.ts`: no edits. At 320, 375, 390 and 430 px, with every M3 sheet open, there is no horizontal scroll and every control is at least 44 px.
  - `e2e/c-copy.spec.ts`: "C copies the selected swatch's HEX" (D17).
- Done when:
  - Lint, typecheck, unit tests, e2e and build all pass.
  - The bundle stays within 150 kB gzip.
  - `npm run visual:review` writes every shot.
  - No reader of displayed colors uses `palette` where `outputPalette` is meant (checked by grep, listed in the commit).
- [x] Done
  - Note: integration sweep. Full suite before: 9 failed of 3170 (3 stale tests against M3 UI: the swatch link now also links its marker, the Preset Tab walk needs more Tabs with the Eyedropper button in the order, and two rounding cases in Firefox and WebKit). Fixes: those test updates; the Swatch row's `.swatch-field` rows became `SettingRow`s (so the M2 setting-row specs now measure them: padding, 15 px labels, centering); the cluster map is dropped whenever the palette no longer fits it (`mapFits` in `extraction.ts`: same swatches, same order, each at its extracted color), so an edit, a marker drag, a Replace pick, a reorder, an add or a delete all drop it, and undo restores it (the demo's map is registered with `adoptClusterMap`); markers wore the adjusted color (reverted in M3-F2: spec 3.7 says the ring shows the image color and the strip the adjusted one); the C shortcut (D17) was missing and is now built (`copySelectedHex`); the `.swatch` lint warning is fixed by moving the rule above `.app--phone .swatch`. Adjustments don't change swatch colors, so they keep the map. New specs: `undo-all.spec.ts` (desktop only), `palette-sync.spec.ts` (Reset restores the marker, stale map, demo touches no storage, marker color), `c-copy.spec.ts`, the eyedropper "a press on a marker samples" test, and a `layout.spec.ts` test with every M3 sheet open at 320, 375, 390 and 430 px in both themes. The bundle size check is below in the commit.

## Screens affected (UI work only)

| Screen | ui-contract regions | New or changed screenshots | Mockup-state additions | Not-drawn items needing design review |
| --- | --- | --- | --- | --- |
| Desktop Studio view | Column 1 items 1 to 4 (markers, view bar live, hint, rows swap); column 2 items 1 to 5 (strip "+" tile and reorder, editor, HEX, Lock, Ramp, chevron rows); header Undo and Redo | changed: studio-desktop. New: swatch-desktop (`rows=swatch`), adjustments-desktop (`rows=adjustments`), contrast-desktop (`rows=contrast`), cvd-desktop (`rows=cvd`), ramp-desktop (`rows=ramp`), loupe-desktop (`loupe=3`). M2's zoom-desktop and cluster-map-desktop also change, because markers appear | `rows=swatch\|adjustments\|ramp\|contrast\|cvd`, `loupe=<n>` | Swatch row (Q5a); Adjustments, Contrast and CVD contents; Ramp panel; "+" tile and its menu; Eyedropper and Markers buttons in the well corner; loupe; out-of-gamut indicator; close-pair warning; marker label fan-out |
| Desktop image views | Palette view items 1 to 5; Values view items 1 to 6 | New: palette-view-desktop (`image=palette`), values-view-desktop (`image=values`); both already in `visual-testing.md` | `image=` (already in the doc; now implemented) | Matched paints disabled with its note; the threshold slider in Close in value; 3 bands, continuous, and dither on |
| Phone Source tab | items 1 to 5 | changed: source-phone. New: palette-view-phone (`image=palette`, already listed), values-phone (`image=values`; compare with `11` left phone without the grid), loupe-phone (`loupe=3`) | as above | eyedropper hint row with "Replace swatch N"; loupe above the finger |
| Phone Palette tab | strip, label, editor, chevron rows opening sheets | changed: palette-phone. New: swatch-sheet-phone, adjustments-sheet-phone, ramp-sheet-phone, contrast-sheet-phone, cvd-sheet-phone (`tab=palette&rows=…`) | as above | the whole tab and every sheet (contract "Not drawn": bottom sheets for the swatch editor, adjustments and ramps) |
| Tablet | as phone | changed: studio-tablet | none | as phone |
| Empty screens | unchanged, apart from Undo and Redo, disabled | none | none | none |

T2 registers every shot above in `e2e/visual/shots.ts` and every screen in `e2e/helpers/screens.ts`, so token and axe tests cover them in both themes from the start. The `visual` CI job fails on the changed shots until the user signs off and `visual-baselines.yml` is run. No task updates a baseline.

## Acceptance checklist (copied from the spec)

- [ ] Every extracted swatch shows a marker, and hover links marker and swatch both ways. (spec 3.7 acceptance 1)
- [ ] Dragging a marker updates its swatch color live, and the sampled color matches the pixel patch under the marker. (spec 3.7 acceptance 2)
- [ ] A moved swatch is locked and survives re-extraction; undo restores both position and color. (spec 3.7 acceptance 3)
- [ ] Dragging works with mouse, touch and keyboard. (spec 3.7 acceptance 4)
- [ ] Switching between Image, Palette and Values never re-runs extraction and takes under 100 ms on a cached view. (spec 3.8 acceptance 1; grid is M5)
- [ ] Every pixel in the Palette view (with dither off) equals one palette color, and the area shares add up to 100%. (spec 3.8 acceptance 2)
- [ ] With 5 bands, the Values view shows exactly 5 grays, and pairs closer than the threshold are listed and marked. (spec 3.8 acceptance 3)
- [ ] Image views: every Palette-view pixel equals a palette color and area shares sum to 100%; the 5-band Values view yields exactly 5 grays. (spec 8 unit tests; the grid part is M5)
- [ ] Edit, lock, reorder and adjust swatches, and drag sample points, with full undo. (spec 8, v1 acceptance 3)
- [ ] Switch between the Image, Palette and Values views without re-extraction. (spec 8, v1 acceptance 4; grid and its export are M5)
- [ ] Undo and redo (50 steps) cover the palette, adjustments and sample points; view state (zoom, selection, open panel, theme) isn't recorded. Reset to extracted, a before/after compare toggle, and re-extraction that preserves locked swatches. (spec 3.6; gradients are M4)
- [ ] Adjustments apply to unlocked swatches and are stored as parameters on top of the extracted base, so they are non-destructive and resettable. (spec 3.3, subject to Q1)
- [ ] Contrast matrix with WCAG 2.x ratios and AA/AAA badges; CVD simulation (protanopia, deuteranopia, tritanopia, achromatopsia) applied to the palette; warnings when two swatches are closer than the merge threshold; gamut indicator for sRGB. (spec 3.5; gradients in M4, APCA per Q6)
- [ ] Ramps (for example 11 steps, 50 to 950) and harmonies (complementary, split-complementary, triadic, tetradic, analogous). (spec 3.4)
- [ ] Per-swatch actions: edit in HEX, RGB, HSL and OKLCH with an out-of-gamut indicator; eyedropper; lock, duplicate, delete, add, drag to reorder, copy value, rename with a suggested CSS name; generate a ramp. (spec 3.2)
- [ ] Color conversions against reference values. (spec 8; new for HEX, RGB, HSL and OKLCH formatting, gamut and CVD)
- [ ] Touch targets: every control at least 44 × 44 px, and each marker has a 44 px hit area. (spec 6.1)
- [ ] Gestures: one finger on a marker drags it, one finger elsewhere pans, two fingers pinch-zoom; `touch-action: none` on markers; pointer events with pointer capture; `pointercancel` handled. (spec 6.1; page scroll at Fit per M2 15h)
- [ ] No hover: tapping a marker or a swatch selects both, and the cluster map is a toggle in the swatch sheet. (spec 6.1)
- [ ] Text input: 16 px type, `inputmode='decimal'`, and the HEX field turns off autocorrect and autocapitalize. Sliders have large thumbs and number steppers. Undo and Redo are visible buttons. (spec 6.1)
- [ ] Callouts are off on markers and canvases. (spec 6.1)
- [ ] On phones, the swatch editor, adjustments and ramps open as bottom sheets. (spec 6.1)
- [ ] Live updates during drags run once per animation frame. (spec 6.1, 3.7)
- [ ] Keyboard: Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z, arrow keys to reorder swatches, E for eyedropper, C to copy the selected swatch; single-letter shortcuts are off in text fields. (spec 6; R and ? in M6)
- [ ] Phone 1: every feature is reachable at 320 px without horizontal scrolling. (spec 8)
- [ ] Phone 2: all controls are at least 44 × 44 px, and nothing depends on hover. (spec 8)
- [ ] Phone 3: dragging a marker on iPhone moves only the marker: no page scroll, zoom or share callout. (spec 8)
- [ ] Phone 4: text fields don't trigger Safari's focus zoom. (spec 8)
- [ ] Theme 3: swatch, image and gradient colors are identical in both themes. (spec 6.2; adds marker fills, views, matrix cells, CVD strips, ramp tiles and the loupe)
- [ ] Theme 4: all text and controls meet AA contrast in both themes, and markers are visible on very light and very dark images. (spec 6.2)
- [ ] Motion never applies to color values. (spec 6.4)
- [ ] Messages are plain sentences with at most one action, heard through a live region. (spec 6.3; the 12-color note, close pairs and the marker HEX announcement)
- [ ] Views and marker sampling run in the worker from the working master; the UI thread never loops over image pixels. (spec 3.8, 3.7, 7.4)
- [ ] Keyboard-operable with visible focus and sufficient UI contrast. (spec 8, v1 acceptance 10)
- [ ] Token conformance passes on every new and changed screen, desktop and phone, both themes. (`visual-testing.md` 1)
- [ ] The review page includes the new shots; baselines change only through `visual-baselines.yml` after sign-off. (`visual-testing.md` 2, 3)
- [ ] `?demo=mockup` shows the markers, the views and the fixture values, and never touches localStorage or IndexedDB. (`mockup-state.md`, spec 5.5)

## Manual checks for a person

- [ ] Real iPhone:
  - at Fit and zoomed, a marker drag moves only the marker: no page scroll, zoom or callout
  - the loupe sits above the finger
  - a second finger mid-drag cancels the drag and pinches
  - the strip's press-to-reorder doesn't fight scrolling
  - sheets clear the home indicator
  - HEX doesn't autocorrect and no field zooms on focus
  - the eyedropper works
- [ ] Older iPhone: drag smoothness with a 12 MP photo; the views compute without the tab reloading.
- [ ] Android with Chrome: marker drag, eyedropper, sheets, reorder.
- [ ] Desktop Safari and Firefox, and a pen if available: marker drag and the loupe.
- [ ] Judge the adjustments, ramps and harmonies on real photos. There are no reference values for "looks right".
- [ ] Compare the CVD strips with an external simulator, such as Chrome DevTools "Emulate vision deficiencies", for a few colors.
- [ ] Compare a few contrast-matrix ratios with an external WCAG checker.
- [ ] Markers on a nearly white and a nearly black photo, in both themes.
- [ ] Time a cached view switch (under 100 ms) and drag frame rate on a mid-range phone.
- [ ] Open `artifacts/visual-review/index.html`, compare it with the mockups and the contract, and sign off or list changes.
- [ ] Design review of the not-drawn items in the table above.
- [ ] After sign-off, run `visual-baselines.yml` on milestone/M3 and check the committed baselines.

## Parallel execution

### Dependency graph

```
T1 ─► T2 ─┬─► T3  (editor)
          ├─► T4  (swatch row) ───────────────┐
          ├─► T5  (strip actions)             │
          ├─► T6  (adjustments)               │
          ├─► T7  (ramps, harmonies)          │
          ├─► T8  (contrast, close pairs)     │
          ├─► T9  (CVD)                       │
          ├─► T10 (marker engine) ─┬─► T12 (markers UI, loupe) ─┬─► T15 (marker drag)
          │                        └─► T13 (locked re-extract) ◄┘   └─► T16 (eyedropper)
          └─► T11 (views engine) ────► T14 (views UI)
All ─► T17 (integration)
```

Dependencies that the graph's lines don't show:
- T13 also needs T4, because Place on image and reset sit in `SwatchDetails.tsx`.
- T16 also needs T5, for the "+" tile's "Pick from image".
- T15 and T16 need only T12, not each other.

### Waves

| Wave | Tasks | Runs as | Start when |
| --- | --- | --- | --- |
| 0 | T1, then T2 | one worktree, serial | M2 is merged to main and milestone/M3 is branched |
| 1a | T10, T11, T3, T4, T5 | 5 worktrees | T2 is merged. The engines go first because they gate wave 2 |
| 1b | T6, T7, T8, T9 | 4 worktrees | any wave 1a slot frees up. They have no dependents except T17 |
| 2 | T12 (after T10), T14 (after T11), T13 (after T10 and T4) | 3 worktrees | each starts as soon as its dependencies are merged, even while 1b is running |
| 3 | T15, T16 (after T12; T16 also after T5) | 2 worktrees | T12 is merged |
| 4 | T17 | one worktree | everything is merged |

Run at most about 5 worktrees at once, because the e2e suites use 5 browser projects each.

### Shared files that cause merge conflicts, per wave

- **Wave 0:** none, because it runs serially. T1 and T2 deliberately take every shared file:
  - `src/types.ts`, `src/state/signals.ts`, `src/state/defaults.ts`, `src/palette/model.ts`, `src/state/history.ts`
  - `src/ui/PalettePanel.tsx`, `src/ui/ImageWell.tsx`, `src/ui/Header.tsx`
  - `src/extract/messages.ts`, `worker.ts`, `client.ts`
  - `src/state/mockup.ts`, `e2e/helpers/screens.ts`, `e2e/visual/shots.ts`, `e2e/coming-soon.spec.ts`
  - `docs/design/mockup-state.md`, `docs/design/visual-testing.md`
  - the section headers in `src/styles/app.css`
- **Wave 1:**
  - `src/styles/app.css`: every UI task. Each edits only its own labelled section, so git sees separate hunks. Don't reformat the file.
  - `src/extract/worker.ts`: T10 (points in `extracted`) and T11 (the cache around the `view` handler). Keep handler bodies in `markers.ts`, `sample.ts` and `views.ts`; expect at most a small conflict in the `extracted` reply. Merge T10 first.
  - `src/state/extraction.ts`: T10 only in this wave. T1 has already touched it.
  - `src/export/format.ts`: T4 only.
  - `src/ui/SwatchStrip.tsx`: T5 only. Hover linking came in T2; brackets go in `StripMarks.tsx` in T14, and close-pair marks in `ClosePairsMark.tsx` in T8.
  - `src/ui/SwatchEditor.tsx`: T3 only. T7 edits `RampPanel.tsx`, which T2 already wired to the Ramp pill.
  - `src/ui/StripMarks.tsx`: T8 adds `ClosePairsMark` in wave 1 and T14 the bracket in wave 2, so they are in different waves.
  - Tests: no task edits `e2e/mockup-state.spec.ts`, `tokens.spec.ts`, `a11y.spec.ts`, `tools/make-fixtures.ts` or `tests/extract/client.test.ts`. New fixtures are generated at runtime in a task-owned helper, such as `e2e/helpers/close-pair.ts`, and client tests go in task-named files.
- **Wave 2:**
  - `src/ui/SourcePanel.tsx`: T12 adds the hint; T14 wires the view bar and swaps the rows. Merge T12 first; it's a small, mechanical conflict.
  - `src/ui/SwatchDetails.tsx`: T13 only, since T4 is already merged.
  - `src/state/extraction.ts`: T13 only.
  - `app.css`: the per-task sections.
- **Wave 3:**
  - `src/ui/WellTools.tsx`: T16 adds the Eyedropper button next to T12's Markers toggle.
  - `src/ui/MarkerLayer.tsx`: T15 only.
  - `Loupe.tsx`: both read it; neither edits it.
  - `app.css`: the per-task sections.

### How the tasks are cut to keep files apart

- Everything parallel tasks share is created in T1 and T2:
  - types and signals
  - the palette operations and the history store
  - `gamut.ts`
  - the ChevronRow, BottomSheet and Slider shells
  - stub components, one file per feature
  - image-well slots and pointer routing
  - reserved worker messages
  - mockup parameters and the screen and shot registries
  - design-doc entries
- Engines (pure modules plus a worker handler) are split from their UI (T10 and T12; T11 and T14), so engines run in wave 1 and the UI in wave 2.
- Each feature owns one component file and one `app.css` section. Cross-feature touch points are signals: `hoveredSwatchId`, `markersVisible`, `eyedropperMode`, `viewSettings` and `compareBefore`. Components never import each other's internals.
- The coming-soon test is driven by the `data-coming-soon` attribute, so removing a stub never edits a shared spec.

### Running the waves

- Each wave task gets its own git worktree on a branch `milestone/M3-T<n>` off the current milestone/M3, and its own `npm ci`.
- Each worktree runs e2e with its own port: `E2E_PORT=4173 + n`, such as `E2E_PORT=4183 npm run e2e` for T10. `playwright.config.ts` already reads it.
- `artifacts/` is per worktree and gitignored. Run `visual:review` only in T17.
- Merge into milestone/M3 in task-id order within a wave. Rebase the next branch, rerun lint, typecheck, unit tests and that task's e2e specs, then merge. Run the full e2e suite after each wave.
- One commit per task, with a message starting `M3-T<n>:`.

## Risks

- **Scope.** 17 tasks, the largest milestone so far (Q8).
- **M2 isn't finished.** T2's slots depend on M2's final `ImageWell.tsx`, `imageView`, `ClusterOverlay` and the `assign` request. If M2 changes them, adapt T2 before starting wave 1.
- **The `outputPalette` split (T1).** It touches every reader of displayed colors. A missed reader shows unadjusted colors; T17 greps for it.
- **Undo and live extraction.** Undo while a re-extraction is pending must cancel that job (the stale-job drop already exists), or the result lands over the restored state.
- **Marker placement.** It relies on exact ties at density 1.0 (integer box sums) to land on the fixture patches. A float blur would make the mockup-scene test flaky.
- **Drag sampling round trips.** Each animation frame sends one round trip to the worker. With the main-thread fallback, the master lives on the main thread; the crop is small, but check drag smoothness on an older iPhone.
- **Touch-action.** The marker has `touch-action: none` inside a well that is `pan-x pan-y` at Fit (M2 15h). Browsers intersect touch-action down the ancestor chain, so a drag that starts on a marker shouldn't scroll. Confirm it on a real iPhone; WebKit pinch can't be automated.
- **Palette view with dither.** At 2048 px display size, the first compute may take a few hundred ms. Acceptance 1 applies to cached views; the first compute shows the 300 ms progress rule.
- **Bundle size.** Many new panels and the CSS-name table. Stay within 150 kB gzip; if needed, lazy-load the Contrast, CVD and Ramp panels.
- **Parallel merges.** Conflicts concentrate in `app.css`, `worker.ts` and `SourcePanel.tsx`. Merge in the stated order.
- **Visual CI.** Changed review shots, including M2's zoom and cluster-map shots, fail the `visual` job until sign-off and the baseline workflow run. This is expected.
- **Q1 and Q2 run through many tests.** Their answers change expected results in T3, T6, T13 and T15. Settle them before wave 1.

## Defaults (Q7)

The plan uses these values where the spec gives none. Q7 asks for one approval of all of them.

- D1. Adjustment ranges (defaults in brackets):
  - Lightness −0.5 to 0.5 (0)
  - Chroma 0 to 200% (100%)
  - Hue −180° to 180° (0)
  - Contrast 50 to 200% (100%), as L' = 0.5 + (L − 0.5) × k
  - Temperature and Tint −0.1 to 0.1 (0), added to OKLab b and a
  - Gamma 0.5 to 2 (1), as L' = L^γ
  - Lightness range: min 0 to max 1, clamped
  - Even out: off
  - Harmonize: anchor 0 to 360°, amount 0 to 100% (0), along the shorter arc
  - Gamut: Off, with the indicator shown
- D2. Adjustments apply in table order, with Gamut last. Compare is view state and shows base colors.
- D3. Gamut clamp is a binary search on OKLCH C (to 1e-4) that keeps L and H.
- D4. Ramp:
  - L = 0.97 − 0.72 × i / 10 for i = 0 to 10 (steps 50, 100, 200, …, 900, 950)
  - C = source C × (0.3 + 0.7 × (1 − (2t − 1)²)), with t = i / 10
  - H is the source's
  - clamped to gamut
  - the step nearest the source's L is the source itself
- D5. Harmonies in OKLCH hue, keeping L and C, clamped to gamut:
  - complementary +180°
  - split-complementary ±150°
  - triadic ±120°
  - tetradic +90°, +180°, +270°
  - analogous ±30°
- D6. CVD uses Machado 2009 at severity 1 in linear sRGB, clipped; achromatopsia uses the Rec. 709 luminance gray. The row shows Normal plus one strip per type.
- D7. Contrast badges: AAA at 7 or more, AA at 4.5 or more, "AA large" at 3 or more, otherwise "Fail". Ratios have 2 decimals.
- D8. Patch sampling uses the mean in OKLab by default. Median is a per-swatch option in the Swatch row. Radius is per swatch: Auto, 1, 3, 5 or 11 px.
- D9. Markers:
  - Keyboard nudges move in working-master pixels.
  - Accessible name: "Swatch 3 marker, 77%, 17%".
  - After a move, the new HEX is announced.
  - Labels fan out when rings are within 44 px on screen.
- D10. Touch:
  - A second finger during a marker drag cancels the drag and pinches.
  - On touch, strip reorder starts after a 300 ms press; with a mouse, after 4 px of movement.
- D11. Swatches added or retargeted by the eyedropper are picked and locked, like a drag.
- D12. Duplicate and "Type a color" make manual, unlocked swatches with no point.
- D13. Reset to extracted shows ΔE in the current distance metric, such as "ΔE OK 0.042" or "ΔE00 3.1".
- D14. Copy uses the selected format in CSS Color 4 syntax: `#E8693A`, `rgb(232 105 58)`, `hsl(16 79% 57%)`, `oklch(L C H)` with 3, 3 and 1 decimals.
- D15. The name suggestion is the nearest CSS named color in OKLab (7.6), shown as a chip under the Name field.
- D16. Undo steps: one per slider drag (on release), per committed text entry (Enter or blur), per toggle or button, and per marker drag or nudge.
- D17. Shortcuts in M3:
  - Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z
  - arrow keys on a focused swatch reorder it
  - E toggles the eyedropper
  - C copies the selected swatch's HEX
  - R and ? stay in M6.
- D18. Palette view:
  - "Colors from" shows Palette, with Matched paints disabled and the note "Needs paint matching".
  - Dither is Floyd–Steinberg, left to right, with error in OKLab.
  - The view uses the adjusted palette, or the base palette while Compare is on.
- D19. Values view: Bands are continuous, 3 or 5 (default 5). The Close in value row expands to the threshold slider (0.01 to 0.10, default 0.03).
- D20. New demo parameters `rows=swatch|adjustments|ramp|contrast|cvd` (on phones they open the sheet) and `loupe=<1 to 6>`, plus the shots in "Screens affected".
- D21. On desktop, hovering a swatch still shows the cluster map (M2). The Swatch row also has the Cluster map toggle, so desktop and phone hold the same controls (6.6 rule 6).

## Decisions (provisional)

The user left before these questions could be put to them. Their instruction on 2026-11-18 was: "LETS COLLECT AND ANSWER AS MUCH AS POSSIBLE NOW. OTHERWISE USE PROPOSED". So every question below takes its **(proposed)** option. All of them are **provisional and unconfirmed**: the user reviews them on return, and a change may mean rework.

- 1a. A: locked swatches are never adjusted (spec 3.3 wins over 3.7). **This settles a spec contradiction and must be flagged to the user.**
- 1b. A: an edit in the color editor sets the swatch to exactly that color and locks it.
- 2a. A: re-extraction keeps the total at Colors; for each locked swatch, the nearest new color is dropped.
- 2b. A: locked swatches keep their positions.
- 2c. A: unlocked manual swatches are replaced like extracted ones.
- 3a. A: a settings change and the palette it produces are one undo step; undo restores both without re-extracting.
- 3b. A: loading a new image clears history.
- 4a. A: 12 swatches at most everywhere; adding is disabled at 12, with a note.
- 4b. A: a ramp is a preview of 11 steps, and any step can be added to the palette.
- 5a. A: a "Swatch" chevron row above Adjustments; it expands in place on desktop and opens as the swatch sheet on phones.
- 5b. A "+" tile at the end of the strip. Decision 40 removed its menu: one press adds a color at once.
- 5c. A: Eyedropper and Markers icon buttons in the image corner; the eyedropper always adds (decision 38 removed the "Replace swatch N" chip and Replace mode).
- 6a. A: no APCA in M3.
- 6b. A: the preview surround setting goes to M4.
- 6c. A: the matrix is swatch × swatch only, with close pairs listed in the same row.
- 7. A: defaults D1 to D21 are accepted.
- 8. A: one milestone of 17 tasks, run in parallel waves.

Confirmed by the user earlier in M2, and applying here: a "Used by" or "Not used by" note shows only while its control is disabled (M2 decision 14b). The plan builds on M2's decisions (no region of interest, zoom and pan in M2 with page scroll at Fit, the cluster-map toggle moving into the swatch sheet).


Decisions made by the user on 2026-11-20, after the M3 evaluation (24 replaces provisional 1a and 1b):
- 24. Two flags: pin and lock. Edits (editor, Swatch row fields), marker drags and eyedropper picks pin a swatch: kept on re-extraction but still adjusted (spec 3.7). The Lock button locks it: kept and not adjusted (spec 3.3). A pin badge shows on the strip tile and a "Pinned" button (which unpins) in the editor row. The editor shows and edits the base color, with a muted "After adjustments #HEX" line when the displayed color differs. "Reset to extracted" clears both. `mergeLocked` is now `mergeKept`.
- 25. Unlocked, unpinned manual swatches are replaced on re-extraction (as built, 2c). Pinned ones are kept.
- 26. The zoom controls move to the image well's top-right corner; markers can rise above them when selected. Marker 5 of the fixture must be fully visible at Fit at 320, 390 and 1280 px.
- 27. The loupe sits beside the finger on phones when there is no room above (as built; the evaluator's V7).
- 28. Column 2 keeps four rows: Swatch, Adjustments, Contrast, CVD (as built). This is an intended deviation from the mockup's "Contrast and CVD" (V2).
- 29. The "+" tile shares the swatches' row; swatches shrink to make room and wrap only when 44 px no longer fits (up to 12), so the Values bracket sits under its swatches.
- 30. The Palette and Values views use the user's alpha cutoff (spec 2.4), not a fixed 128 (worker `view` request and cache key).
- 31. "Place on image" is enabled in `?demo=mockup` (still no storage access). Changing a swatch's sample radius or statistic resamples it at once through the worker `sample`, as one undo step.

- 38. The eyedropper always adds a new swatch (picked, pinned, with its point, one undo step); Replace mode and the "Replace swatch N" chip are gone, and dragging a marker still updates a swatch (T15). At 12 swatches the Eyedropper button is aria-disabled with the note "A palette holds at most 12 colors." (which also replaces the marker hint), the "+" tile is disabled, and the E key does nothing; picking the 12th color turns the eyedropper off. The selected swatch shows a small X (a chip behind it, tokens only) at its top-right corner, named "Remove swatch N": it removes the swatch as one undo step and selects the neighbour, as T4's Delete did (an empty palette is allowed, so the X shows with one swatch left). Its hit area is `--hit` square (44 px on phones), reaching 12 px past the swatch's top and right edges so it covers little of the swatch and leaves a reorder press possible on the rest; it follows the swatch in DOM order, so Tab reaches it. Delete or Backspace on a focused swatch also removes it, never in a text field. The X shows in the strip on every tab (Source and Palette); decision 32's hiding of "+" on the phone Source tab does not apply to it. (Decision 39 removed the Swatch row's Delete button.)

- 39. In the Swatch row and sheet, Copy is an icon button directly beside the color code (the HEX field; for RGB, HSL and OKLCH, beside the first channel field), named "Copy <format> value", copying the current format's output color as before, with the same toast; it is `--hit` square (44 px on phones). The Duplicate and Delete buttons are gone. Removing a swatch is the strip's X (decision 38) or Delete or Backspace on a focused swatch. Duplicate stays available by the D shortcut (registered in `main.tsx` through `src/ui/shortcuts.ts`): with a swatch selected it inserts a copy after it (copying its population, decision 3f), selects the copy, and is one undo step ("Duplicate"); it is off in a text field; at 12 it only announces the limit note (toast, live region). This departs from spec 3.2's per-swatch actions list ("duplicate") by the user's decision: the capability is kept, by shortcut, with no visible button.

- 40. The "+" tile is one button named "Add color", with no menu and no prompt. With an image (including the demo fixture) the worker finds the next most distinct color: the page asks it for an extraction at 12 Colors with the current settings, takes the result farthest (current metric) from every swatch, only if it is beyond the merge threshold, and asks `place` for its marker; the UI thread only compares at most 12 colors. With no image, or when the image offers nothing more distinct (or the worker fails), it adds the selected swatch's color (else the last one's) with its hue rotated 30 degrees in OKLCH, gamut-mapped to sRGB, with no marker. The new swatch is manual, neither pinned nor locked, goes at the end, is selected (the HEX field is no longer focused), and is one undo step, "Add color". At 12 the tile is disabled and the live note reads "A palette holds at most 12 colors." Capabilities kept reachable: picking a specific color from the image is the Eyedropper button in the well (decision 38); typing a color is the editor's HEX field, or any field, on the new swatch. `startEyedropper` and the menu code and styles were removed. Where the no-image rotation is tested: unit tests only (the tile needs a palette, which exists only with an image or in the demo).

- 41. (Orchestrator decision, 2026-11-20, the user being away.) The zoom controls are always operable. The top-right zoom pill and the bottom-left well tools sit above every marker (z-index 2; selected, focused and linked markers are at 1), except a marker being dragged (z-index 4), which may rise above them. This replaces the part of decision 26 that let a selected marker rise above the pill; its other part stands (marker 5 fully visible at Fit). A marker under the pill stays reachable by selecting its swatch, by Tab, and by zooming or panning. The two phone zoom tests no longer select swatch 1 first. A plain wheel over the well scrolls column 1's `.column__scroll` (decision 37), and Ctrl + wheel zooms.
- 42. (Orchestrator decision, 2026-11-20, the user being away; supersedes the placement in 26 and decision 41.) The image well's controls never cover image content. A slim toolbar row sits directly under the image well, inside the same card or column, above the view bar: Markers and Eyedropper on the left, Zoom out, Fit and Zoom in on the right. The top-right pill (26), the bottom-left well tools and decision 41's z-index layering are removed, so markers can be on top again; nothing overlays them. Each control keeps its behavior, accessible name, `aria-pressed` and `aria-disabled`, the E shortcut, the tab order (well, markers, toolbar), 44 px touch targets (`--hit` on desktop) and tokens only. The toolbar shows only in the Image view; in the Palette and Values views the zoom controls stay and Markers and Eyedropper hide. On phones it scrolls with the Source tab and fits at 320 px with no horizontal scroll. The eyedropper hint row stays below the toolbar. Recorded as ui-contract D7. Marker 5's visibility at Fit (26) stands, and every demo marker is hit-testable at Fit.
- 43. (Orchestrator decision, 2026-11-20, the user being away.) Full-suite fixes after decision 42 change tests only, never assertions' intent: the zoom level readout now lives in the toolbar, so mockup-state finds it on the page rather than inside the well; the toolbar's right edge is compared with the well's outer (border) edge; the presets tests open Filters and Advanced through `openRow`, which uses the drawer below 1024 px (decision 34). One webkit run of the 320 px Filters 44 px check read 43.9999 px (sub-pixel rounding); it passed on rerun and is reported as flaky, not changed.
- 44. (User request, 2026-11-20.) Below 1024 px each tab keeps its own scroll position. The window stays the scroll container, so the sticky strip-docks (M2 19, M3 33), `scroll-padding` and focus clearance (F8, F9) keep working. The Shell saves the outgoing tab's `scrollY` while rendering, before the DOM changes, and restores the incoming tab's in a layout effect (before paint), retrying for up to 30 frames while the panel fills in, until the page reaches the position or the user scrolls. A tab not visited yet starts at 0. A drawer lives inside its tab's panel, so it never leaks to another tab. Tests: `e2e/tab-scroll.spec.ts`. Not a new deviation.
- 45. (User request, 2026-11-20.) From 1024 px, column 2's swatch strip (with its marks: the "+" tile, the close-pair mark and the Values bracket) pins at the top of column 2's own `.column__scroll`: the same `.strip-dock` as on phones, `position: sticky`, opaque `--color-surface`, with a `--color-border` divider while pinned (D4's idea extended to desktop). The selection label and the editor scroll under it. Its height is written to `--strip-dock-height` on that scroll container, whose `scroll-padding-top` uses it; Firefox and WebKit ignore scroll-padding for focus scrolling, so `focusClearance.ts` nudges the column too. Columns 1 and 3 are unchanged. Tests: `e2e/palette-strip-pinned.spec.ts`. Not a new deviation.
- 46. (User request, 2026-11-20.) While a bottom-sheet drawer is open below 1024 px, the sheet's content is the only scroller. `sheetDock.ts` scrolls the page to pin the dock (35), then adds `sheet-locked` to the root: `overflow: hidden` with `scrollbar-gutter: stable`, below 1024 px only. A non-passive `touchmove` listener cancels touches outside the sheet's scroll area (iOS ignores `overflow: hidden` on the page), and the scroll area already has `overscroll-behavior: contain`. Closing removes the lock and puts the page back where it was when the drawer opened (also round-2 note 5; the opener takes focus with `preventScroll`). Unmounting the sheet always unlocks, so a tab switch can't leave the page locked. Desktop is unaffected. Tests: `e2e/sheet-scroll-lock.spec.ts` (mobile WebKit has no mouse wheel and no `Touch` constructor, so those cases run on Chromium).
- 47. (Orchestrator decision, 2026-11-20, the user being away by their instruction; round-2 failure 1.) The Swatch row's format fields (HEX, RGB, HSL, OKLCH) show and edit the swatch's BASE color, as the color editor does. A commit sets that exact base and pins the swatch (24). When adjustments change the swatch, a muted "After adjustments #HEX" line sits under the fields, with its own copy icon ("Copy adjusted HEX") that copies the output color. The copy icon beside the fields copies exactly the value shown. Tests: `e2e/swatch-base-edit.spec.ts`.
- 48. (Orchestrator decision, 2026-11-20, the user being away by their instruction; round-2 re-evaluation.) Visual and touch fixes. (a) The strip's column count doesn't count the "+" cell when it isn't shown, so the Source tab's 6 swatches fill one row at 320 px. (b) The zoom controls stay on the right of the image toolbar in every view (`margin-left: auto`), ordered Zoom out, Fit, Zoom in. (c) The pin and lock badge sits at the swatch's bottom-left, so the selected swatch's top-right X never covers it. (d) Duplicate on touch: the Swatch drawer's title bar (below 1024 px) gets a 44 px icon button "Duplicate swatch" beside Close. It behaves like the D shortcut; desktop keeps D only, and the rows stay free of Duplicate and Delete (39). (e) Focus after Unpin goes to the Lock button; after removing the last swatch it goes to the selected tab button (phones) or the first control. Tests: `e2e/round2-fixes.spec.ts`, `e2e/zoom.spec.ts`.
- 49. (Orchestrator decision, 2026-11-20, the user being away by their instruction; supersedes 40's disabled tile at 12.) At 12 swatches the "+" tile is hidden, not disabled. "A palette holds at most 12 colors." still shows in the live note under the strip. When the add that reaches 12 removes the tile, focus moves to the new, selected swatch.
- 50. (User request via the orchestrator, 2026-11-20; extends 39.) The always-visible color code is the editor's HEX field, so it gets the copy icon too: "Copy swatch HEX" (renamed so screen readers can tell it from the palette-wide "Copy HEX" button), immediately beside the field in a no-wrap group, on desktop column 2 and the phone Palette tab. It copies the base color the field shows, with the same toast as the other copy actions; 44 px on touch, `--hit` on desktop. The Swatch row's icon stays (it copies the chosen format). The editor's "After adjustments #HEX" line has a "Copy adjusted HEX" icon like the row's (47). Tests: `e2e/round2-fixes.spec.ts`; the adjustments test's HEX locator is now exact, since "Copy HEX" also contains "HEX".
- 51. (User request via the orchestrator, 2026-11-20; ui-contract D8.) The close-in-value bracket is removed. Every swatch in a flagged pair shows a small warn dot (`--color-warn`, ringed by `--color-surface` and `--color-text` so it shows on any swatch, in both themes) at its tile's top-left corner, and one legend line sits directly under the strip, inside the sticky dock on phones: the dot, then "Close in value" (Values view) or "Very close colors" (Image view, T8). One dot style serves both, because the two conditions never show in the same view (Values vs Image; the Palette view shows none). Very-close dots and legend show only where the "+" tile does (Palette tab, desktop), as the close-pair mark did (32). The dot is decorative (`aria-hidden`, not user content); the swatch's accessible description says "Close in value to swatch N" or "Very close to swatch N". Corners: top-left dot, top-right X, bottom-left pin or lock badge (48). Tests: `e2e/close-dots.spec.ts`, `e2e/image-views.spec.ts`, `e2e/contrast.spec.ts`.
- 52. (User request via the orchestrator, 2026-11-20; departs from spec 3.8 "swatch pairs that are too close in value are listed" and 3.8 acceptance 3 "listed and marked": they are now marked, not listed; likewise spec 3.5's close-pair list.) The dots and the one legend line are the only indication. The Values view's pair chips and text, the "N pairs" button and the Contrast row's "Close pairs" list are removed. The Close in value row keeps its threshold slider (0.01 to 0.10) in place. The live region (F1) announces one general sentence when the set of flagged swatches changes: "Some colors are close in value." or "Some colors are very close." Nothing is announced per pair.

Confirmed by the user on 2026-11-19, from choices M3-T1 made:
- 3c. Undo step labels use the setting's name ("Colors", "Dark threshold"). Applying a preset reads "Preset: <name>"; several settings changed at once read "Settings"; no step is recorded when nothing changed.
- 3d. After undo, if the selected swatch no longer exists, the swatch at the same position is selected.
- 3e. Undo while a re-extraction is pending cancels that job and restores the last committed state.
- 3f. A duplicated swatch copies its source's population.

Layout requests from the user on 2026-11-20 (decisions 32 to 37; built in M3-F6 to M3-F8, ui-contract D5 and D6):
- 32. Below 1024 px, the Source tab's swatch strip shows only the swatches: no "+" tile (nor its 12-color note) and no close-pair mark (T8 `ClosePairsMark`). Both are on the Palette tab. The Values view's own "Close in value" bracket stays on the Source tab. Desktop is unchanged.
- 33. Below 1024 px, the Palette tab's strip (with its marks) is sticky under the header like the Source tab's (M2 decision 19): one shared `StripDock`, an opaque container with a divider when pinned. Focus clearance (F8, F9) already reads the dock, so it covers both tabs.
- 34. Below 1024 px, the Source tab's Filters and Advanced rows open as bottom-sheet drawers with the same `ChevronRow` and `BottomSheet` as the Palette tab. Preset, Algorithm, Colors and Working space stay inline. From 1024 px they stay `<details>`.
- 35. Below 1024 px, on both tabs, an open drawer stops below the pinned strip. `BottomSheet` scrolls the page until the dock is pinned (adding room at the bottom of a short page while the sheet is open), sets `--sheet-top` to the dock's bottom, and the dialog, its scrim and the panel's max height start there. The strip stays visible and updates live; being under a modal, it is not interactive while a sheet is open. Esc, swipe, scrim tap and focus return are unchanged.
- 36. The cluster map is made in the worker at the display copy's resolution, at most 1024 px on the long side (`mapSize`), from the master with "smooth" resampling, using the same filters and keep mask. The overlay draws without `image-rendering: pixelated`. Shares come from this map. Markers still use the analysis-size map (spec 3.7). Where the main thread sends analysis pixels (the fallback without a worker canvas) the analysis-size map is used.
- 37. From 1024 px the page doesn't scroll vertically and each column scrolls on its own (`.column__scroll`, `overflow-y: auto`). The image well scrolls with column 1 (the contract draws it at the top of the column, unpinned). The window's 640 px minimum height (fix L4) is kept for very short windows. Keyboard focus scrolls within the column; focus clearance applies only below 1024 px.

## Open questions (must be answered before approval)

1. **Lock, adjustments and edits.** Spec 3.3 says adjustments apply to unlocked swatches; spec 3.7 says a dragged swatch is locked and that adjustments apply on top of its picked color.
   - a. Which wins?
     - A (proposed): Locked swatches are never adjusted (3.3 wins). A dragged swatch shows its picked color exactly until it is unlocked.
     - B: Adjustments apply to every swatch; lock only means "kept on re-extraction" (3.7 wins).
     - C: Two flags. Lock means kept and not adjusted; pin means kept but still adjusted. A drag pins.
   - b. What does an edit in the color editor (sliders, HEX, format fields) do?
     - A (proposed): It sets the swatch to exactly that color and locks it, like a marker drag. The origin is unchanged.
     - B: It edits the base color, and adjustments still apply on top. The editor shows the base, with a muted "After adjustments #…" line.
2. **Re-extraction with locked swatches.** Spec 3.6 says only that it "preserves locked swatches".
   - a. How many swatches result?
     - A (proposed): The total stays at Colors. For each locked swatch, the nearest new color is dropped. With as many locked swatches as Colors, nothing new is added.
     - B: Colors new colors plus the locked ones, capped at 12.
   - b. Where do the locked swatches go?
     - A (proposed): Locked swatches keep their positions; new colors fill the other slots in sort order.
     - B: Locked swatches go first, then the new ones.
   - c. Unlocked manual swatches (added or typed):
     - A (proposed): They are replaced like extracted ones.
     - B: They are kept, as if locked.
3. **Undo scope.** Spec 3.6 lists the palette, adjustments, sample points and gradients.
   - a. Extraction settings:
     - A (proposed): A settings change and the palette it produces are one step; undo restores both without re-extracting.
     - B: Settings aren't in history, and each re-extracted palette is a palette-only step.
     - C: Neither is undoable.
   - b. Loading a new image:
     - A (proposed): It clears history.
     - B: History is kept, so undo can put the old palette over the new image.
4. **Palette size and ramps.**
   - a. Maximum number of swatches:
     - A (proposed): 12 everywhere (M1 decision 13). Add, Duplicate, the eyedropper's Add, and adding harmony or ramp colors are disabled at 12, with a muted note.
     - B: Edited palettes may hold up to 32, and the strip wraps to more rows. Extraction stays at 2 to 12.
   - b. What "generate a ramp" produces (spec 3.4):
     - A (proposed): A preview of 11 steps. Any step can be added to the palette, as with harmonies; the ramp itself isn't stored.
     - B: A "Use as palette" action replaces the palette with the ramp (undoable).
     - C: The ramp is stored on the swatch for M5's Tailwind-style export.
5. **Where the not-drawn editor pieces go** (spec 6.6, 6.1; contract "Not drawn").
   - a. The rest of the swatch editor: RGB, HSL and OKLCH fields, name, copy, duplicate, delete, reset, sample radius, Place on image, and the cluster-map toggle.
     - A (proposed): A "Swatch" chevron row above Adjustments. It expands in place on desktop and is the swatch sheet on phones.
     - B: No new row. Tapping the selected swatch again opens a popover on desktop and the swatch sheet on phones.
   - b. Add swatch:
     - A (proposed): A "+" tile at the end of the strip, with "Pick from image" and "Type a color".
     - B: An Add button inside the Swatch row.
   - c. Eyedropper and marker visibility:
     - A (proposed): Two icon buttons in the image well's corner beside the zoom controls: Eyedropper and Markers. The eyedropper adds a swatch by default; a "Replace swatch N" chip in the hint row switches it to retargeting the selected swatch.
     - B: The same buttons, but the eyedropper always retargets the selected swatch. Adding goes only through the "+" tile's "Pick from image".
6. **Contrast and surround.**
   - a. APCA ("optional extra" in 3.5):
     - A (proposed): Not in M3; it moves to Later.
     - B: APCA Lc as a second value in each matrix cell, behind a toggle.
   - b. The preview surround setting (6.2: Match theme, Mid-gray, White, Black), which has no roadmap row:
     - A (proposed): In M4, with the gradient preview.
     - B: In M3, applied to the image well, the strip and the views.
   - c. Matrix content. Spec 6.2 says the contrast matrix uses the preview background, never the UI theme.
     - A (proposed): Swatch × swatch only. Each cell is drawn as the column color's text on the row color, with no theme colors. Close-pair warnings are listed in the same row.
     - B: Also add White and Black rows and columns.
7. **Defaults D1 to D21** (section "Defaults (Q7)").
   - A (proposed): Accept them all.
   - B: Change some (say which).
8. **Milestone size.**
   - A (proposed): One milestone of 17 tasks, run in the parallel waves above.
   - B: Split it. M3 covers T1 to T5 and T10 to T17 (editing, undo, markers, views); M3b covers T6 to T9 (adjustments, ramps and harmonies, contrast, CVD).
- 53. (User request via the orchestrator, 2026-11-20; ui-contract D9; extends 19, 33, 35, 46.) Below 1024 px the palette-wide Copy HEX and Copy CSS leave the ends of the Source and Palette columns. The Source tab has none. The Palette tab gets a compact "Export" button (icon plus label, accessible name "Export palette", 44 px) in the pinned strip dock, right-aligned on the legend line (alone on it when no legend shows). It opens a bottom-sheet drawer titled "Export palette", below the dock and with the page locked, holding Copy HEX and Copy CSS with their existing behavior and toasts; it is the export home for M5's formats. Focus returns to the button on close. Desktop's "Palette export" bar is unchanged. Names stay distinct: palette-wide "Copy HEX" and "Copy CSS" versus the per-swatch "Copy swatch HEX", "Copy <format> value" and "Copy adjusted HEX". Tests: `e2e/phone-export.spec.ts`, `e2e/copy.spec.ts`.
- M3-F20 (final evaluation failure 1; refines 46). The drawer lock cancels `touchmove` only outside the open sheet's panel (strip, page header, scrim, page). Inside it nothing is cancelled, except one iOS case: a vertical move the sheet body cannot scroll that way, unless it starts in `.contrast-scroll` or on a range input. `overscroll-behavior: contain` is on the body and on `.contrast-scroll`. Tests: `e2e/sheet-touch.spec.ts` (CDP touch, phone-chromium). Final-evaluation cleanups: the close-flags live sentence now names the flagged swatches ("Some colors are close in value: swatches 1 and 2."), so it is re-announced when the set changes within one kind (note 2; this refines the wording in 52); unit tests for `closeFlags.ts` (note 3, `tests/ui/close-flags.test.ts`); the Swatch row's adjusted-color icon is "Copy adjusted HEX value" (note 4); every bottom sheet opens with focus on Close, so Enter cannot duplicate (focus still returns to the opener); stale wording in `ui-contract.md` and the `sheetDock.ts` citation (note 5).
- 54. (User request via the orchestrator, 2026-11-20; M3-F21.) The footer is much thinner: one row everywhere, no vertical padding, `--text-xs`, the divider above. From 1024 px its height is `--hit` plus the divider (the links' hit area sets it); below 1024 px it is exactly one row, "Images stay in your browser" on the left (ellipsis if short of room, full sentence as `title`), "MIT License" and "GitHub" on the right with 44 px touch targets, so the footer is at most 44 px plus the divider. Tests: `e2e/footer.spec.ts`. ui-contract.md has a note.
- 55. (User request via the orchestrator, 2026-11-20; M3-F22; supersedes the editor's "Pinned" pill from decision 24.) One Lock toggle replaces the Lock button plus the separate Pinned (unpin) button. Pinning stays automatic (edits, marker drags, eyedropper picks and resamples), and the pin badge on the strip tile still shows it. Not locked, pinned or free: the button reads "Lock" (`aria-pressed=false`) and locks the swatch. Locked: it reads "Unlock" (`aria-pressed=true`) and clears both the lock and the pin (`unlockSwatch` in `model.ts`), so re-extraction can replace the swatch. Each press is one undo step ("Lock", "Unlock") and focus stays on the toggle, so the Unpin focus fix and its test are gone. "Reset to extracted" still clears both. Tests: `tests/palette/model.test.ts`, `e2e/editor.spec.ts`, `e2e/reextract.spec.ts`.
- 56. (User request via the orchestrator, 2026-11-20; M3-F23; ui-contract D10; supersedes 53's dock button and the desktop "Palette export" and "Gradient export" bar.) One central Export in the header replaces Share: a text button on desktop, a 44 px icon (accessible name "Export") below 1024 px. It opens a panel titled "Export": from 1024 px a right-side drawer under the header that overlays column 3 without moving the columns (a modal dialog, so focus is trapped, Esc and the close button close it, focus returns to the Export button); below 1024 px the existing `BottomSheet` (decisions 35 and 46 apply). Sections as a keyboard-operable tab control: Palette (Copy HEX, Copy CSS, their toasts, a muted line that more formats come in M5), Gradient (coming soon, M4 and M5), Image (coming soon: the image, Palette view or Values view, with or without the grid, as PNG or PDF), Project (Project file and Share link, both coming soon; the share link is spec 5.1's palette-export format, now an item here). Context default: Palette from the Palette tab or desktop column 2 focus; Image when opened from the Source tab (or column 1) with the Palette or Values view showing; otherwise the last section used (a signal, `src/state/export-panel.ts`, not storage). The bottom bar and the phone dock button (and its sheet) are removed, so desktop columns reach the footer. The page behind a modal dialog is inert, so the toast lives inside the panel while it is open (the Download action must stay reachable). Per-swatch copy icons are unchanged. For M5: the grid's "Export grid" button (spec 3.8) is a shortcut that calls `openExport("image")` with the grid preselected; nothing is wired now. Tests: `e2e/export-panel.spec.ts` (replaces `e2e/phone-export.spec.ts`), `e2e/copy.spec.ts`, `e2e/layout.spec.ts`, `e2e/footer.spec.ts`, `e2e/coming-soon.spec.ts`, a11y and tokens.
