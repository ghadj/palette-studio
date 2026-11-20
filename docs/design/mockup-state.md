# Mockup state

A fixed demo state that reproduces the mockups' content, so screenshots of the real app can be compared with `docs/mockups/`. It is also the standard fixture for end-to-end tests.

## Opening it

`<base>/?demo=mockup` opens the Studio view in the mockup state. Optional parameters:

| Parameter | Values | Effect | Mockups |
| --- | --- | --- | --- |
| `view` | `studio` (default), `materials` | Desktop view to open | `01`, `05` |
| `tab` | `source` (default), `palette`, `gradient`, `materials` | Phone tab to open | `09` |
| `image` | `image` (default), `palette`, `values` | Image view (spec 3.8). Parsed from M3; the view is view state, so nothing stores it | `03`, `11` |
| `grid` | `on` | Turns the transfer grid on | `03`, `11` |
| `library` | `open`, `menu`, `undo` | Opens the library drawer or Projects sheet; `menu` also opens the current project's ⋯ menu; `undo` shows the toast after deleting "Old test" | `07`, `11` |
| `brands` | comma-separated brand names, such as `Brand A,Brand C` | Sets the brand filter on the Materials view | `13` |
| `filters` | `all`, `medium` | Phone only: opens the Filters sheet in the All brands or By medium scope | `13` |
| `zoom` | `2`, `4`, `8` | Opens the image at that zoom, centered on the image (M2 decision 15g). Zoom is view state, so nothing stores it | not drawn |
| `rows` | `filters`, `advanced`, `swatch`, `adjustments`, `ramp`, `contrast`, `cvd`, `interpolation`, `stop`, `geometry`, `preview`, or several comma-separated | Opens chevron rows: Filters and Advanced under the image (M2); Swatch, Adjustments, Contrast and CVD in the Palette column, and the editor's Ramp panel (M3, plan D20); Interpolation options, Stop, Geometry and Preview in the Gradient column (M4). On desktop they expand in place; on phones and tablets the M3 and M4 ones open as bottom sheets, which show on their tab (`tab=palette`, `tab=gradient`) | not drawn |
| `loupe` | `1` to `6` | Shows the loupe over that swatch's marker, as during a drag (spec 3.7, M3 plan D20) | not drawn |
| `gradient` | `linear` (default), `radial`, `conic` | Gradient type (M4) | not drawn |
| `space` | an interpolation space: `srgb`, `srgb-linear`, `display-p3`, `lab`, `oklab` (default), `lch`, `oklch`, `hsl`, `hwb`, `xyz` | Interpolation space (M4) | not drawn |
| `technique` | `palette-order`, `sorted`, `smooth-path`, `image-sample`, `derived`, `random`, `population` | Applies that technique with its defaults: Colors set to All; `image-sample` samples the default line on the fixture; `derived` uses swatch 3 (M4) | not drawn |
| `theme` | `light`, `dark` | Overrides the theme for this page load only | all |

Rules:
- It works in production builds too, since it reads only files bundled with the app. It's not linked from the UI.
- It never reads or writes autosave and never touches IndexedDB or localStorage, so it can't overwrite a user's work or library (spec 5.3, 5.5, 6.2). Its library is an in-memory fixture (below).
- It loads its state directly, without running extraction. Screenshots then don't change when extraction algorithms change. The image views are computed from the fixture image as usual (spec 3.8), so the values below are real assertions.
- The worker prepares `mockup-scene.png` as the image master, without extracting, so the image views can be drawn. The image well still shows the fixture image. There is no cluster map and no `cluster` parameter (ui-contract D13).
- The clock is fixed at 17 November 2026, 12:00 local time, so relative labels such as "Edited yesterday" don't change between runs.
- An "Example data" banner is not shown, so screenshots match. The tab title gets a "(demo)" suffix instead.

## Files

| File | Contents |
| --- | --- |
| `public/samples/mockup-scene.png` | 1600 × 800 image: a neutral background `#ECEAE6`, two soft green and pink blobs, and six solid patches (radius 46 px) in the swatch colors at the marker positions |
| `public/samples/mockup-paints.csv` | 21 fictional demo paints from Brand A to D, in the catalogue schema (spec 13.2). Loaded only in demo mode, never shown in the real catalogue manager |
| `public/samples/mockup-library-shop-shutter.png` | 800 × 400 image for the "Shop shutter" library entry |
| `public/samples/mockup-library-still-life.png` | 800 × 400 image for the "Studio still life" library entry |

## State

**Project:** "Harbor mural", created from `mockup-scene.png`.

**Extraction settings:** algorithm Balanced, 6 colors, working space OKLab. All other settings are at their defaults (spec 2.4).

