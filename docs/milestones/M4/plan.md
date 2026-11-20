# M4 plan: Gradients

Status: approved by the user (2026-11-20). The user answered Q1 to Q5 on 2026-11-20; see "Decisions".
Spec sections: 3.5 (CVD on gradients), 3.6 (history covers gradients), 3.7 (live preview during marker drags; Image sample from markers), 4.1 to 4.5, 5.2 (only the hooks M5 needs), 6 (column 3 and the Gradient tab), 6.1, 6.2 (preview surround, content never themed), 6.3, 6.4, 6.6, 7.3, 7.5, 7.6 ("Bake", "Smooth-path ordering"), 7.7, 8, 9 (row M4); design docs `ui-contract.md` (Column 3, Phone "Gradient tab", Components "Stop handle", D1 to D11, "Not drawn"), `mockup-state.md` ("Gradient"), `visual-testing.md`, `tokens.css`; M2 decisions 7, 11, 14c, 16, 19 to 23; M3 decisions 3a to 3f, 6b, 24, 33 to 37, 44 to 46, 56, 58, 59, 62, 65.

This plan builds on milestone/M3 at c7950e7 (M2 and M3 are complete but not merged to main). It reuses `ChevronRow` (with `badge` and `summaryExtra`), `BottomSheet` (with `dock`), `sheetDock.ts`, `focusClearance.ts`, `SettingRow`, `Slider`, `DecimalField`, `Toggle`, the history store, `outputPalette`, `ExtractClient.sample`, `src/color/` (convert, gamut, contrast, cvd, delta-e, ramps) and `mulberry32` (`src/extract/kmeans.ts`).

## Scope

In (roadmap row M4, spec 9):
- Types: Linear, Radial, Conic (4.1), as the three type chips in the contract.
- Stop sources (4.2):
  - Palette order
  - Sorted (lightness, hue, chroma)
  - Smooth path
  - Subset: hand-picked or the N most distinct, as a "Colors" row (Q1b)
  - Image sample: line, horizontal, vertical, radial scan, and from markers (3.7)
  - Derived: analogous, complementary, monochrome, warm-to-cool
  - Constrained random, with Shuffle
  - Population-weighted
- Interpolation (4.3): ten spaces (sRGB, linear sRGB, Display-P3, Lab, OKLab, LCH, OKLCH, HSL, HWB, XYZ), hue method for polar spaces, premultiplied alpha, gamut handling (clamp or reduce chroma).
- Stops (4.3):
  - click the bar to add, drag to move
  - position as % or px
  - per-stop alpha and per-stop lock
  - draggable midpoint hints
  - linked to swatches by id, so palette edits and adjustments flow in
  - typing a color detaches a stop; its unlink icon relinks it
  - deleting a swatch fixes its stops' colors
- Easing (4.3): linear, ease-in, ease-out, ease-in-out, smoothstep, custom cubic-bezier, output as intermediate stops.
- Geometry (4.3): angle with dial and presets, radial shape, size keyword and center, conic start angle and center, reverse, mirror.
- Baked stops (4.5 path 2), and the live native CSS preview with `in <space>` and feature detection (4.5 path 1).
- Preview (4.4): aspect ratios (free, 1:1, 16:9, 9:16, 4:3, banner, custom px), compare mode for two spaces, text-overlay check with contrast ratio, CVD preview (3.5), checkerboard for alpha.
- The preview surround setting (6.2), deferred to M4 by M3 decision 6b (Q3).
- Undo and redo for every gradient change (3.6); the gradient preview updates live during marker drags (3.7).
- Hooks for M5: `bake`, `nativeCss` and `bakedCss` are exported from `src/gradient/`, so M5's gradient writers can fill the Export panel's Gradient section (decision 56) without touching M4 code.

