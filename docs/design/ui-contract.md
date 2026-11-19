# UI contract

This turns the mockups in `docs/mockups/` into checkable rules. The implementer builds from it, and the evaluator checks screenshots against it region by region.

**Precedence:**
- For behavior and content, `docs/SPEC.md` wins.
- For layout, order, hierarchy and look, this contract wins, and the mockups illustrate it.
- If the spec and this contract disagree, stop and ask.

**The mockups are scaled drawings, not pixel specs.** Match their structure, proportions and order. Take sizes from `tokens.css`, not by measuring the images. The source image, swatch colors, project names and brand names in the mockups are placeholders. The mockup state (`mockup-state.md`) reproduces them so screenshots are comparable.

**Where features go.** Spec 6.6 sets the rules: features attach to what they act on, options show only when they apply, the header holds only global actions, one emphasis per region, and desktop columns and phone tabs hold the same controls in the same order.

| File | Shows |
| --- | --- |
| `01`, `02` | Desktop Studio view, light and dark |
| `03`, `04` | Desktop image views: Palette view, Values view, transfer grid |
| `05`, `06` | Desktop Materials view (Part 2) |
| `07`, `08` | Desktop project library drawer |
| `09`, `10` | Phone: Source, Gradient and Materials tabs |
| `11`, `12` | Phone: Values view with the grid, Palette view, Projects sheet |
| `13`, `14` | Phone: Materials tab with a brand filter, Filters sheet in two scopes |
| `15` | Architecture diagram (not a screen) |

The italic notes under the columns of `03` and `04` explain the fixture. They are not UI.

## Header (every screen)

**Desktop** (`01`, `05`, `07`). One row, `--header-height`, with a `--color-divider` rule below. Left to right:
1. An accent dot and the app name (`--text-md`, strong).
2. A muted "/" and the current project's name in text color, with a small chevron. It is a button that opens the project library (spec 5.5). While the library is open it shows `--color-surface-sunken` behind it and the chevron points up (`07`).
3. View tabs: Studio and Materials. The active tab is strong, with a 2 px accent underline the width of its label; the inactive tab is muted.
4. A Replace image icon button (shown once an image is loaded; it opens a menu with Choose image, Paste and the sample images), then text buttons in muted `--text-sm`: Undo, Redo, Share. There is no Save button, because every project autosaves (spec 5.3, 5.5).
5. The theme button, far right: a pill with a half-filled circle icon.

**Phone** (`09`). The project name (strong) with its chevron on the left; it opens the Projects sheet. On the right, icon buttons for Replace image (once an image is loaded), Undo, Redo and Share, then the theme button (icon only). The app name isn't shown on phones.

**Theme button behavior (interpretation of spec 6.2).** It opens a small menu with System, Light and Dark. The icon shows the current choice: half-filled for System, sun for Light, moon for Dark.

## Desktop Studio view (`01` light, `02` dark)

A frame below the header holds three equal columns with a `--space-4` gutter, then an export drawer across the full width. Each column starts with an uppercase muted section label at `--text-xs`.

**Column 1: SOURCE**
1. Image well: the image, `--radius-card`, with a `--color-border` outline. The image is user content and keeps its own colors in both themes. Sample-point markers sit on it. Each is the swatch color inside a dark inner ring and a light outer ring; the selected marker has an accent ring instead.
2. View bar (spec 3.8), one row directly under the image:
   - a segmented control with Image, Palette and Values; the selected segment looks like a selected chip
   - a Grid toggle button on the right, styled as a chip (on: accent-soft fill and accent outline)
3. Hint, muted `--text-xs`: "Drag a marker to resample". Shown only in the Image view with the grid off.
4. Setting rows for the current view: a muted label on the left and the value in text color on the right, each row separated by a divider. In the Image view: Algorithm, Colors, Working space. The other views swap these rows (see Image views below).