**Swatches.** Points are normalized image coordinates; the patch under each point has exactly that color. All six have origin extracted, are unlocked, and have the default sample radius.

| # | Hex | Point (x, y) | OKLab L |
| --- | --- | --- | --- |
| 1 | `#E8693A` | 0.204, 0.519 | 0.668 |
| 2 | `#1DB07A` | 0.463, 0.241 | 0.672 |
| 3 | `#14386B` | 0.769, 0.167 | 0.345 |
| 4 | `#D4527F` | 0.380, 0.796 | 0.622 |
| 5 | `#1E8A2E` | 0.889, 0.778 | 0.555 |
| 6 | `#5039B0` | 0.102, 0.185 | 0.445 |

**Populations** (M2 decision 14a): the Palette view's area shares below, 0.832 for swatch 2, 0.147 for swatch 1 and 0.005 for each of swatches 3 to 6, normalized to sum 1 (each divided by 0.999). They are stored with the fixture, not computed, so they don't change with the algorithms.

Swatch 3 is selected, so its marker and swatch show as selected.

**Gradient:**
- Linear at 90° (left to right).
- Stops linked to swatch 2 at 0%, swatch 4 at 50% and swatch 6 at 100%.
- Interpolation OKLab; the technique field shows Smooth path.
- The 50% stop is selected.
- Geometry (M4): angle 90°, ellipse, farthest-corner, center 50% 50%, conic start 0°, reverse and mirror off.
- Interpolation options (M4): OKLab, so Hue stays Shorter and is hidden (OKLab isn't polar); premultiplied on, hidden because no stop has alpha; easing Linear; gamut Reduce chroma, hidden because everything is in gamut. The drawer shows only Easing, and its header has no badge.
- Technique (M4): Smooth path, with Colors set to Picked: swatches 2, 4 and 6. The stops are the technique's output, not stored: the gradient is live, not Custom.
- Stops (M4): swatch 2 at 0%, swatch 4 at 50% and swatch 6 at 100%, all linked, alpha 100%, midpoints 50%, unlocked. The 50% stop is selected.
- Preview (M4): one fixed 2:1 aspect, no surround (ui-contract D14). Compare, the text check, Vision and the aspect control were removed (decision 68); the `compare`, `overlay`, `cvd`, `aspect` and `menu=theme` parameters were removed with them.
- Expected native CSS: `linear-gradient(90deg in oklab, #1DB07A 0%, #D4527F 50%, #5039B0 100%)`. The preview's `data-stops` attribute reads `#1DB07A@0,#D4527F@50,#5039B0@100`: the resolved stops after reverse and mirror, as `HEX@percent` entries (8-digit HEX when a stop is not opaque), with `~percent` entries for midpoints other than 50%, such as `#1DB07A@0,~30,#D4527F@50,#5039B0@100`. The preview also carries `data-type`, `data-angle`, `data-space`, `data-hue`, `data-easing`, `data-render` (`native` or `baked`).

**Image views** (defaults unless the URL says otherwise): Image view, grid off, 5 bands, close-in-value threshold 0.03, Colors from Palette, dither off, 6 squares across, labels on.

**Materials view (paint matching):**
- Scope All brands; mediums Spray and Acrylic on; brand filter All loaded brands.
- Unique paints off, grouping by medium, 3 results per swatch.
- Metric CIEDE2000 with balanced weighting (spec 14.2).

**Library** (in memory, sorted by last edit):

| Project | Image | Last edited | Label shown | Palette |
| --- | --- | --- | --- | --- |
| Harbor mural (current) | `mockup-scene.png` | 17 Nov 2026, 11:59 | Edited just now | the six swatches above |
| Shop shutter | `mockup-library-shop-shutter.png` | 16 Nov 2026, 15:00 | Edited yesterday | `#F2C14E` `#F78154` `#4D9078` `#B4436C` `#5FAD56` `#2F3E46` |
| Studio still life | `mockup-library-still-life.png` | 28 Oct 2026, 10:00 | Edited Oct 28 | `#8C4A2F` `#C9A227` `#3E5641` `#6B4E71` `#D8C3A5` `#2F2F2F` |

Storage used shows as "18 MB" in demo mode. With `library=undo`, a fourth project, "Old test", has just been deleted and its undo toast is showing.

## Expected image views

Computed from `mockup-scene.png` with OKLab nearest-swatch assignment. Assert area shares to ±0.3 percentage points.

**Palette view.** Every pixel takes its nearest swatch. The neutral background and the green blob become swatch 2, and the pink blob becomes swatch 1: the fixture has no neutral swatch, which is the point of the view.

| Swatch | Area share |
| --- | --- |
| 2 `#1DB07A` | 83.2% |
| 1 `#E8693A` | 14.7% |
| 3, 4, 5, 6 | 0.5% each (the patches) |

**Values view, 5 bands.** Bands split OKLab L into equal steps, each shown as the gray at its middle (spec 3.8).

| Band | L range | Gray | What falls in it |
| --- | --- | --- | --- |
| 1 | 0.0 to 0.2 | `#030303` | nothing |
| 2 | 0.2 to 0.4 | `#2E2E2E` | patch 3 |
| 3 | 0.4 to 0.6 | `#636363` | patches 5 and 6 |
| 4 | 0.6 to 0.8 | `#9E9E9E` | patches 1, 2 and 4 |
| 5 | 0.8 to 1.0 | `#DEDEDE` | background and both blobs (96.8% of the image) |

Close in value at 0.03: exactly one pair, swatches 1 and 2 (ΔL 0.004). Swatches 1 and 4 differ by 0.046 and are not flagged.

**Transfer grid.** 6 squares across a 2:1 image gives 6 × 3 square cells, labeled A to F across the top and 1 to 3 down the side.

## Expected matches

These values come from the CSV, with ΔE00 computed by a reference CIEDE2000 implementation that reproduces the Sharma test pairs. Use them as end-to-end assertions. Labels follow spec 14.3.

| Swatch | Rank 1 | Rank 2 | Rank 3 |
| --- | --- | --- | --- |
| 1 `#E8693A` | Brand A spray `A-101` `#EA6B3B` 0.64 Exact | Brand B spray `B-101` `#E46437` 1.48 Very close | Brand C acrylic `C-101` `#EF7049` 3.01 Close |
| 2 `#1DB07A` | Brand A spray `A-202` `#28B47E` 1.25 Very close | Brand C acrylic `C-202` `#1FAC71` 1.83 Very close | Brand B acrylic `B-202` `#28BB80` 3.19 Close |
| 3 `#14386B` | Brand C acrylic `C-303` `#1B3C70` 1.37 Very close | Brand A spray `A-303` `#083D7A` 2.62 Close | Brand B spray `B-303` `#0B2D5A` 3.79 Close |
| 4 `#D4527F` | Brand B acrylic `B-404` `#D75481` 0.83 Exact | Brand A spray `A-404` `#D3477A` 2.23 Close | Brand C acrylic `C-404` `#DE5878` 4.48 Close |
| 5 `#1E8A2E` | Brand A spray `A-505` `#258E31` 1.52 Very close | Brand C acrylic `C-505` `#288228` 2.91 Close | Brand B spray `B-505` `#2C8A04` 4.57 Close |
| 6 `#5039B0` | Brand C acrylic `C-606` `#553CB4` 1.18 Very close | Brand B acrylic `B-606` `#4A32A6` 2.34 Close | Brand A spray `A-606` `#5B42A4` 3.68 Close |

Three distractor paints are closer than rank 1 and must not appear with the default filters. Each one tests a filter:

| Paint | Near swatch | ΔE00 | Hidden because |
| --- | --- | --- | --- |
| Brand D oil `D-101` `#E96A3B` | 1 | 0.31 | the Oil chip is off (spec 14.1) |
| Brand D wall-paint `D-302` `#113769` | 3 | 0.47 | the Wall paint chip is off (spec 14.1) |
| Brand A spray metallic `A-207` `#1CAF7A` | 2 | 0.35 | special finishes are excluded by default (spec 14.5) |

Turning on Oil makes `D-101` rank 1 for swatch 1, which is a useful end-to-end check that filters work.

**With `brands=Brand A,Brand C`** (`13`, left phone): the brand control reads "2 brands", and Brand B drops out. Swatch 1 shows `A-101` Exact, then `C-101` Close; swatch 2 shows `A-202` Very close, then `C-202` Very close.

**Filters sheet counts** (`13`). Counts are paints in the loaded catalogues for each selected medium, before the other filters:

| Brand | Spray | Acrylic | In the sheet |
| --- | --- | --- | --- |
| Brand A | 7 | 0 | "Spray 7" |
| Brand B | 3 | 3 | "Spray 3 · Acrylic 3" |
| Brand C | 0 | 6 | "Acrylic 6" |
| Brand D | 0 | 0 | disabled, "Oil, wall paint" |

In the By medium scope (`filters=medium`), the mockup shows Spray with Brand A on and Brand B off, and Acrylic with Brand B and Brand C on.

ΔE00 can come out a few hundredths different, depending on rounding inside the conversion. Assert the ranking and the labels exactly, and the ΔE00 values to ±0.05.
