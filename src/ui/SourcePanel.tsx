/**
 * The Source column (ui-contract "Column 1: SOURCE" and phone "Source tab"): image well, view bar,
 * and the setting rows. Below 1024 px the swatch strip sits under the view bar, as in mockup 09,
 * and pins under the header while the setting rows scroll (M2 decision 19; ui-contract D4).
 */
import { useEffect, useRef } from "preact/hooks";
import { outputPalette, progressVisible } from "../state/signals";
import { CopyButtons } from "./CopyButtons";
import { comingSoon } from "./comingSoon";
import { ImageMessageBanner, ImageWell } from "./ImageWell";
import { SettingsControls } from "./SettingsControls";
import { StripMarks } from "./StripMarks";
import { EmptyRolesNote, SwatchStrip } from "./SwatchStrip";

/** View bar (spec 3.8): the views and the grid arrive in M3 and M5; Image is the current view. */
function ViewBar() {
  return (
    <div class="view-bar" data-testid="view-bar">
      <fieldset class="segmented">
        <legend class="visually-hidden">Image view</legend>
        <button type="button" class="segment" aria-pressed="true">
          Image
        </button>
        <button
          type="button"
          class="segment"
          aria-pressed="false"
          data-coming-soon=""
          onClick={comingSoon}
        >
          Palette
        </button>
        <button
          type="button"
          class="segment"
          aria-pressed="false"
          data-coming-soon=""
          onClick={comingSoon}
        >
          Values
        </button>
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
      {variant !== "desktop" && outputPalette.value.length > 0 && <StripDock />}
      {variant !== "desktop" && <EmptyRolesNote />}
      {variant === "phone" && outputPalette.value.length > 0 && <CopyButtons />}
      <SettingsControls />
    </div>
  );
}