**Column 2: PALETTE**
1. Swatch strip: the swatches in one row, filling the column width, `--radius-swatch`. The selected swatch has a 2 px text-color outline with a small gap.
2. A muted label naming the selection, such as "Swatch 3".
3. L, C and H sliders: a muted letter label, a thin divider-colored track and a round accent thumb.
4. One row with the HEX input (`--radius-input`, control border) on the left, then pill buttons Lock and Ramp.
5. Chevron rows, each with a label in text color, a chevron on the right and dividers between: Adjustments, Contrast and CVD. They expand in place on desktop and open a sheet on phones.

**Column 3: GRADIENT**
1. Gradient preview, `--radius-card`, full column width, about 2:1.
2. Segmented chips: Linear, Radial, Conic. The selected chip has `--color-accent-soft` fill, an accent outline and strong text.
3. Stop bar: a thin rounded bar showing the gradient, with round stop handles in each stop's color. The selected handle has an accent ring.
4. Setting rows as in column 1: Interpolation, Technique.

**Export drawer.** A divider above it. Two halves split by a vertical divider. Each half has a strong title ("Palette export", "Gradient export") followed by its formats in muted text. The halves stay separate (spec 5).

## Image views (`03` light, `04` dark)

Each column of `03` is the SOURCE column of the Studio view in a different state. Only the image and the rows under the view bar change; nothing else on the screen moves.

**Palette view** (left)
1. The image redrawn in palette colors only, flat, no markers.
2. View bar with Palette selected.
3. Area-share bar: a thin full-width bar split into the palette colors by their share of the image, largest first.
4. Legend under it: a small color square and the percentage for each color, largest first. Colors with equal small shares may share one entry ("0.5% each").
5. Rows: Colors from (value "Palette", or "Matched paints"), then Dither with a toggle on the right (off).