Out (and where it lands instead):
- M5:
  - every gradient export format, including a CSS copy (spec 9 puts all gradient formats in M5, so the Export panel's Gradient section stays "Coming in a later version")
  - the stop sheet and the raster renderer (`render-worker.ts`)
  - grain and dither, and the raster golden images (spec 8 "Visual tests")
  - saving the gradient in project files and share links; in M4 it exists only in memory, like M3's adjustments
- M6: mesh, stepped and repeating types, and "repeat length" (4.3).
- Later:
  - Display-P3 output (7.9)
  - APCA (M3 decision 6a)
  - several gradients per project ("saved gradient variations"); 7.5 has one `gradient` (D1)
- Not built at all:
  - anything that reads the cluster map, which is to be removed after M4
  - new header buttons; the surround control goes into the existing theme menu (Q3b)

## Tasks

The order follows dependencies:
- T1 and T2 lay a shared foundation, serially.
- T3 to T9 run in parallel (the engines, and the UI that doesn't need them).
- T10 and T11 need T3, or T4 and T5.
- T12 and T13 build the preview on T10.
- T14 is an integration sweep.

See "Parallel execution". Opus tasks (algorithm-heavy): **T3, T4, T10**. Every other task uses Sonnet.

Rules that hold for every task:
- Every task keeps `?demo=mockup` working without storage access.
- After T2, no task edits the shared files below. A task that needs something new adds it in its own module.
  - `src/types.ts`, `src/state/signals.ts`, `src/state/history.ts`, `src/state/gradient.ts`
  - `src/gradient/model.ts`, `src/gradient/sources.ts`
  - `src/ui/GradientPanel.tsx`
  - `src/extract/messages.ts`, and the parsing in `src/state/mockup.ts`
  - `e2e/helpers/screens.ts`, `e2e/visual/shots.ts`
  - the design docs
- Each task puts its e2e tests in its own spec file. Shared specs (tokens, a11y, coming-soon, layout) iterate registries and need no edits.
- e2e tests read the preview's `data-*` attributes (T2), so UI tasks can test before the real preview (T12) lands:
  - `data-stops`: the resolved stops after reverse and mirror, as `HEX@P` entries with `~H` hint entries, such as `#1DB07A@0,~30,#D4527F@50,#5039B0@100` (8-digit HEX with alpha)
  - `data-type`, `data-angle`, `data-space`, `data-hue`, `data-easing`, `data-render` (`native` or `baked`), `data-cvd`
- The values the spec leaves open are D1 to D30 under "Defaults", all accepted (Q5).

### M4-T1: Gradient model, state, history and palette sync
- Files:
  - `src/types.ts` (7.5 "Gradient"):
    - `GradientType`: "linear" | "radial" | "conic"
    - `InterpolationSpace`: "srgb" | "srgb-linear" | "display-p3" | "lab" | "oklab" | "lch" | "oklch" | "hsl" | "hwb" | "xyz" (CSS names)
    - `HueMethod`: "shorter" | "longer" | "increasing" | "decreasing"
    - `Easing { kind: "linear" | "ease-in" | "ease-out" | "ease-in-out" | "smoothstep" | "cubic-bezier"; bezier: [x1, y1, x2, y2] }`
    - `GamutHandling`: "chroma" | "clamp"
    - `StopColor`: either `{ kind: "swatch"; id; derive?: { hueShift: number; lightness?: number } }` or `{ kind: "value"; color: Oklch; from: string | null }`. `from` is the swatch the stop was detached from, for Relink.
    - `GradientStop { id; position (0 to 1); color: StopColor; alpha; hint (0 to 1 within the segment to the next stop, 0.5 = none); locked }`
    - `Geometry { angle; shape: "circle" | "ellipse"; size: "closest-side" | "closest-corner" | "farthest-side" | "farthest-corner"; center: ImagePoint; from; reverse; mirror }`
    - `Technique`: one flat record, so switching techniques keeps each one's parameters:
      - `kind`
      - `colors { mode: "all" | "distinct" | "picked"; count; ids }` (Q1b)
      - `sortBy`, `seed`, `minDeltaE`, `minContrast`
      - `derive { from: string | null; kind: "analogous" | "complementary" | "monochrome" | "warm-cool" }`
      - `sample { mode: "line" | "horizontal" | "vertical" | "radial" | "markers-x" | "markers-y"; count; line: { a: ImagePoint; b: ImagePoint }; colors: Oklch[] }`
    - `Gradient { type; geometry; space; hue; premultiplied; easing; gamut; technique; custom: boolean; stops: GradientStop[] }`
    - View state:
      - `GradientPreviewSettings { aspect; customSize { w, h }; compare: InterpolationSpace | null; overlay { on; color: "white" | "black" | string }; cvd: "normal" | CvdType }`
      - `Surround`: "theme" | "mid-gray" | "white" | "black"
    - `Project.gradient`. `SCHEMA_VERSION` stays 1, because there are no project files before M5.
  - `src/state/defaults.ts`: `DEFAULT_GRADIENT` (D2), `DEFAULT_GRADIENT_PREVIEW` (D22).
  - `src/state/signals.ts`:
    - `gradient` (project)
    - view state, kept out of undo: `selectedStopId`, `gradientPreview`, `surround`
    - `loadProject` sets `gradient`
  - `src/state/history.ts`:
    - `Snapshot` gains `gradient`; `same()` compares it and `apply()` restores it.
    - Like swatches, a missing selected stop falls back to the stop at the same index (M3 decision 3d).
  - `src/gradient/model.ts` (pure):
    - `MIN_STOPS = 2`, `MAX_STOPS = 32` (D3)
    - `addStop`, `moveStop` (re-sorts and keeps ids), `removeStop`
    - `setStopColor` (detaches, with `from`), `linkStop`, `relinkStop`
    - `setAlpha`, `setHint`, `setLocked`
    - `materialize(gradient, effectiveStops)`: sets `custom` and stores the stops (Q1a)
    - `detachRemoved(gradient, removedIds, lastColors)` (4.3)
    - `resolveStops(gradient, stops, outputPalette)` → `ResolvedStop { id, position, color: Oklch, alpha, hint, link: "swatch" | "derived" | "value" }[]`
      - It applies reverse (p → 1 − p) and mirror (a palindrome over [0, 1]) at render time; stored stops never change (D21).
  - `src/gradient/sources.ts`: `buildStops(technique, outputPalette, lockedStops)`.
    - It implements Palette order and the Colors subset (All, Picked) itself.
    - It dispatches the other techniques to `order.ts`, `derive.ts` and `image-sample.ts`. T1 creates those with fallbacks that return palette order; T4 and T5 replace their bodies.
    - It keeps locked stops (D6).
  - `src/state/gradient.ts`:
    - computed `effectiveStops`: `custom ? stops : buildStops(...)` (Q1a)
    - computed `resolvedStops`, from `outputPalette`, so adjustments and compare-before flow in
    - actions, each one undo step:
      - `editStops(fn, label)`: materializes the stops and sets Custom
      - `setGradient(patch, label)`
      - `applyTechnique(technique)`: rebuilds, keeps locked stops, leaves Custom
    - `selectStop(id)`: view state, not an undo step
  - `src/state/remove-swatch.ts` and `src/state/extraction.ts`, in Custom mode only:
    - Removing a swatch calls `detachRemoved` in the same undo step.
    - Re-extraction does the same for the swatches it replaces.
    - A new image sets `custom = false` (D20).
  - `src/state/mockup-fixture.ts` and `src/state/mockup.ts`: the fixture gradient (see "Mockup-state additions"), with the 50% stop selected.
- Tests to write first:
  - `tests/gradient/model.test.ts`:
    - "addStop at 0.25 between #000000@0 and #FFFFFF@1 inserts a value stop and keeps order"
    - "removeStop refuses below 2; addStop refuses at 32"
    - "moving the 50% stop to 0.95, past the 100% stop, re-sorts and keeps ids"
    - "setStopColor detaches with from = the swatch id; relinkStop restores the link"
    - "detachRemoved turns a removed swatch's stops into value stops with its last output color"
    - "resolveStops of the fixture gives #1DB07A@0, #D4527F@0.5, #5039B0@1"
    - "reverse gives #5039B0@0, #D4527F@0.5, #1DB07A@1"
    - "mirror gives #1DB07A@0, #D4527F@0.25, #5039B0@0.5, #D4527F@0.75, #1DB07A@1, with the hints mirrored"
  - `tests/state/gradient.test.ts`:
    - "live, Palette order + All: adding a swatch adds a stop; reordering the strip reorders the stops" (Q1a)
    - "an edit to swatch 4's color changes the 50% stop (palette edits flow, 4.3)"
    - "Lightness +0.1 changes the resolved colors; compare-before shows the base colors"
    - "moving a stop sets custom, keeps the stops and is one undo step"
    - "custom: deleting swatch 4 makes its stop a fixed #D4527F in the same undo step; Undo relinks it"
    - "applyTechnique keeps a locked stop at its position and color"
    - "a new image returns a custom gradient to its technique"
  - `tests/state/history.test.ts` (extend):
    - "undo restores the gradient"
    - "undo leaves selectedStopId, gradientPreview and surround unchanged"
  - `tests/state/mockup.test.ts` (extend): "the fixture gradient is linear at 90°, in OKLab, Smooth path over picked swatches 2, 4 and 6, not custom, with the 50% stop selected".
- Done when:
  - Tests pass.
  - The UI is unchanged: column 3 still shows its hint.
  - Lint, typecheck, unit tests and build pass.
- [x] Done. Notes: `effectiveStops` and `resolvedStops` live in `src/state/gradient-stops.ts` (re-exported from `gradient.ts`) so `history.ts` can read them without an import cycle. `removeSwatch` and re-extraction call `detachRemoved` whatever the mode: in live mode it only touches kept locked stops and the Colors picks. Generated stop ids are stable (`stop-<swatch id>`), so a selection survives a rebuild.

### M4-T2: Scaffolding for parallel work (shells, dock, registries, docs)
- Files:
  - `src/ui/GradientPanel.tsx`: the layout, fixed here. It follows contract column 3 and Q4, the same on desktop and phone (6.6 rule 6):
    1. `<GradientDock>` around `<GradientPreview/>`
    2. `<GradientTypeChips/>`
    3. `<StopBar/>`
    4. the inline setting rows: `<InterpolationRow/>` (the drawn Interpolation row), then `<TechniqueRows/>` (the drawn Technique row and its parameter rows)
    5. the chevron rows, in this order:
       - Interpolation options (`<InterpolationOptions/>`, id `interpolation`)
       - Stop (`<StopDetails/>`, id `stop`)
       - Geometry (`<GeometryPanel/>`, id `geometry`)
       - Preview (`<PreviewPanel/>`, id `preview`)
    - With no palette it shows the hint "Load an image to build a gradient." (6.3).
    - `MaterialsPanel` moves to `src/ui/MaterialsPanel.tsx`, and `Shell.tsx` imports it from there.
  - Stub components, each in its own file:
    - `GradientPreview.tsx`: renders the interim CSS (below) in a 2:1 box marked `data-user-content`, with every `data-*` attribute listed under "Rules"
    - `GradientTypeChips.tsx`: static chips, with `data-coming-soon`
    - `StopBar.tsx`: a static bar with handles (stop-color fill, light ring, accent ring on the selected stop)
    - `InterpolationRow.tsx`: the Interpolation setting row, showing "OKLab"
    - `InterpolationOptions.tsx`: exports the chevron row's content stub ("Coming in a later version"), plus `InterpolationOptionsHeader`, a stub that returns null; T9 fills it with the count and reset-all
    - `TechniqueRows.tsx`: a Technique row showing "Smooth path"
    - `StopDetails.tsx`, `GeometryPanel.tsx`, `PreviewPanel.tsx`: "Coming in a later version"
    - `TextOverlay.tsx`: an empty slot inside the preview
  - `src/ui/GradientDock.tsx` (Q2):
    - The preview pins: under the header below 1024 px, with the preview at `max-height: 30dvh`; from 1024 px at the top of column 3's `.column__scroll`, as column 2's strip does (M3 decision 45).
    - The container is opaque `--color-surface`, with a `--color-border` divider while pinned.
    - It writes `--dock-height`.
  - Dock lookups:
    - `StripDock` and `GradientDock` both carry `data-dock`.
    - `sheetDock.ts` and `focusClearance.ts` look for `[data-dock]` in the open tab panel or column, not `[data-testid=strip-dock]`. So every Gradient-tab drawer stops below the preview, with the `--space-2` gap, and locks the page (M3 decisions 35, 46, 59).
    - The Export sheet stays plain (M3 decision 62).
  - Interim rendering, so the app looks right during the waves:
    - `src/gradient/css.ts`: `previewCss(resolved, gradient)` returns a plain `linear-gradient(<angle>deg, HEX P%, …)`. T10 replaces the body and keeps the signature.
    - `src/state/gradient-render.ts`: a computed `render { css, compareCss, baked: null, outOfGamut: false, mode: "native" }`, and `colorAt(position)` as an sRGB lerp. T10 replaces both.
  - Stubs that throw "not built": `src/gradient/interpolate.ts`, `easing.ts`, `bake.ts` and `analysis.ts`.
  - Worker: `src/extract/messages.ts`, `worker.ts` and `client.ts` reserve a `ring` request.
    - It takes a center and radii r0 and r1, normalized, and returns the mean OKLab of that annulus on the working master.
    - Its handler calls `src/image/ring.ts`, a stub that throws "not built". The main-thread fallback routes it the same way (7.4).
  - `src/state/mockup.ts`:
    - `rows` gains `interpolation`, `stop`, `geometry` and `preview`.
    - Own parsers, like `parseMockupImage`: `gradient=linear|radial|conic`, `space=<space>`, `compare=<space>`, `overlay=on`, `cvd=<type>`, `aspect=1:1|16:9|9:16|4:3|banner`, `surround=mid-gray|white|black`, `technique=<kind>`, `menu=theme`.
    - `main.tsx` applies them.
  - Export panel (D26):
    - `contextSection` returns "gradient" from the Gradient tab or column 3.
    - The Gradient section's detail reads "CSS, Tailwind, SVG, images, JSON and a stop sheet."
  - Tokens, in both `docs/design/tokens.css` and `src/styles/tokens.css` (D23). These are fixed in both themes, like the marker rings:
    - `--surround-mid-gray: #777777`, `--surround-white: #ffffff`, `--surround-black: #000000`
    - `--checker-light: #ffffff`, `--checker-dark: #cccccc`
  - Registries: `e2e/helpers/screens.ts` and `e2e/visual/shots.ts` get every M4 screen and shot from "Screens affected".
  - Design docs:
    - `docs/design/mockup-state.md`: the Gradient section and the parameters (see "Mockup-state additions")
    - `docs/design/visual-testing.md`: the shots
    - `docs/design/ui-contract.md`:
      - a new intended deviation, D12: the pinned gradient dock and the drawers below it (Q2)
      - Column 3 notes: the Interpolation options, Stop, Geometry and Preview chevron rows after the Technique row (Q4)
      - the "Surround" group in the theme menu, under "Theme button behavior" (Q3b)
  - `src/styles/app.css`: one empty, labelled section per UI task, such as `/* M4-T7 stop bar */`.
- Tests to write first:
  - `tests/state/mockup.test.ts`:
    - "parses gradient=conic, space=oklch, rows=interpolation,stop,geometry, compare=oklch, overlay=on, cvd=deuteranopia, aspect=16:9, surround=mid-gray, technique=image-sample, menu=theme"
    - "ignores unknown values"
  - `tests/extract/client-ring.test.ts`: "ring round-trips through the worker and the fallback and rejects with 'not built'".
  - `e2e/gradient-scaffold.spec.ts`:
    - "desktop: column 3 holds the preview, chips, stop bar, the Interpolation and Technique rows, then the Interpolation options, Stop, Geometry and Preview chevron rows, in that order"
    - "phone: the Gradient tab has the same order"
    - "the preview's data-stops reads #1DB07A@0,#D4527F@50,#5039B0@100, and the preview is data-user-content"
    - "phone: rows=interpolation and rows=stop each open a sheet whose panel starts at the dock's bottom plus --space-2 (±1 px), with the page locked" (M3 decisions 46, 59)
    - "desktop: scrolling column 3 pins the dock at its top, with the divider"
    - "the Export button on the Gradient tab opens the panel on Gradient"
  - `e2e/tokens.spec.ts`, `e2e/a11y.spec.ts`, `e2e/layout.spec.ts`: no edits. They pass on every registered M4 screen with the stubs, in both themes.
- Done when:
  - Tests pass.
  - T3 to T13 can each be done without touching a registry, a design doc, `GradientPanel.tsx`, `messages.ts`, `src/state/gradient.ts` or another task's file.
- [x] Done. Notes:
  - Each chevron-row panel exports its row wrapper (`InterpolationOptionsRow`, `StopRow`, `GeometryRow`, `PreviewRow`) beside its content component, so T6, T8, T9 and T13 can add the badge and reset-all to `ChevronRow` without editing `GradientPanel.tsx`. `ChevronRow` gained an optional `sheetTitle` (D29).
  - `GradientDock` shares `usePinnedDock.ts`; `StripDock` is unchanged except for `data-dock`.
  - The seams `sources.ts` calls are `orderedStops(technique, swatches)` and `distinctSwatches(swatches, count)` (`order.ts`), `derivedStops(technique, palette)` (`derive.ts`) and `sampledStops(technique, palette)` (`image-sample.ts`). T4 and T5 keep those signatures and build their planned functions under them. The engine stubs use the planned names (`mix`, `easingFn`, `hintWarp`, `sampleAt`, `bake`, `nativeCss`, `bakedCss`, `simulateBaked`, `lowestContrast`).
  - `colorAt(position)` returns an `Oklch`. `src/gradient/labels.ts` holds the shared names.
  - The ring request is `ring(center, r0, r1)`, with radii as fractions of the image width; it reads the master at display size, like `view`. `ringMean` is in `src/image/ring.ts`.
  - The gradient demo parameters are parsed by `parseMockupGradient`, apart from `parseMockupParams`, whose result shape existing tests pin; `main.tsx` passes both to `buildMockupState`.
  - `e2e/helpers/tokens.ts` now also reads `--surround-*` and `--checker-*` from `tokens.css` (the same discovery as `--marker-*`); no allowed list gained a value.
  - The gradient dock's `top` and gutter rules sit after its base rule in the M4-T2 section, since a media rule placed earlier in `app.css` loses to it by source order.

### M4-T3: Interpolation in ten spaces, hue methods, premultiplied alpha, easing and hints (Opus)
- Files:
  - `src/gradient/interpolate.ts` (4.3, 7.6 "Bake"):
    - `mix(a, b, t, { space, hue, premultiplied })` works on Oklch plus alpha. It returns OKLab plus alpha, so gamut mapping happens in one place.
    - It follows CSS Color 4: missing and powerless hue (an achromatic color takes the other stop's hue, D11), hue fixups for the four methods, and premultiplied non-hue channels.
    - It uses `culori/fn` with only these modes registered: rgb, lrgb, p3, lab (D50, as CSS `lab`), lch (D50), oklab, oklch, hsl, hwb, xyz65 (CSS `xyz`).
  - `src/gradient/easing.ts`:
    - `easingFn(easing)`: the CSS keyword curves, smoothstep, and a cubic-bezier solver (Newton with a bisection fallback, to 1e-6)
    - `hintWarp(p, h)`: the CSS color-hint exponent, p^(ln 0.5 / ln h)
- Tests to write first:
  - `tests/gradient/interpolate.test.ts`:
    - "#FF0000→#0000FF at 0.5: sRGB #800080, linear sRGB #BC00BC"
    - "#000000→#FFFFFF at 0.5: sRGB #808080, linear sRGB #BCBCBC, OKLab #636363" (mockup-state's gray at L 0.5)
    - "#FF0000→#00FFFF at 0.5: the sRGB midpoint has OKLCH C < 0.001 (it passes through gray); the OKLab midpoint has C > 0.04" (4.3)
    - "OKLCH #FF0000 (H 29.2)→#0000FF (H 264.1) at 0.5: shorter 326.6°, longer 146.6°, increasing 146.6°, decreasing 326.6° (±0.2°)"
    - "#FFFFFF→#0000FF in OKLCH: at 0.5 the hue is blue's (±0.5°), because white's hue is powerless; likewise #808080→#FF0000 in HSL gives hue 0"
    - "the XYZ midpoint equals the linear-sRGB midpoint within 1e-9"
    - "premultiplied: #FF000000→#0000FF at 0.5 gives rgb(0 0 255 / 0.5); not premultiplied gives rgb(128 0 128 / 0.5)"
    - "t = 0 and t = 1 return the stops within 1e-6 in every space"
    - "CSS lab is D50: #FF0000 → lab(54.29 80.80 69.89) ± 0.05"
  - `tests/gradient/easing.test.ts`, to 1e-4:
    - "ease-in(0.5) = 0.3153; ease-out(0.5) = 0.6847; ease-in-out(0.5) = 0.5"
    - "cubic-bezier(0.25, 0.1, 0.25, 1)(0.5) = 0.8024"
    - "smoothstep(0.25) = 0.15625"
    - "endpoints are exact and the keyword curves are monotonic; y outside [0, 1] is allowed"
    - "hintWarp(0.25, 0.25) = 0.5; hintWarp(p, 0.5) = p"
- Done when:
  - Tests pass.
  - The bundle grows by under 12 kB gzip for the culori modes (informational).
- [x] Done. Notes:
  - The culori modes are registered in a new `src/gradient/spaces.ts` (`toSpace`, `fromSpace`, `hueIndex`). `interpolate.ts` also exports `mixer(a, b, options)`, which converts the stops once and returns `(t) => OklabAlpha`, for the bake, and `fixHues`. `easing.ts` also exports `cubicBezier`.
  - Powerless hue (D11) uses the CSS Color 4 sample-code thresholds: OKLCH chroma ≤ 4e-6, CIELCh ≤ 0.0015. Achromatic inputs become exact gray HSL and HWB coordinates, because culori turns #FFFFFF into hsl(324 −125% 100%). Chromium's own thresholds couldn't be checked offline; T12's native-against-baked test is the check.
  - The sRGB midpoints #800080 and #808080 are ties (127.5 rounded half up). The OKLab round trip lands within 1e-12 of 127.5, so those tests check the channel values to 1e-6, not the HEX strings. ease-in(0.5) is 0.315357, so the easing tests use |Δ| < 1e-4, not `toBeCloseTo(…, 4)`.
  - Bezier x1 and x2 are clamped to 0 to 1 (D7). The solver works in s to 1e-10. Where the curve is flat in x, y is good to 1e-5, which is the double-precision limit there.
  - Nothing in the app imports these modules until T10, so the main bundle doesn't change yet. Bundled with `convert.ts` (esbuild, minified, gzip -9), they add about 2.6 kB gzip: from 7.9 to 10.6 kB, under the 12 kB budget.

### M4-T4: Ordering techniques and subsets (Opus)
- Files:
  - `src/gradient/order.ts` (4.2, 7.6). Distances use the current distance metric (M2 decision 7).
    - `sortSwatches(palette, by)` (D13)
    - `smoothPath(colors, metric)`: an open path. Nearest neighbor from every start keeps the best, then 2-opt improves it; the result is oriented per D13.
    - `mostDistinct(colors, n, metric)` (D14)
    - `constrainedRandom(colors, seed, minDeltaE, minContrast, metric)` → `{ order, met }` (D15)
    - `populationPositions(shares)` (D16)
  - These replace T1's fallback bodies, which `sources.ts` dispatches to.
- Tests to write first (`tests/gradient/order.test.ts`):
  - Sorted:
    - "lightness: L [0.7, 0.2, 0.5] → 0.2, 0.5, 0.7"
    - "chroma: high to low (M2 decision 16)"
    - "hue: [350, 10, 120] → 350, 10, 120 (it starts after the largest gap); [10, 120, 240] → 10, 120, 240"
  - Smooth path:
    - "L [0.9, 0.1, 0.5, 0.3, 0.7] → 0.9, 0.7, 0.5, 0.3, 0.1 (it starts at the end that comes first in palette order)"
    - "L [0.5, 0.6, 0.35, 0.8, 0.2]: total ΔE 0.6, never more than nearest neighbor's"
    - "the mockup subset of swatches 2, 4 and 6 gives 2, 4, 6" (see Risks)
    - "32 colors take under 5 ms; the same input gives the same output"
  - Most distinct: "L [0.1, 0.2, 0.5, 0.9], n 3 → 0.1, 0.5, 0.9 in palette order; n ≥ length → all".
  - Constrained random:
    - "the same seed gives the same order; seeds 1 and 2 differ on the mockup palette"
    - "min ΔE OK 0.1 on the mockup palette: every neighbor ΔE ≥ 0.1, and met = true"
    - "min ΔE 1.0: met = false, and the order has the largest smallest-neighbor ΔE of the 200 tries"
    - "min contrast 1.5 is respected when possible"
  - Population: "[0.5, 0.25, 0.25] → [0, 0.6, 1]; all zero → [0, 0.5, 1]; a 0 share counts as 2%".
- Done when: tests pass, and live gradients in the app use these functions.
- [x] Done. Notes:
  - The fixture risk is cleared: under ΔE OK (the fixture's metric) Smooth path over swatches 2, 4 and 6 gives green, pink, violet. Under CIEDE2000 it gives green, violet, pink, since the metric is the current one (M2 decision 7); the test pins both.
  - `orderedStops` and `distinctSwatches` keep their signatures and take an optional third `metric`, which defaults to `settings.value.distanceMetric`, so a live gradient rebuilds when the metric changes. `order.ts` therefore imports `settings` from `src/state/signals.ts` (no cycle).
  - Also exported for T11 and tests: `distanceMatrix`, `twoOpt`, `randomTries` (the 200 seeded Fisher-Yates shuffles), `RANDOM_TRIES` and `MIN_POPULATION_SHARE`. T11's "Constraints can't all be met." reads `constrainedRandom(...).met`.
  - Constrained random keeps the first try that meets every active constraint (min ΔE above 0, in ΔE OK units scaled by `thresholdFor`; min contrast above 1), else the try with the best worst-neighbor ratio of value to threshold.
  - Population-weighted applies the 2% floor after normalizing the shares over the swatches used. Hue sort counts grays as 0°, as the strip's sort does.

### M4-T5: Derived and Image-sample engines; ring sampling in the worker
- Files:
  - `src/gradient/derive.ts` (4.2 "Derived", D17): `deriveStops(kind, baseId, baseColor)` returns linked stops with `derive` offsets, so edits to the base swatch flow in.
  - `src/gradient/image-sample.ts` (4.2 "Image sample", 3.7, D18):
    - `scanPoints(mode, count, line)`
    - `markerOrder(palette, axis)`
    - `sampleStops(client, points)`: sequential `sample` requests, with the Auto radius and the mean
    - `ringStops(client, count)`
  - `src/image/ring.ts`: the mean OKLab over an annulus on the working master, computed in the worker (7.4). It replaces T2's stub.
- Tests to write first:
  - `tests/gradient/derive.test.ts`, from oklch(0.6 0.1 30):
    - "analogous: H 0, 30, 60"
    - "complementary: H 30, 210"
    - "monochrome: L 0.322, 0.466, 0.61, 0.754, 0.898 at H 30 (ramp steps 900 to 100, M3 D4)"
    - "warm-cool: H 45, 30, 315"
    - "every color is in gamut"
    - "resolveStops follows an edit of the base swatch"
  - `tests/gradient/image-sample.test.ts`:
    - "line (0.05, 0.05)→(0.95, 0.95), count 3 → (0.05, 0.05), (0.5, 0.5), (0.95, 0.95)"
    - "horizontal, count 5 → x 0.05, 0.275, 0.5, 0.725, 0.95 at y 0.5; vertical likewise in y"
    - "markers by x on the fixture: swatches 6, 1, 4, 2, 3, 5; by y: 3, 6, 2, 1, 5, 4"
    - "a swatch without a point is skipped (M3 decision 65)"
  - `tests/image/ring.test.ts`: "a runtime image with a red disk, a green ring and blue outside (radii 0.2 and 0.4 of the half-diagonal) gives #FF0000, #00FF00, #0000FF ± 1 for a radial count of 3".
  - `tests/extract/client-ring.test.ts` (from T2): it now expects `ring` to resolve.
  - `tests/extract/client-image-sample.test.ts`: "a line from marker 1's point to marker 2's point, count 2, samples #E8693A and #1DB07A ± 1" (mockup-scene.png).
- Done when: tests pass, and no UI-thread code loops over pixels.
- [x] Done
  - Note: the ring test uses disk and ring edges at 1/3 and 2/3 of the half-diagonal (the plan's 0.2 and 0.4 are not ring edges for a count of 3). "Every color is in gamut" is tested at chroma 0.04, since offsets keep the base chroma and gamut handling is the renderer's (D12). `ringStops` takes the image aspect (height over width) to find the half-diagonal in width fractions. No T5 e2e spec exists (no UI until T11); `e2e/helpers/ring-image.ts` is the runtime fixture, used by the unit test.

### M4-T6: Type chips and the Geometry row
- Files:
  - `src/ui/GradientTypeChips.tsx` (contract column 3 item 2):
    - a segmented control with Linear, Radial and Conic; arrow keys, Home and End move between them
    - each change is one undo step ("Gradient type")
    - removes T2's `data-coming-soon`
  - `src/ui/GeometryPanel.tsx` (4.3 "Geometry"; contract "Not drawn"). It shows only the rows for the current type (6.6 rule 2):
    - Linear: Angle (`AngleDial`, a number field, and preset chips every 45°)
    - Radial: Shape (Circle or Ellipse), Size (the 4 keywords), Center x and y %
    - Conic: Start angle (a dial) and Center
    - Every type: Reverse and Mirror toggles
    - Reset icons on rows that differ from their default, and a count and reset-all on the header (M3 decision 58, D24).
  - `src/ui/AngleDial.tsx`:
    - `role="slider"`, with the angle as its value
    - pointer drag with pointer capture, one undo step per drag
    - arrow keys ±1°, Shift+arrow ±15°
    - at least 44 px on touch; callouts and selection off
  - `src/gradient/geometry.ts`: `angleFromVector(dx, dy)` (0° up, clockwise, as in CSS), `normalizeAngle`, `ANGLE_PRESETS`.
  - `app.css`: the T6 section.
- Tests to write first:
  - `tests/gradient/geometry.test.ts`:
    - "(0, −1) → 0; (1, 0) → 90; (0, 1) → 180; (−1, 0) → 270"
    - "normalizeAngle(−30) = 330; normalizeAngle(725) = 5"
  - `e2e/gradient-geometry.spec.ts`:
    - "the chips set data-type, each change one undo step"
    - "dragging the dial to the right of its center sets data-angle 90; the 45 preset sets 45"
    - "ArrowRight on the dial adds 1; Shift+ArrowRight adds 15"
    - "Radial shows Shape, Size and Center; Linear doesn't"
    - "Reverse gives data-stops #5039B0@0,#D4527F@50,#1DB07A@100; Mirror gives 5 stops, as in T1"
    - "reset icons show only when a row differs; each reset is one step"
    - "phone: Geometry opens a sheet below the dock; the dial and fields are 44 px; fields are 16 px"
- Done when: tests pass, and nothing depends on hover.
- [x] Done. Notes:
  - Center is two rows (Center X %, Center Y %, sliders), and the angle presets sit under the Angle row, because eight chips would not fit one row at 320 px. The count and reset-all cover only the rows shown for the current type.
  - The phone e2e tests undo with Mod+Z, since the sheet covers the header's Undo button.

### M4-T7: Stop bar
- Files:
  - `src/ui/StopBar.tsx` (contract column 3 item 3; Components "Stop handle"; spec 4.3 "Stops"):
    - The bar is marked `data-user-content` and always runs left to right along the stop axis (D27). Its background is `previewCss` at 90°.
    - Handles:
      - the stop color (`data-user-content`) with a light ring, and an accent ring when selected
      - `role="slider"`, with names such as "Stop 2, Swatch 4, 50%"
      - a 44 px hit area on touch, `touch-action: none`, callouts and selection off
    - Adding: a click or tap on the bar outside every handle's hit area adds a stop with `colorAt(position)` as a fixed color (D4). It is one undo step.
    - Dragging:
      - pointer capture, with updates once per animation frame
      - crossing a neighbor re-sorts the stops
      - Esc and `pointercancel` restore the start
      - one undo step ("Move stop")
      - a locked stop doesn't move (D6)
    - Midpoint diamonds on the segments next to the selected stop. Dragging one sets the hint, as one step (D5).
    - Keyboard on a focused handle:
      - arrows ±1%, Shift+arrow ±10%, Home and End
      - Delete or Backspace removes the stop, except at 2 stops; the live note then says "A gradient needs at least 2 stops."
      - + or Insert adds a stop halfway to the next one
    - The end handles' hit areas fit inside the panel at 320 px.
  - `src/gradient/stop-drag.ts` (pure): the position from the pointer x and the bar's rect, clamped to 0 to 1, and the stop order after crossing.
  - `app.css`: the T7 section.
- Tests to write first:
  - `tests/gradient/stop-drag.test.ts`:
    - "clamps to 0 and 1"
    - "crossing re-sorts and keeps the dragged id"
    - "the start position is restored on cancel"
  - `e2e/stop-bar.spec.ts`:
    - "fixture: 3 handles; the 50% one has the accent ring"
    - "dragging the 50% stop to 30% gives #D4527F@30 in data-stops and the Technique row reads Custom; it is one undo step, and Undo gives back 50 and Smooth path" (Q1a)
    - "Esc mid-drag restores"
    - "a click at 75% adds a 4th stop at 75, as one step"
    - "Delete removes the selected stop; at 2 stops it is refused, with the live note"
    - "ArrowRight ×3 gives 53; Shift+ArrowRight gives 60"
    - "dragging a midpoint diamond adds ~H to data-stops"
    - "phone-chromium touch: a handle drag leaves window.scrollY unchanged"
    - "320 px: no horizontal scroll, and the end handles' hit areas are inside the viewport"
    - "Chromium: a 1 s drag has no long task over 50 ms" (7.7, 60 fps)
- Done when: tests pass, and nothing depends on hover.
- [x] Done. Notes:
  - The bar is taller (70 px) so the midpoint diamonds hang below the track and never cover a click that adds a stop. A mirrored bar shows no diamonds (its segments are copies). Reverse and mirror map back to stored positions (`toStoredPosition`). The bar is a `fieldset`, for a group role that biome accepts.

### M4-T8: Stop row (the selected stop)
- Files:
  - `src/ui/StopDetails.tsx` (4.3 "Stops"). The chevron row is labelled "Stop"; its sheet title is "Stop 2 of 3" (D29). Contents:
    - Color:
      - palette chips: a radio group with `data-user-content` fills, 44 px on touch, that links the stop to a swatch
      - a HEX field with autocorrect, autocapitalize and spellcheck off (6.1); typing a color detaches the stop
      - while the stop is detached, an unlink icon beside the field that is itself the Relink button, "Relink to Swatch 4" (D30). It is disabled with "Swatch removed" when that swatch is gone.
    - Position: % or px (D3), with periods as decimals
    - Alpha: a % slider and field
    - Midpoint to the next stop (hidden on the last stop)
    - Lock toggle
    - Remove stop: an icon button, disabled at 2 stops, with its note shown only while it is disabled (M2 decision 14c)
    - Alpha and Midpoint show reset icons when they differ from the default (M3 decision 58).
    - Every change is one undo step, and a hand edit sets Custom (Q1a).
  - `app.css`: the T8 section.
- Tests to write first (`e2e/stop-details.spec.ts`):
  - "fixture: Stop 2 shows Swatch 4, linked, at 50%, alpha 100%"
  - "typing #FF0000 detaches the stop and shows 'Relink to Swatch 4'; Relink gives #D4527F back; each is one step"
  - "the Swatch 1 chip links the stop: data-stops shows #E8693A@50"
  - "desktop: editing swatch 4's HEX in column 2 updates a linked stop"
  - "alpha 50% gives #D4527F80"
  - "position 25 re-sorts the stops"
  - "a locked stop's handle is aria-disabled for dragging, and the stop survives Rebuild"
  - "Remove is disabled at 2 stops, with its note"
  - "custom: deleting swatch 4 leaves a fixed #D4527F, with Relink disabled ('Swatch removed')"
  - "phone: fields are 16 px with inputmode=decimal; values use periods under de-DE; the sheet sits below the dock"
- Done when: tests pass.
- [x] Done
  - Note: the actions live in `src/state/stop-edit.ts` (unit-tested in `tests/state/stop-edit.test.ts`). A stop that never had a swatch (`from` null) shows no unlink icon. With no stop selected the row says to select one. "Handle aria-disabled" is T7's and the Rebuild icon is T11's, so those parts are covered by the unit test (a locked stop survives `applyTechnique`) rather than e2e.

### M4-T9: Interpolation row and the Interpolation options row
- Files:
  - `src/ui/InterpolationRow.tsx` (contract column 3 item 4, the drawn row):
    - Interpolation: a select of the ten spaces, labelled sRGB, Linear sRGB, Display P3, Lab, OKLab, LCH, OKLCH, HSL, HWB, XYZ
    - a reset icon when it isn't OKLab
    - one undo step per change
    - follows M2 decisions 21 to 23
  - `src/ui/InterpolationOptions.tsx` (Q4; 4.3): the content of the "Interpolation options" chevron row. It expands in place from 1024 px and is a drawer below the dock on phones. To keep it short, only these rows show:
    - Hue: Shorter, Longer, Increasing or Decreasing. Only for LCH, OKLCH, HSL and HWB.
    - Easing: Linear, Ease in, Ease out, Ease in-out, Smoothstep or Custom; always shown. Custom adds x1, y1, x2 and y2 fields; x must be within 0 to 1, with a note otherwise.
    - Premultiplied alpha: a toggle, only while a stop has alpha below 1.
    - Gamut: Reduce chroma or Clamp, only while `render.outOfGamut`, with the note "Some colors fall outside sRGB." (D12).
    - Every row has a reset icon when it differs from its default, and each change is one undo step.
  - `InterpolationOptionsHeader` (same file), on the chevron row's header (M3 decision 58):
    - While any option differs from its default (Hue, Easing and its bezier, Premultiplied, Gamut): an accent dot and the count, "Interpolation options · N" (accessible name "Interpolation options, N active"), plus a reset-all icon, "Reset interpolation options", which is one undo step.
    - The count includes options whose row is hidden (for example a non-default Hue after switching to OKLab), so the reset-all icon always clears everything it counts.
    - While the bake maps colors, the header button's accessible description adds "Some colors fall outside sRGB."
    - Hidden at the defaults.
  - `app.css`: the T9 section.
- Tests to write first (`e2e/interpolation.spec.ts`):
  - "fixture: Interpolation reads OKLab inline, and there is no inline Hue, Easing, Premultiplied or Gamut row"
  - "the Interpolation options drawer on OKLab shows only Easing; on OKLCH or HSL it shows Hue (Shorter) too; on Lab it doesn't"
  - "data-space, data-hue and data-easing follow the rows"
  - "Ease in gives the header 'Interpolation options · 1'; reset-all brings back Linear as one undo step, and the badge hides"
  - "Custom shows 4 fields; x1 1.5 is rejected, with a note"
  - "Premultiplied appears in the drawer only after a stop's alpha drops below 100%"
  - "each change is one undo step; a row's reset icon shows only off its default"
  - "phone: the drawer opens below the dock with the --space-2 gap and locks the page; 320 px rows stay on one line (M2 decision 23)"
- Done when: tests pass. The Gamut row's e2e test lands in T10.
- [ ] Done

### M4-T10: Baked stops, CSS and render state (Opus)
- Files:
  - `src/gradient/bake.ts` (4.5 path 2, 7.6 "Bake"):
    - `sampleAt(resolved, t, gradient)`: finds the segment, then applies the hint warp, easing, `mix`, gamut handling and the sRGB conversion
    - `bake(resolved, gradient)` → `{ stops: { position, hex, alpha }[]; outOfGamut }`, by adaptive subdivision, 16 to 64 stops (D8). Hard stops (equal positions) stay hard.
  - `src/gradient/css.ts` (4.5 path 1, D9):
    - `nativeCss(resolved, gradient, space?)` and `bakedCss(baked, gradient)`; `previewCss` now picks between them
    - easing written as 8 to 32 intermediate stops per segment, adaptive to 1/255 (D7)
    - `supportsInterpolation(space, hue)`, a cached `CSS.supports` check
    - fixed precision, with a period as the decimal separator
  - `src/color/gamut.ts`: adds `clipRgb` for Clamp. M3's `clampChroma` stays the Reduce chroma path.
  - `src/state/gradient-render.ts`:
    - the real `render { css, compareCss, baked, outOfGamut, mode }`, where `mode` is "baked" when the clause isn't supported, or when premultiplied is off and a stop has alpha (D10)
    - an exact `colorAt`
- Tests to write first:
  - `tests/gradient/css.test.ts`:
    - "fixture: `linear-gradient(90deg in oklab, #1DB07A 0%, #D4527F 50%, #5039B0 100%)`"
    - "OKLCH longer: `… in oklch longer hue, …`"
    - "radial: `radial-gradient(circle closest-side at 30% 40% in oklab, …)`"
    - "conic: `conic-gradient(from 45deg at 50% 50% in oklab, …)`"
    - "a hint at 0.6 of the first segment: `#1DB07A 0%, 30%, #D4527F 50%`"
    - "alpha 0.5: `#D4527F80`"
    - "the baked string has no `in` clause"
    - "12.5% under de-DE"
    - "ease-in adds intermediate stops whose colors lie on the eased curve within 1/255"
  - `tests/gradient/bake.test.ts`:
    - "each baked stop equals sampleAt at its position within 1/255" (spec 8)
    - "sRGB interpolation between baked stops stays within 1/255 of sampleAt at 512 points, or 64 stops are used; the worst case is logged"
    - "#000000→#FFFFFF in sRGB bakes to 16 stops; OKLCH #FF0000→#0000FF with longer hue bakes to more"
    - "positions start at 0, end at 1 and never decrease"
    - "two stops at 40% give a jump at 0.4"
    - "OKLCH #FF0000→#00FF00 reports outOfGamut; Reduce chroma keeps L and H within 1e-3; Clamp clips the channels"
    - "mirror: bake(t) = bake(1 − t) within 1/255"
  - `tests/state/gradient-render.test.ts`:
    - "mode is baked when CSS.supports is stubbed to false"
    - "mode is baked when premultiplied is off and a stop has alpha"
  - `e2e/gradient-render.spec.ts`:
    - "opening Interpolation options shows the Gamut row for #FF0000→#00FF00 in OKLCH, but not in OKLab"
    - "with an init script making CSS.supports return false, data-render is baked"
- Done when:
  - Tests pass.
  - The stop bar and the stub preview show the real interpolation.
- [ ] Done

### M4-T11: Technique rows and live sources
- Files:
  - `src/ui/TechniqueRows.tsx` (4.2; Q1; D13 to D19). These are the drawn Technique row plus its parameter rows, inline (Q4):
    - Technique: a select with Palette order, Sorted, Smooth path, Image sample, Derived, Constrained random and Population-weighted. In Custom it reads "Custom", with a ↺ icon "Rebuild from Smooth path" that re-applies the technique and keeps locked stops (M3 decision 58 pattern, D19).
    - Then rows for the chosen technique only (6.6 rule 2):
      - Colors (Q1b), for the palette-based techniques: All, Most distinct (with a Count stepper) or Picked (palette chips that toggle; at least 2, with a note)
      - Sorted: By (Lightness, Hue or Chroma)
      - Constrained random:
        - Min ΔE (in metric units) and Min contrast sliders
        - a Shuffle icon button (Lucide `Shuffle`), one undo step
        - "Constraints can't all be met." in a live region when they are unmet
      - Derived: Kind, and From (palette chips, single choice)
      - Image sample:
        - Mode: Line, Horizontal, Vertical, Radial, Markers by x or Markers by y
        - Count, 2 to 12 (not for the marker modes)
        - `ImageSampleThumb`
        - disabled with "Needs an image" when there is no image (M2 decision 14c)
  - `src/ui/ImageSampleThumb.tsx` (contract "Not drawn"):
    - the image thumbnail (`data-user-content`), the line, and dots at the sample points
    - in Line mode, two endpoint handles: 44 px, pointer capture, arrows ±1%, Shift+arrow ±10%, one undo step per drag
  - `src/state/image-sample.ts`:
    - samples through T5's engine, with job ids, dropping stale results
    - writes `technique.sample.colors` and commits "Image sample"
    - samples again on a new image
  - `app.css`: the T11 section.
- Tests to write first (`e2e/technique.spec.ts`):
  - "fixture: Smooth path, with Colors set to Picked and swatches 2, 4 and 6 pressed"
  - "Palette order + All: data-stops #E8693A@0,#1DB07A@20,#14386B@40,#D4527F@60,#1E8A2E@80,#5039B0@100"
  - "Sorted by lightness: #14386B, #5039B0, #1E8A2E, #D4527F, #E8693A, #1DB07A" (the fixture's L values)
  - "Population-weighted: positions equal T4's populationPositions of the fixture shares"
  - "Shuffle changes the order as one undo step; Undo gives back the earlier order"
  - "Derived, analogous, from swatch 3 gives 3 stops; a hue edit to swatch 3 moves all three"
  - "Markers by x gives linked stops #5039B0, #E8693A, #D4527F, #1DB07A, #14386B, #1E8A2E"
  - "Line: dragging the end handle onto patch 4 (0.380, 0.796) makes the last stop #D4527F ± 2"
  - "from Custom, the ↺ icon rebuilds the Smooth path stops and keeps a locked stop"
  - "unpicking down to 1 swatch is refused, with the note"
  - "phone: every chip and handle is 44 px; the demo makes no storage access"
- Done when: tests pass.
- [ ] Done

### M4-T12: Gradient preview
- Files:
  - `src/ui/GradientPreview.tsx` (4.4, 4.5; contract column 3 item 1; D22):
    - A stage with the surround background: `--color-surface-sunken` for Match theme, otherwise the new tokens.
    - Inside it, the preview at the chosen aspect: Free is 2:1 at full width; the others fit the width, up to 60vh on desktop and the dock's 30dvh on phones.
    - It renders `render.css`, and `data-render` says whether that is native or baked.
    - A checkerboard (`--checker-*`) behind the gradient, only while a stop has alpha below 1.
    - Compare: a second preview under the first, using `render.compareCss`. Both are labelled with their space in muted text, outside the user content.
    - CVD: when `cvd` isn't normal, both previews render `simulateBaked` stops, labelled "Deuteranopia simulation" and so on.
    - It keeps T2's `data-*` attributes and the `TextOverlay` slot.
  - `src/gradient/analysis.ts`: `simulateBaked(baked, type)`, using `src/color/cvd.ts` (3.5).
  - `app.css`: the T12 section.
- Tests to write first:
  - `tests/gradient/analysis.test.ts`:
    - "normal is the identity"
    - "achromatopsia gives R = G = B"
    - "the output is in gamut"
  - `e2e/gradient-preview.spec.ts`:
    - "Chromium: the native and forced-baked fixture previews match within 3/255 per channel, averaged over 4 rows to absorb gradient dithering" (v1 acceptance 6, the M4 part)
    - "preview pixels are identical in light and dark" (6.2 theme 3)
    - "aspect=1:1 is square ± 1 px; aspect=9:16 stays within 60vh"
    - "the checkerboard shows only while a stop has alpha below 1"
    - "compare=oklch shows two labelled previews"
    - "cvd=achromatopsia renders grays"
    - "surround=black: the stage is #000000 and the preview pixels don't change"
    - "dragging marker 4 changes the 50% stop's color in the preview before release" (3.7)
    - "phone: the dock pins, and the preview is at most 30dvh"
- Done when: tests pass, and dragging a stop updates the preview within a frame.
- [ ] Done

### M4-T13: Preview row, text check, vision and surround
- Files:
  - `src/ui/PreviewPanel.tsx` (4.4; D22). All of its settings are view state, never undo steps (3.6):
    - Aspect: Free, 1:1, 16:9, 9:16, 4:3, Banner or Custom. Custom shows width × height fields, 16 to 8192 px.
    - Compare: Off, or a space.
    - Text check: a toggle and a Text color (White, Black or a swatch). The readout, such as "Lowest contrast 4.54:1 · AA", uses M3's `badge` and is announced through a live region.
    - Vision: Normal, Protanopia, Deuteranopia, Tritanopia or Achromatopsia.
    - A count and reset-all on the header (M3 decision 58).
  - `src/ui/TextOverlay.tsx`: "Aa Sample" at `--text-lg`, centered, marked `data-user-content`.
  - `src/gradient/analysis.ts`: `lowestContrast(textHex, samples, backdropHex)`. Alpha samples are composed over the backdrop: the surround color, or white for Match theme (6.2, D22).
  - Surround (Q3):
    - `src/state/surround.ts`: an app setting under the localStorage key `palette-studio:surround`, handled as `theme.ts` handles the theme. It is never read or written in `?demo=mockup`, where `surround=` sets it.
    - `src/ui/ThemeButton.tsx`: the theme menu gets a "Surround" group with Match theme, Mid-gray, White and Black, as menu items (44 px on touch).
    - It applies to the gradient preview's stage and to the image well's background (`ImageWell.tsx`).
  - `app.css`: the T13 section.
- Tests to write first:
  - `tests/gradient/analysis.test.ts` (add):
    - "white over #000000→#767676 in sRGB: 4.54, AA"
    - "black over the same: 1.00, Fail"
    - "an alpha-0 stop over White counts as #FFFFFF"
  - `tests/state/surround.test.ts`:
    - "the demo never reads or writes storage"
    - "the URL parameter wins in the demo"
  - `e2e/preview-panel.spec.ts`:
    - "Aspect 16:9 gives 16:9 ± 1 px; Custom 1200 × 400 gives 3:1"
    - "turning Compare on picks OKLCH (D22)"
    - "Text check shows the overlay and a ratio; a Black text color changes the ratio"
    - "Vision sets data-cvd"
    - "Surround in the theme menu changes the stage and the image well but not the preview pixels, and survives a reload (outside the demo)"
    - "the demo writes no localStorage"
    - "none of these is an undo step"
    - "phone: the Preview sheet sits below the dock"
- Done when: tests pass.
- [ ] Done

### M4-T14: Integration sweep, phone and theme pass, review page
- Files:
  - Fixes only, anywhere.
  - `docs/design/visual-testing.md` and `mockup-state.md`: reconcile them with what was built.
- Tests to write first:
  - `e2e/undo-gradient-all.spec.ts`: one session that changes the type, angle, space, easing and technique, adds and moves a stop, changes its alpha, detaches a stop and shuffles, then undoes back to the start. It ends with the fixture's data-stops and attributes (3.6).
  - `e2e/gradient-flow.spec.ts`:
    - "a marker drag, an adjustment and a HEX edit each change the linked stop"
    - "Colors 6 → 5 rebuilds a live gradient" (Q1a)
    - "custom + a swatch delete gives a fixed stop"
    - "v1 acceptance 5: Linear, Radial and Conic render without error from every technique in OKLCH"
  - `e2e/layout.spec.ts`: no edits. With every M4 sheet open at 320, 375, 390 and 430 px, in both themes: no horizontal scroll, and every control is at least 44 px.
- Done when:
  - Lint, typecheck, unit tests, e2e and build all pass.
  - The bundle stays within 150 kB gzip; record the size.
  - `npm run visual:review` writes every shot.
- [ ] Done

## Screens affected (UI work only)

| Screen | ui-contract regions | New or changed screenshots | Mockup-state additions | Not-drawn items needing design review |
| --- | --- | --- | --- | --- |
| Desktop Studio view | Column 3 items 1 to 4; header Export (opens on Gradient from column 3) | Changed: studio-desktop (column 3 now built; compare with `01`, `02`). New at 1280 × 1280: interp-options-desktop (`rows=interpolation&space=oklch`, so Hue shows), gradient-stop-desktop (`rows=stop`), gradient-geometry-desktop (`rows=geometry`), gradient-radial-desktop (`gradient=radial&rows=geometry`), gradient-preview-desktop (`rows=preview`), gradient-check-desktop (`overlay=on&cvd=deuteranopia&rows=preview`), gradient-technique-desktop (`technique=image-sample`). New at 1280 × 800: gradient-conic-desktop (`gradient=conic`), gradient-compare-desktop (`compare=oklch`), gradient-surround-desktop (`surround=mid-gray&aspect=1:1`) | the Gradient section and every parameter below | the gradient dock pinned in column 3 (D12); the Interpolation options row with its Hue, Easing, Premultiplied and Gamut rows and the header badge; the technique parameter rows and the Image sample thumbnail; the Stop, Geometry and Preview rows; the angle dial; midpoint diamonds; compare labels; the text overlay; the checkerboard; the surround stage |
| Phone Gradient tab | Phone "Gradient tab": preview, chips, stop bar, Interpolation and Technique rows | Changed: gradient-phone (compare with `09`, `10`, middle phone; angle per D1). New: interp-options-sheet-phone (`tab=gradient&rows=interpolation&space=oklch`), stop-sheet-phone (`tab=gradient&rows=stop`), geometry-sheet-phone (`tab=gradient&rows=geometry`), preview-sheet-phone (`tab=gradient&rows=preview`), gradient-compare-phone (`tab=gradient&compare=oklch`), gradient-technique-phone (`tab=gradient&technique=image-sample`) | as above | everything above as sheets; the pinned dock with drawers below it (Q2) |
| Tablet | as phone | New: gradient-tablet (`tab=gradient`, 820 × 1180) | none | as phone |
| Theme menu (every screen) | Header item 5, "Theme button behavior" | New: surround-menu-desktop (`menu=theme`) | `menu=theme` | the Surround group (Q3b) |
| Source column and tab | Column 1 item 1 (the well's background) | Changes only with `surround=` (Q3a) | none | the well on a mid-gray, white or black surround |

T2 registers every shot above in `e2e/visual/shots.ts` and every screen in `e2e/helpers/screens.ts`, so token and axe tests cover them in both themes from the start. The `visual` CI job fails on the changed shots until the user signs off and `visual-baselines.yml` runs. No task updates a baseline.

### Mockup-state additions (`docs/design/mockup-state.md`, Gradient)

Keep the existing four lines, and add these:
- Geometry: angle 90°, ellipse, farthest-corner, center 50% 50%, conic start 0°, reverse and mirror off.
- Interpolation: OKLab. In Interpolation options: hue Shorter (hidden, since OKLab isn't polar), premultiplied on (hidden, since no stop has alpha), easing Linear, gamut Reduce chroma (hidden, since everything is in gamut). So the drawer shows only Easing, and the header has no badge.
- Technique: Smooth path, with Colors set to Picked: swatches 2, 4 and 6 (Q1b). The stops are the technique's output, not stored: the gradient is live, not Custom.
- Stops: swatch 2 at 0%, swatch 4 at 50% and swatch 6 at 100%, all linked, alpha 100%, midpoints 50%, unlocked. The 50% stop is selected.
- Preview: aspect Free (2:1), compare off, text check off (White text), Vision Normal, surround Match theme.
- Expected native CSS: `linear-gradient(90deg in oklab, #1DB07A 0%, #D4527F 50%, #5039B0 100%)`; `data-stops` `#1DB07A@0,#D4527F@50,#5039B0@100`.
- New parameters:

| Parameter | Values | Effect |
| --- | --- | --- |
| `gradient` | `linear` (default), `radial`, `conic` | Gradient type |
| `space` | a space name, such as `oklch` | Interpolation space (OKLab by default) |
| `rows` | adds `interpolation`, `stop`, `geometry`, `preview` | Opens those column 3 rows; on phones with `tab=gradient`, their sheets |
| `compare` | a space name, such as `oklch` | Compare mode with that space |
| `overlay` | `on` | Text check on, with White text |
| `cvd` | `protanopia`, `deuteranopia`, `tritanopia`, `achromatopsia` | Vision simulation |
| `aspect` | `1:1`, `16:9`, `9:16`, `4:3`, `banner` | Preview aspect |
| `surround` | `mid-gray`, `white`, `black` | Preview surround, for this page load only |
| `technique` | `palette-order`, `sorted`, `smooth-path`, `image-sample`, `derived`, `random`, `population` | Applies that technique with its defaults (`image-sample` samples the default line on the fixture; `derived` uses swatch 3) |
| `menu` | `theme` | Opens the theme menu |

## Acceptance checklist (copied from the spec)

- [ ] Build linear, radial and conic gradients from any technique in 4.2, with a chosen interpolation space; palette edits flow into linked stops. (spec 8, v1 acceptance 5)
- [ ] Preview matches exported CSS and raster output. (spec 8, v1 acceptance 6; M4 checks native against baked, while exported CSS and raster are M5)
- [ ] Gradient baking: baked stops stay within 1/255 of the chosen interpolation at sampled points. (spec 8 unit tests)
- [ ] Gradient types: Linear (angle or direction), Radial (circle or ellipse, size keywords, position), Conic (start angle, position). (spec 4.1; repeating, stepped and mesh are M6; easing is a setting, see Notes)
- [ ] Stop sources: Palette order, Sorted, Smooth path (nearest neighbor plus 2-opt), Subset (by hand or N most distinct), Image sample (line, horizontal, vertical, radial scan), Derived (analogous, complementary, monochrome, warm-to-cool), Constrained random (seeded, minimum ΔE and contrast, Shuffle), Population-weighted. (spec 4.2, 7.6)
- [ ] The Image sample technique can take its stops from the markers, ordered by x, by y, or along a drawn path. (spec 3.7)
- [ ] Interpolation settings (spec 4.3; repeat length, mesh and banding are M5 and M6):
  - color space (10 spaces, OKLab default) with compare
  - hue method (polar spaces only); premultiplied alpha
  - stops: click to add, drag to move, % or length, per-stop alpha, per-stop lock, draggable midpoint hint, linked by id; typing detaches, with an unlink icon and Relink; deleting a swatch fixes its stops
  - easing: linear, ease-in, ease-out, ease-in-out, smoothstep, cubic-bezier, as 8 to 32 intermediate stops per segment
  - gamut handling: clamp or reduce chroma
  - geometry: angle with dial and presets, center, shape and size, reverse, mirror
- [ ] Preview: aspect ratios (free, 1:1, 16:9, 9:16, 4:3, banner, custom px), compare mode for two interpolation spaces, text-overlay check with contrast ratio, CVD preview, checkerboard for alpha. (spec 4.4)
- [ ] The live preview is a native CSS gradient with an explicit `in <space>` clause, feature-detected with `CSS.supports`; baked stops render identically everywhere. (spec 4.5 paths 1 and 2)
- [ ] CVD simulation is applied to gradients. (spec 3.5)
- [ ] Undo and redo cover gradients; view state (selection, open panel, preview options, surround) isn't recorded. (spec 3.6)
- [ ] During a marker drag, the gradient preview updates live. (spec 3.7 "Dragging")
- [ ] 60 fps gradient preview while dragging. (spec 7.7, a target to validate)
- [ ] Content is never themed: the gradient preview, stop handles, stop bar and thumbnails look identical in both themes. A preview-surround setting (Match theme, Mid-gray, White, Black) changes only the surround. (spec 6.2)
- [ ] The text-overlay check uses the preview background, never the UI theme. (spec 6.2 "Background-dependent tools")
- [ ] Theme 3: swatch, image and gradient colors are identical in both themes (a screenshot comparison of the preview areas). (spec 6.2)
- [ ] Theme 4: all text and controls meet AA contrast in both themes. (spec 6.2)
- [ ] Touch: (spec 6.1)
  - every control at least 44 × 44 px, and nothing depends on hover
  - text fields at least 16 px, with `inputmode='decimal'`; the HEX field turns off autocorrect and autocapitalize
  - sliders have large thumbs and number steppers
  - callouts are off on the stop bar, the dial and the thumbnail
- [ ] Phone 1: every feature is reachable at 320 px without horizontal scrolling. (spec 8)
- [ ] Phone 2: all controls are at least 44 × 44 px, and nothing depends on hover. (spec 8)
- [ ] Phone 4: text fields don't trigger Safari's focus zoom. (spec 8)
- [ ] Phone layout: the Gradient tab holds the same controls in the same order as column 3; secondary tools open as bottom sheets. (spec 6.1, 6.6 rules 2 and 6)
- [ ] Motion never applies to color values. (spec 6.4)
- [ ] Messages are plain sentences with at most one action, heard through a live region: the 2-stop limit, unmet constraints, "Needs an image" and the contrast readout. (spec 6.3)
- [ ] The UI thread never loops over image pixels: Image sample and ring sampling run in the worker. (spec 7.4)
- [ ] Numbers in CSS strings and fields use a period as the decimal separator under any locale. (spec 5)
- [ ] Keyboard-operable, with visible focus and sufficient UI contrast, including stop handles, the dial, chips and the thumbnail's handles. (spec 8, v1 acceptance 10)
- [ ] Token conformance passes on every new and changed screen, desktop and phone, in both themes. (`visual-testing.md` 1)
- [ ] The review page includes the new shots, and baselines change only through `visual-baselines.yml` after sign-off. (`visual-testing.md` 2, 3)
- [ ] `?demo=mockup` shows the fixture gradient and never touches localStorage or IndexedDB. (`mockup-state.md`, spec 5.5)

## Manual checks for a person

- [ ] Real iPhone:
  - dragging a stop moves only the stop: no page scroll, zoom or callout
  - the angle dial and the thumbnail's line handles work by touch
  - the Gradient tab's dock pins, and drawers stop below it and lock the page
  - fields don't zoom on focus, and HEX doesn't autocorrect
- [ ] Android with Chrome: the same checks.
- [ ] Safari 16.2 to 16.4 (if available) and Firefox 127+:
  - the preview uses the native clause where it is supported and falls back to baked stops elsewhere
  - native and baked look the same
- [ ] Judge the interpolation spaces side by side with compare (OKLab against OKLCH, and sRGB's gray dip on complementary colors), and the easing curves, on real palettes. There are no reference values for "looks right".
- [ ] Compare the CVD preview with Chrome DevTools' "Emulate vision deficiencies", and a few text-check ratios with an external WCAG checker.
- [ ] The Mid-gray, White and Black surrounds, in both themes.
- [ ] Time a stop drag and a marker drag on a mid-range phone (the 60 fps target, 7.7).
- [ ] Open `artifacts/visual-review/index.html`, compare it with the mockups and the contract, and sign off or list changes.
- [ ] Design review of the not-drawn items in "Screens affected".
- [ ] After sign-off, run `visual-baselines.yml` on milestone/M4 and check the committed baselines.

## Parallel execution

### Dependency graph

```
T1 ─► T2 ─┬─► T3  (interpolate, easing)  [Opus] ──► T10 (bake, CSS) [Opus] ──► T12 (preview) ──► T13 (preview row, surround)
          ├─► T4  (ordering)             [Opus] ─┐
          ├─► T5  (derive, image sample)  ────────┴─► T11 (technique rows)
          ├─► T6  (type chips, geometry)
          ├─► T7  (stop bar)
          ├─► T8  (stop row)
          └─► T9  (Interpolation row + Interpolation options)
All ─► T14 (integration)
```

Dependencies that the graph's lines don't show:
- T10's Gamut-row e2e test opens T9's Interpolation options row, so T9 must be merged first. It is, since T9 runs in wave 1.
- T7 adds stops with `colorAt`, which is T2's interim lerp until T10 lands. T7's tests check the count and position, not the exact color.

The Q4 change didn't change the waves. It moved Hue, Easing, Premultiplied and Gamut from inline rows into `InterpolationOptions.tsx`, which T2 creates as a stub and T9 owns alone, beside `InterpolationRow.tsx`. `GradientPanel.tsx` (T2) fixes the row order, so no other task touches either file.

### Waves

| Wave | Tasks | Runs as | Start when |
| --- | --- | --- | --- |
| 0 | T1, then T2 | one worktree, serial | the plan is approved |
| 1a | T3 (Opus), T4 (Opus), T5, T7, T6 | 5 worktrees | T2 is merged. The engines go first because they gate wave 2 |
| 1b | T8, T9 | 2 worktrees | any wave 1a slot frees up |
| 2 | T10 (Opus; after T3), T11 (after T4 and T5) | 2 worktrees | each starts as soon as its dependencies are merged, even while 1b runs |
| 3 | T12 | one worktree | T10 is merged |
| 4 | T13 | one worktree | T12 is merged |
| 5 | T14 | one worktree | everything is merged |

Run at most about 5 worktrees at once, because the e2e suites use 5 browser projects each.

### Shared files that cause merge conflicts, per wave

- **Wave 0:** none, because it runs serially. T1 and T2 deliberately take every shared file:
  - state: `src/types.ts`, `src/state/signals.ts`, `defaults.ts`, `history.ts`, `gradient.ts`, `gradient-render.ts`
  - gradient modules: `src/gradient/model.ts`, `sources.ts`; the fallbacks `order.ts`, `derive.ts`, `image-sample.ts`; the stubs `interpolate.ts`, `easing.ts`, `bake.ts`, `css.ts`, `analysis.ts`
  - UI: `src/ui/GradientPanel.tsx`, the stub files (`InterpolationRow.tsx`, `InterpolationOptions.tsx`, `TechniqueRows.tsx`, `StopDetails.tsx`, `GeometryPanel.tsx`, `PreviewPanel.tsx`, `TextOverlay.tsx`, `GradientPreview.tsx`, `StopBar.tsx`, `GradientTypeChips.tsx`), `GradientDock.tsx`, `StripDock.tsx`, `sheetDock.ts`, `focusClearance.ts`, `Shell.tsx`, `ExportPanel.tsx`, `MaterialsPanel.tsx`
  - worker: `src/extract/messages.ts`, `worker.ts`, `client.ts`
  - wiring: `src/state/mockup.ts`, `mockup-fixture.ts`, `main.tsx`, `remove-swatch.ts`, `extraction.ts`
  - registries: `e2e/helpers/screens.ts`, `e2e/visual/shots.ts`
  - styles and docs: `docs/design/*`, `src/styles/tokens.css`, the section headers in `src/styles/app.css`
- **Wave 1:**
  - `src/styles/app.css`: T6, T7, T8 and T9 each edit only their own labelled section. Don't reformat the file.
  - `src/extract/worker.ts`: T5 only. The `ring` handler body lives in `src/image/ring.ts`.
  - One owner per engine file: `order.ts` is T4's; `derive.ts` and `image-sample.ts` are T5's; `interpolate.ts` and `easing.ts` are T3's.
  - `StopBar.tsx` is T7's and `StopDetails.tsx` is T8's. Both call the `src/state/gradient.ts` actions and never each other's internals; selection goes through `selectedStopId`.
  - `GeometryPanel.tsx`, `GradientTypeChips.tsx` and `AngleDial.tsx` are T6's. `InterpolationRow.tsx` and `InterpolationOptions.tsx` are T9's.
  - Tests: no task edits `e2e/mockup-state.spec.ts`, `tokens.spec.ts`, `a11y.spec.ts`, `layout.spec.ts` or `tools/make-fixtures.ts`. Runtime fixtures, such as the ring image, are generated in a helper the task owns, such as `e2e/helpers/ring-image.ts`.
- **Wave 2:**
  - T10 only: `src/gradient/css.ts`, `bake.ts`, `src/state/gradient-render.ts`, `src/color/gamut.ts`.
  - T11 only: `src/ui/TechniqueRows.tsx`, `ImageSampleThumb.tsx`, `src/state/image-sample.ts`.
  - `app.css`: T11's section only, since T10 has no UI.
- **Waves 3 and 4:**
  - `src/ui/GradientPreview.tsx`: T12 builds it; T13 only fills the `TextOverlay` slot.
  - `src/gradient/analysis.ts`: T12 adds `simulateBaked`, T13 adds `lowestContrast`. The two waves are serial, so they don't conflict.
  - `src/ui/ThemeButton.tsx` and `ImageWell.tsx` (the surround background): T13 only.

### Running the waves

- Each wave task gets its own git worktree on a branch `milestone/M4-T<n>` off the current milestone/M4, and its own `npm ci`.
- e2e port: `E2E_PORT=4173 + n`, such as `E2E_PORT=4183 npm run e2e` for T10.
- `artifacts/` is per worktree. Run `visual:review` only in T14.
- Merge into milestone/M4 in task-id order within a wave:
  1. rebase the next branch
  2. rerun lint, typecheck, unit tests and that task's e2e specs
  3. merge
- Run the full e2e suite after each wave.
- One commit per task, with a message starting `M4-T<n>:`.
- Model: Opus for T3, T4 and T10; Sonnet for the rest.

## Risks

- **Native and baked previews can disagree.** Browsers differ in:
  - powerless-hue epsilons
  - gamut mapping: Chromium clips out-of-gamut interpolated colors, while the bake reduces chroma
  - premultiplication
  - gradient dithering

  Mitigations:
  - T3's epsilon is tuned against Chromium (D11).
  - T12's 3/255 tolerance averages rows to absorb dithering.
  - Out-of-gamut gradients differ between the two paths by design (D12). The Gamut row in Interpolation options, and the note in its header's description, make that visible.
- **CSS always premultiplies alpha.** With premultiplied off, the preview must use baked stops (D10). M5's CSS export inherits this.
- **The fixture's smooth-path order.** Rough OKLab estimates make green → pink → violet (swatches 2, 4, 6) the shortest path, and D13's orientation keeps 2 first. If T4's test shows otherwise, the fixture needs Custom stops or a different technique, which is a mockup-state edit for the user to confirm.
- **The live-technique model (Q1a)** touches every palette writer through computed state, so a missed case shows stale stops. T14's flow tests cover add, delete, reorder, edits, adjustments, marker drags and re-extraction.
- **Settings out of sight (Q4).** Hue, Easing, Premultiplied and Gamut now live in a collapsed row. The header badge ("Interpolation options · N") and its reset-all keep non-default settings visible, and the header's accessible description carries the out-of-sRGB note.
- **Bundle size.** Ten culori modes, the dial and the thumbnail have to fit within 150 kB gzip (M3 ended at about 79 kB). If needed, load the Lab, LCH, P3, HWB and XYZ converters on first use.
- **Phone height.** A pinned preview (30dvh) plus a drawer leaves about half the screen for a sheet on a 667 px iPhone SE. Check it at design review (Q2).
- **Async Image sample.** Stale results must be dropped by job id, and a new image clears them.
- **Parallel merges.** Conflicts concentrate in the `app.css` sections; every other file has one owner per wave.
- **Visual CI.** The studio-desktop and gradient-phone shots change, and the `visual` job fails until sign-off and the baseline workflow run. This is expected.
- **The cluster map goes after M4.** M4 adds nothing that reads it. Population-weighted uses extraction populations (`Swatch.population`), not cluster-map shares.

## Defaults

All accepted by the user (Q5, 2026-11-20).

- D1. One gradient per project (7.5 "gradient"). Spec 5.3, 5.5 and 6.5 say "gradients"; several gradients per project stay Later ("saved gradient variations").
- D2. The default for a new palette: Linear 90°, OKLab, hue Shorter, premultiplied on, easing Linear, gamut Reduce chroma, technique Smooth path over All colors, live.
- D3. 2 to 32 stops. Positions are stored as fractions and shown as % with up to 1 decimal. A position typed in px converts against the preview's width (the Custom size if set, else the rendered width) and is stored as a fraction.
- D4. Adding a stop on the bar takes the gradient's color at that point as a fixed color, so the gradient doesn't change.
- D5. Each stop has a midpoint hint to the next stop (0.5 = none), with CSS color-hint semantics. Diamonds show on the segments next to the selected stop.
- D6. A locked stop can't be moved or removed. Rebuild, Shuffle and technique changes keep it at its position with its color, and drop generated stops within 1% of it.
- D7. One easing for the whole gradient (7.5), applied within each segment. Native CSS gets 8 to 32 intermediate stops per segment, adaptive to 1/255. Bezier x1 and x2 lie within 0 to 1.
- D8. Baking order: hint warp, easing, interpolation, gamut mapping, sRGB. Adaptive subdivision, 16 to 64 stops. 8-bit HEX, `#RRGGBBAA` with alpha.
- D9. Native preview stops are written as the sRGB HEX the strip shows; the `in <space>` clause carries the interpolation (4.5 path 1). M5's export may write `oklch()`, as in spec 5.2's example.
- D10. The preview renders natively when `CSS.supports` accepts the clause. It uses baked stops otherwise, when premultiplied is off with alpha, and for CVD simulation.
- D11. Powerless hue: an achromatic stop takes the other stop's hue (CSS Color 4). The chroma epsilon matches Chromium and is documented in `interpolate.ts`.
- D12. Gamut: Reduce chroma (the default; M3's binary search in OKLCH) or Clamp (per-channel clip). Its row, inside Interpolation options, shows only while the bake had to map a color.
- D13. Ordering rules. Distances use the current metric.
  - Sorted: lightness dark to light; chroma high to low (M2 decision 16); hue ascending, starting just after the largest hue gap.
  - Smooth path starts at whichever end comes first in palette order.
- D14. Most distinct: the farthest pair first, then farthest-point additions. Output is in palette order.
- D15. Constrained random:
  - seeded mulberry32, 200 tries
  - Min ΔE: default 0.1 ΔE OK (10 in ΔE00), range 0 to 0.3
  - Min neighbor contrast: 1 (off) to 7, default 1
  - Shuffle adds 1 to the seed and is one undo step
  - when the constraints can't be met, the best order is kept, with "Constraints can't all be met."
- D16. Population-weighted: palette order (or the Colors subset), with bands in proportion to each swatch's share (at least 2%). Stops sit at band centers, normalized to 0 to 1.
- D17. Derived stops stay linked to the base swatch with offsets, so its edits flow in:
  - analogous: −30°, 0, +30°
  - complementary: 0, +180°
  - monochrome: ramp steps 900, 700, 500, 300, 100 (M3 D4)
  - warm-to-cool: three stops (warm, base, cool), pulled 50% toward 60° and toward 240° along the shorter arc
  - The base is the selected swatch when Derived is chosen. The From chips change it, and it falls back to the first swatch if removed.
- D18. Image sample:
  - Modes:
    - Line: default (0.05, 0.05) to (0.95, 0.95)
    - Horizontal: y 0.5, x 0.05 to 0.95; Vertical likewise
    - Radial: count equal rings out to the half-diagonal, each ring's mean
    - Markers by x and Markers by y: linked stops; swatches without a point are skipped (M3 decision 65)
  - Count 2 to 12, default 5; Auto radius, mean
  - Sampled colors are fixed stops. The line is drawn on a thumbnail in the technique rows, so it works the same on the Gradient tab and in column 3.
- D19. After any hand edit to stops, the Technique row reads "Custom", with a ↺ "Rebuild from <technique>" icon (like M2's Custom preset and M3 decision 58's reset icons).
- D20. In Custom mode, re-extraction turns stops of replaced swatches into fixed colors (spec 4.3's delete rule). A new image returns a Custom gradient to its technique.
- D21. Geometry defaults: angle 90°, ellipse, farthest-corner, center 50% 50%, conic start 0°. Reverse and mirror apply at render time. The dial puts 0° at the top and turns clockwise (as CSS does); arrows ±1°, Shift+arrow ±15°; presets every 45°.
- D22. Preview:
  - Aspect: Free is 2:1 at full width (the contract's "about 2:1"); Banner is 3:1; Custom is 16 to 8192 px per side.
  - Compare stacks the two previews, one above the other at the same width, so positions line up, each labelled. Turning it on picks OKLCH, or OKLab when OKLCH is the main space.
  - Text check: "Aa Sample" at 20 px, White by default (White, Black or a swatch), with the lowest WCAG contrast across the gradient and M3's D7 badge. Alpha is composed over the surround, or over white for Match theme, so the theme never counts (6.2).
  - All preview options are view state: not saved and not in undo.
- D23. Surround colors: Mid-gray #777777 (CIELAB L* 50), White #FFFFFF, Black #000000. Match theme uses `--color-surface-sunken`, as `tokens.css` already notes. The checkerboard uses #FFFFFF and #CCCCCC in 8 px cells. All are new fixed tokens.
- D24. Reset icons (M3 decision 58) appear on every gradient row that differs from its default. The Interpolation options, Geometry and Preview headers show a count and a reset-all.
- D25. Undo: every gradient change is one step, with drags coalesced. Step labels: "Gradient type", "Angle", "Move stop", "Add stop", "Remove stop", "Stop color", "Stop alpha", "Midpoint", "Lock stop", "Interpolation", "Hue", "Easing", "Interpolation options" (reset-all), "Technique", "Shuffle", "Image sample" and so on. Stop selection, preview options and the surround aren't recorded (3.6).
- D26. Export opens on Gradient from the Gradient tab or column 3, which extends M3 decision 56. The Gradient section stays "Coming in a later version" until M5, which uses `bake`, `nativeCss` and `bakedCss`.
- D27. The stop bar always runs left to right along the stop axis, whatever the type and angle. A tap outside every handle's hit area adds a stop.
- D28. The new demo parameters and shots are those listed in "Screens affected" and "Mockup-state additions".
- D29. The Stop sheet's title is "Stop N of M"; the desktop row is labelled "Stop".
- D30. The unlink icon beside the HEX field is the Relink button ("Relink to Swatch 4"), so there is no separate Relink button. It is disabled, with "Swatch removed", when that swatch is gone.

## Decisions (answered by the user, 2026-11-20)

- **Q1a: A.** The technique is live. Stops are rebuilt from it whenever the palette changes (add, remove, reorder, edit, re-extraction, a new image), until you edit a stop by hand. The Technique row then reads "Custom": the stops stay as they are, linked by id, with spec 4.3's delete rule, and a ↺ icon rebuilds them (D19, D20).
- **Q1b: A.** A "Colors" row (All, Most distinct N, Picked) under Technique, for the palette-based techniques. The mockup fixture is Smooth path over swatches 2, 4 and 6.
- **Q2: A.** The preview pins: under the header below 1024 px (at most 30% of the screen height), and at the top of column 3 from 1024 px. The Interpolation options, Stop, Geometry and Preview drawers stop below it, with the `--space-2` gap, and lock the page, as on the Source and Palette tabs. This is recorded as ui-contract D12 in T2.
- **Q3a: A.** The surround applies to the gradient preview's stage and to the image well's background.
- **Q3b: A.** A "Surround" group in the existing theme menu. No new header button.
- **Q3c: A.** An app setting in localStorage, like the theme. It is never read or written in `?demo=mockup`.
- **Q4: B (not the proposed option).**
  - Only the drawn Interpolation and Technique rows (with the technique's parameter rows) are inline.
  - An "Interpolation options" chevron row holds Hue, Easing, Premultiplied and Gamut. It expands in place from 1024 px and is a drawer on phones.
  - The Stop, Geometry and Preview chevron rows follow it.
  - To keep the drawer short:
    - Hue shows only for polar spaces.
    - Premultiplied shows only while a stop has alpha.
    - Gamut shows only while colors fall outside sRGB.
    - Easing always shows.
  - While any option differs from its default, the row's header shows an accent dot and a count, "Interpolation options · N", plus the ↺ reset-all icon (M3 decision 58).
  - This removes the always-visible Easing row that spec 6.6 rule 5's feature budget would have needed to justify.
  - Changed by this answer:
    - T2: the shells, the `interpolation` row id, a `space=` demo parameter, the screens and shots
    - T9, and T10's Gamut test
    - the screens table and the mockup-state additions
    - D12, D24 and D25
- **Q5: A.** Defaults D1 to D30 are accepted.

Notes on spec conflicts, as the plan resolves them:
1. **Image sample from markers (spec 3.7) and M3 decision 65.** Swatches edited by value have no point, so the marker modes skip them (D18).
2. **The Gradient export drawer (spec 6, desktop mockup) and M3 decision 56 (ui-contract D10).** The Export panel's Gradient section replaces the drawer and stays "Coming in a later version" until M5 (spec 9). It opens on Gradient from the Gradient tab or column 3 (D26).
3. **Relink (spec 4.3 "with Relink") and the preference for inline icons.** The unlink icon beside the HEX field is itself the Relink button (D30).
4. **Pinning (M2 decision 19; M3 decisions 33 to 35, 45, 59).** The pattern is extended to the gradient through Q2. Column 3's "GRADIENT" label scrolls away under the pinned preview, as column 2's "PALETTE" label does under the pinned strip, for consistency (noted in the M3 final evaluation).
5. Spec-internal points:
   - **Easing.** Spec 4.1 lists Easing as a gradient type, while 4.3, 7.5 and the contract's three chips treat it as a setting. It is a setting, in Interpolation options.
   - **Compare.** Spec 4.3 says "side-by-side"; the plan stacks the two previews so positions line up (D22).
   - **Premultiplied alpha.** It is a setting in 4.3, but CSS gradients always premultiply. With it off, the preview uses baked stops (D10).
   - **Gradient count.** Spec 7.5 has one `gradient`, while 5.3, 5.5 and 6.5 say "gradients". The plan keeps one per project (D1).
   - **Repeat length** (4.3) belongs to repeating gradients, which are M6.
   - **Feature budget (spec 6.6 rule 5)** is no longer at issue: Q4 B keeps the inline rows to the two drawn ones.
