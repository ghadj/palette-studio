/**
 * The swatch strip's sticky container below 1024 px (M2 decision 19; M3 decision 33): on both the
 * Source and the Palette tab it pins just under the header, so the result of a setting change stays
 * visible, and drawers stop below it (M3 decision 35). While pinned it carries `data-stuck`, which
 * draws a divider under it. The page scrolls in the window, so the check runs on its scroll. Its
 * height goes to `--strip-dock-height` on the root, which `scroll-padding-top` uses so focus and
 * scrollIntoView never leave a control under it (spec 8 v1 acceptance 10).
 *
 * `host` says which tab it sits on. The "+" tile, the 12-color note and the close-pair mark belong
 * to the Palette tab (M3 decision 32); the Source tab's strip shows only the swatches, and the
 * Values view's own "Close in value" bracket.
 */
import { useEffect, useRef } from "preact/hooks";
import { StripMarks } from "./StripMarks";
import { SwatchStrip } from "./SwatchStrip";

export function StripDock({ host }: { host: "source" | "palette" }) {
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
    const root = document.documentElement;
    const measure = () => root.style.setProperty("--strip-dock-height", `${el.offsetHeight}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    check();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--strip-dock-height");
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);
  const palette = host === "palette";
  return (
    <div ref={dock} class="strip-dock" data-testid="strip-dock" data-host={host}>
      <SwatchStrip showAdd={palette} />
      {/* The strip's marks pin with it (M3-T2); the close-pair mark is the Palette tab's. */}
      <StripMarks closePairs={palette} />
    </div>
  );
}
