/**
 * The Source column (ui-contract "Column 1: SOURCE" and phone "Source tab"): image well, view bar,
 * and the setting rows. Below 1024 px the swatch strip sits under the view bar, as in mockup 09,
 * and pins under the header while the setting rows scroll (M2 decision 19; ui-contract D4).
 */
import { useEffect, useRef } from "preact/hooks";
import { outputPalette, progressVisible, viewSettings } from "../state/signals";
import type { ImageViewMode } from "../types";
import { CopyButtons } from "./CopyButtons";
import { comingSoon } from "./comingSoon";
import { ImageMessageBanner, ImageWell } from "./ImageWell";
import { PaletteViewRows, PaletteViewSummary } from "./PaletteViewRows";
import { SettingsControls } from "./SettingsControls";
import { StripMarks } from "./StripMarks";
import { EmptyRolesNote, SwatchStrip } from "./SwatchStrip";
import { ValuesViewRows, ValuesViewSummary } from "./ValuesViewRows";

/** View bar (spec 3.8): Image, Palette and Values switch the view; the grid arrives in M5. */
function ViewBar() {
  const mode = viewSettings.value.mode;
  const segment = (value: ImageViewMode, label: string) => (
    <button
      type="button"
      class="segment"
      aria-pressed={mode === value}
      onClick={() => {
        if (viewSettings.peek().mode !== value) {
          viewSettings.value = { ...viewSettings.peek(), mode: value };
        }
      }}
    >
      {label}
    </button>
  );
  return (
    <div class="view-bar" data-testid="view-bar">
      <fieldset class="segmented">
        <legend class="visually-hidden">Image view</legend>
        {segment("image", "Image")}
        {segment("palette", "Palette")}
        {segment("values", "Values")}
      </fieldset>
      <button
        type="button"
        class="chip"
        aria-pressed="false"
        data-coming-soon=""
        onClick={comingSoon}
      >
        Grid
      </button>
    </div>
  );
}

/**
 * The swatch strip's sticky container below 1024 px (M2 decision 19): it pins just under the
 * header so the result of a setting change stays visible. While pinned it carries `data-stuck`,
 * which draws a divider under it. The page scrolls in the window, so the check runs on its scroll.
 */
function StripDock() {
  const dock = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = dock.current;
    if (!el) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      const top = Number.parseFloat(getComputedStyle(el).top) || 0;
      const stuck = window.scrollY > 0 && el.getBoundingClientRect().top <= top + 0.5;
      el.toggleAttribute("data-stuck", stuck);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);
  return (
    <div ref={dock} class="strip-dock" data-testid="strip-dock">
      <SwatchStrip />
      {/* The strip's marks, such as the Values view's close-pair bracket, pin with it (M3-T2). */}
      <StripMarks />
    </div>
  );
}

/** The rows under the image follow the view (spec 3.8; ui-contract "Image views"). */
function ViewRows() {
  const mode = viewSettings.value.mode;
  if (mode === "palette") return <PaletteViewRows />;
  if (mode === "values") return <ValuesViewRows />;
  return <SettingsControls />;
}

/** The share bar and legend, or the band strip: they sit right under the view bar. */
function ViewSummary() {
  const mode = viewSettings.value.mode;
  if (mode === "palette") return <PaletteViewSummary />;
  if (mode === "values") return <ValuesViewSummary />;
  return null;
}

export function SourcePanel({ variant }: { variant: "desktop" | "phone" }) {
  return (
    <div class="panel" data-panel="source">
      {variant !== "phone" && <h2 class="section-label">Source</h2>}
      <ImageWell />
      {progressVisible.value && (
        <div class="progress" role="progressbar" aria-label="Working on the palette">
          <span class="progress__bar" />
        </div>
      )}
      <ImageMessageBanner />
      <ViewBar />
      <ViewSummary />
      {variant !== "desktop" && outputPalette.value.length > 0 && <StripDock />}
      {variant !== "desktop" && <EmptyRolesNote />}
      {variant === "phone" && outputPalette.value.length > 0 && <CopyButtons />}
      <ViewRows />
    </div>
  );
}