**Values view** (middle)
1. The image in gray bands, no markers.
2. View bar with Values selected.
3. Band strip: one block per band, dark to light, with "Dark" and "Light" in muted text under its ends. It has a `--color-border` outline because its lightest band is close to the surface.
4. Rows: Bands (value "5"), then Close in value with a warn dot and the count ("1 pair").
5. Under the rows, each flagged pair: its two swatch chips, then muted text such as "Swatch 1 and 2, ΔL 0.004".
6. On the swatch strip (column 2 on desktop, the strip on the phone's Source tab), the flagged pair is marked by a warn-colored bracket under the two swatches, with "Close in value" beside it in muted text (`11`).

**Transfer grid** (right)
1. The image in the Image view, with grid lines over it and no markers. Lines are dark or light to suit the image (spec 3.8), not the theme.
2. Labels inside the image edges: letters at the top of each column of squares, numbers at the left of each row.
3. View bar with Image selected and Grid on.
4. Hint, muted: "Markers hide while the grid is on".
5. While the grid is on, its rows replace the view's rows: Squares across (value "6"), Labels (value "Letters and numbers"). Then a pill button "Export grid" with "PNG or PDF" in muted text beside it.

## Desktop Materials view (`05` light, `06` dark)

Below the header: a narrow scope column, a vertical divider, a wide results area, and an action bar across the bottom.

**Scope column**
1. SCOPE label, then radio options: Single brand, All brands, By medium, My paints.
2. MEDIUM label, then medium chips that wrap: Spray, Wall paint, Acrylic, Oil. Several can be selected.
3. Brand select, full width, such as "All loaded brands".
4. "Unique paints" with a toggle on the right.

**Results**
1. A header row with RESULTS on the left and the grouping selector ("Group by medium") on the right.
2. One row per swatch: the swatch chip (`--radius-swatch`), then K match cards (default 3) left to right in rank order. Each card (`--radius-card`) holds:
   - a split chip: original color beside paint color
   - brand, strong
   - medium, muted
   - a quality dot (good or warn) with its label: Exact, Very close or Close
   - The best match has an accent outline.

**Action bar.** A divider above it.
- Left: the primary pill button "Snap to paint" (accent-soft fill, accent outline, strong text) and a muted hint.
- Right: the paint export formats in muted text.

## Desktop project library (`07` light, `08` dark)

The library opens as a drawer from the left edge, under the header, when the project name is clicked. The rest of the screen sits under `--color-scrim`. Clicking the scrim, the close button or the project name again closes it.

1. Title "Projects" (`--text-md`, strong) with a close button on the right.
2. Search field, full width, with a search icon and the placeholder "Search projects".
3. A row of buttons: "New project" (primary) and "Import file" (pill).
4. The project list, sorted by last edit. Each entry:
   - a thumbnail: the project's image with its palette strip along the bottom edge
   - the name, strong; under it "Edited …" in muted text
   - a ⋯ button on the right that opens the project menu
   - The current project sits on `--color-surface-sunken`.
5. Footer, under a divider: muted text saying where the library lives and the space used, such as "Kept in this browser only · 18 MB used".

**Project menu.** A popover next to the ⋯ button, on `--color-surface` with a `--color-border` outline: Rename, Duplicate, Export file, a divider, then Delete.

## Phone (`09` light, `10` dark)

A header at the top, one panel at a time, and a bottom tab bar: Source, Palette, Gradient, Materials. The active tab label is strong, with a 2 px accent indicator above it. The tab bar clears the home indicator (spec 6.1).

**Source tab**
1. Image well with markers.
2. The view bar, as on desktop.
3. The hint (Image view only).
4. The swatch strip, with the selection outlined. It is a compact view of the palette, so the result stays visible while markers move; tapping a swatch selects its marker. Editing happens on the Palette tab. Below 1024 px it shows only the swatches: the "+" tile and the close-pair mark are on the Palette tab (M3 decision 32). The Values view's "Close in value" bracket stays here.
5. Setting rows for the current view. In the Image view: Algorithm, Colors, Working space. Below 1024 px the Filters and Advanced rows are chevron rows that open bottom-sheet drawers, like the Palette tab's (M3 decision 34); Preset, Algorithm, Colors and Working space stay inline. Below 1024 px each row has `--space-2` of padding above and below, so the 44 px controls don't fill the row from divider to divider (M2 decision 21). Row labels, toggle rows, chevron-row titles and plain-text values use `--text-row-touch` (15 px), on any touch device too (decision 22).

**Palette tab.** Not drawn. Use the desktop palette column stacked vertically (the swatch strip, then the editor), with the chevron rows opening bottom sheets. The strip, with the "+" tile and the close-pair mark under it, pins under the header like the Source tab's (M3 decision 33).

**Drawers on both tabs.** A bottom sheet opened on the Source or Palette tab stops under the pinned swatch strip: its top edge is at or below the strip's bottom, the scrim starts there, and the sheet is sized to the space between the strip and the bottom edge and scrolls inside. The palette colors stay visible and update while a setting changes (M3 decision 35).

**Gradient tab.** Preview, type chips, stop bar, then the Interpolation and Technique rows.

**Materials tab**
1. Medium chips that wrap: Spray, Wall paint, Acrylic on the first row, Oil on the second.
2. The brand control, on the right of the second row: a select-style button showing the brand choice ("All brands", or "2 brands" once filtered). It opens the Filters sheet. While a brand filter is set it looks like a selected chip (`13`).
3. For each swatch: a small swatch chip with its label, then full-width match cards stacked.
4. Each card has the split chip, the brand in strong text, and a muted line with the quality dot, medium and quality.

## Phone features (`11` light, `12` dark)

**Values view with the grid** (left). The Source tab with Values selected and Grid on: gray bands under grid lines, letters and numbers inside the image edges, the close pair marked on the swatch strip, and the grid's rows (Squares across, Labels, then Export grid with "PNG or PDF").

**Palette view** (middle). The Source tab with Palette selected: the palette-colored image, the area-share bar and legend in place of the hint, the swatch strip, then Colors from and Dither.

**Projects sheet** (right). A bottom sheet from the project name, over `--color-scrim`. The header behind it shows the chevron pointing up.
1. A grabber, then "Projects" (`--text-md`, strong) with "New project" (primary) on the right.
2. A row with the search field and an "Import" pill button.
3. Project entries as on desktop: thumbnail, name, "Edited …", ⋯ button; the current one on `--color-surface-sunken`.
4. Footer in muted text: "This browser only · 18 MB used".
5. After a delete, a toast near the bottom: inverse colors (`--color-surface-inverse`, `--color-text-inverse`), the message on the left and an "Undo" text button on the right in `--color-accent-inverse`.

## Phone paint filters (`13` light, `14` dark)

**Materials tab with a brand filter** (left). As the Materials tab above, with the brand control showing "2 brands" and the results limited to those brands.

**Filters sheet** (middle: All brands scope; right: By medium scope). A tall bottom sheet over `--color-scrim`. The medium chips stay on the tab; the sheet holds the rest.
1. A grabber, then "Filters" (`--text-md`, strong) with a muted "Reset" text button on the right.
2. Muted label "Scope", then a 2 × 2 segmented control: Single brand, All brands, By medium, My paints. The selected option looks like a selected chip.
3. A search field: "Search brands".
4. The brand list:
   - **All brands:** one row per brand, divided by rules: a checkbox, the brand name, and on the right in muted text the number of its paints in each selected medium ("Spray 3 · Acrylic 3"). A brand with no paints in the selected mediums is disabled: muted name, a disabled checkbox and its mediums on the right ("Oil, wall paint").
   - **Single brand:** the same list with a single choice.
   - **By medium:** one section per selected medium, headed by its name in uppercase muted `--text-xs`, listing the brands with paints in it ("7 paints"). Each medium has its own checkboxes.
5. A divider, then a chevron row "More filters" (series, finish, opacity, discontinued, metric, results per swatch, unique paints, ΔE threshold).
6. A full-width primary button "Show results" at the bottom. It closes the sheet; so do a downward swipe and a tap on the scrim. Choices are kept either way.

## Tablet (601 to 1023 px)

Not drawn. Follow spec 6.1: the phone layout, wider. The phone header, one panel at a time and the bottom tab bar with Source, Palette, Gradient and Materials. The panel content is centered at a readable maximum width; the header, footer rule and tab bar span the full width. Phones in landscape use this layout too. It's reviewed against this contract's text only.

## Components

| Component | Look | States to show |
| --- | --- | --- |
| Swatch | `--radius-swatch`, no border | default, selected (2 px text-color outline with gap), focus |
| Marker | swatch color, inner dark ring, outer light ring; 44 px hit area | default, selected (accent ring), dragging (loupe shown) |
| Chip | pill, `--text-sm` | off (control border), on (accent-soft fill, accent outline, strong) |
| Segmented control | pill outline in control border; the selected segment drawn as a selected chip | each segment selected, focus |
| Toggle | pill track with control border, round thumb | off, on, disabled, focus |
| Checkbox | `--radius-input`, control border | off, on (accent fill, check in surface color), disabled (sunken fill, divider border) |
| Pill button | pill, control border, `--text-sm` | default, hover, pressed, disabled, focus |
| Primary button | pill, accent-soft fill, 2 px accent outline, strong | default, pressed, disabled, focus |
| Select button | `--radius-input`, control border, chevron on the right | default, filtered (accent-soft fill, accent outline, strong), focus |
| Setting row | muted label left, value right, divider below. Below 1024 px: `--space-2` padding above and below (decision 21). Under `(max-width: 1023.98px), (pointer: coarse)`: label and plain-text value at `--text-row-touch`, 15 px; fields stay at `--text-input-touch`, 16 px (decision 22). Desktop with a fine pointer is unchanged at 13 px. Label (or label group with its note) and value stay on one line, vertically centered: the label wraps first (minimum 96 px), then a slider shrinks (to 64 px), and only if that fails does the value wrap below, right-aligned (decision 23) | default, focus |
| Chevron row | label left, chevron right, divider below | collapsed, expanded |
| Slider | divider-colored track, accent thumb, number field beside it on phones | default, dragging, focus |
| Stop handle | stop color, light ring | default, selected (accent ring), dragging |
| Match card | `--radius-card`, border | default, best (accent outline), hover, focus |
| Tab | `--text-sm` | inactive (muted), active (strong, accent indicator) |
| Theme button | pill, icon only, labelled for screen readers | System, Light, Dark |
| Area-share bar | thin bar of palette colors, no radius, legend below | — |
| Band strip | one block per band, `--color-border` outline | 3 bands, 5 bands |
| Grid overlay | 1 px lines and labels over the image, dark or light to suit it | on |
| Library entry | thumbnail, name, "Edited …", ⋯ button | default, current (sunken fill), focus |
| Drawer (desktop) | `--color-surface`, `--color-border` edge, over `--color-scrim` | open |
| Bottom sheet (phone) | `--color-surface`, `--radius-panel` top corners, grabber, over `--color-scrim` | open, dragging |
| Menu popover | `--color-surface`, `--color-border`, `--radius-swatch` | open, item focus |
| Toast | inverse surface and text, action in `--color-accent-inverse` | shown |

Focus is always visible: a 2 px accent ring with a small offset.

## Intended deviations from the mockups

Visual review treats these as correct.

- **D1, gradient angle.** The phone mockup draws the preview diagonally and the desktop horizontally. Both show the same gradient: whatever angle the state holds (90° in the mockup state).
- **D2, desktop split chips.** The desktop match cards (`05`, `06`) draw the paint half of the split chip as a slightly darker shade of the swatch. Build it from the paint's own hex, as the phone mockups do (the hexes are in `mockup-state.md`).
- **D3, type sizes on phones.** To fit the scaled frames, the phone mockups use type smaller than `--text-xs` in places (tab labels, the view bar, counts in the Filters sheet). Use the type tokens; the 44 px touch targets win over matching the drawing.
- **D4, sticky swatch strip on phone and tablet.** The mockups draw an unscrolled page; below 1024 px the Source tab's swatch strip pins under the header while the setting rows scroll, on an opaque `--color-surface` container with a `--color-border` divider while pinned (M2 decision 19).

- **D5, drawers under the strip, and the Palette tab's pinned strip.** The mockups draw sheets that rise from the bottom over the page and a Source tab with inline Filters and Advanced rows. Below 1024 px those two rows open as bottom sheets, a sheet on the Source or Palette tab stops under the pinned swatch strip so the palette stays visible, and the Palette tab's strip pins like the Source tab's (M3 decisions 33 to 35).
- **D6, the Source tab's strip shows only swatches.** Below 1024 px the "+" tile and the close-pair mark are on the Palette tab, not the Source tab (M3 decision 32). On desktop, where the strip is in column 2, nothing changes.
- **D7, the image toolbar sits under the well.** The image well's controls never cover image content (M3 decision 42). A slim toolbar row sits directly under the well, above the view bar: Markers and Eyedropper on the left (Image view only), Zoom out, Fit and Zoom in on the right (every view). On phones it scrolls with the Source tab's content and fits at 320 px. The eyedropper hint row stays below it. Targets are `--hit` (44 px on touch).

Earlier deviations from the previous version of the mockups (control borders, phone Undo and Redo, quality dots on phone cards, all four medium chips) are now drawn in the mockups.

## Not drawn: build from the spec, then flag for design review

- Bottom sheets on phones for the swatch editor, adjustments, ramps and export
- Export panels, target presets and the stop sheet (5.4)
- Empty, loading and error states (6.3)
- The Share popover, and the shared-link banner with Save to library (6.5, 5.5)
- Region of interest, zoom and the cluster map (2.6)
- Gradient geometry controls: angle dial, center, shape (4.3)
- The catalogue manager and import wizard (15)
- The shortcut sheet (6)
- Tablet layout
- Library dialogs: rename, delete confirmation, the storage warning and the empty library (5.5)
- Grid export options: PNG size and PDF paper (3.8)
- Values view with 3 bands or continuous; Palette view with dither on or with Matched paints (3.8)
- The contents of More filters, and the Single brand and My paints scopes on phones (15)

The evaluator lists every one of these a milestone touches as a manual design check.
