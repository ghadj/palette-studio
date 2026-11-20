/**
 * The swatch strip's sticky container below 1024 px (M2 decision 19; M3 decision 33): on both the
 * Source and the Palette tab it pins just under the header, so the result of a setting change stays
 * visible, and drawers stop below it (M3 decision 35). While pinned it carries `data-stuck`, which
 * draws a divider under it. The page scrolls in the window, so the check runs on its scroll. Its
 * height goes to `--strip-dock-height` on the root, which `scroll-padding-top` uses so focus and
 * scrollIntoView never leave a control under it (spec 8 v1 acceptance 10).
 *
 * From 1024 px the same container pins at the top of column 2's scroll container (M3 decision 45),
 * and the height goes to that container, whose `scroll-padding-top` uses it.
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
    // On desktop the strip pins inside column 2's own scroll container (M3 decision 45); below
    // 1024 px it pins in the window.
    const column = el.closest<HTMLElement>(".column__scroll");
    const scroller: HTMLElement | Window = column ?? window;
    const target: HTMLElement = column ?? document.documentElement;
    let frame = 0;
    const check = () => {
      frame = 0;
      const top = Number.parseFloat(getComputedStyle(el).top) || 0;
      const scrolled = column ? column.scrollTop > 0 : window.scrollY > 0;
      const edge = column ? column.getBoundingClientRect().top : 0;
      // Column 2 pins flush with its scroll container's edge; the window case pins at `top`.
      const pinned = column ? edge : top;
      const stuck = scrolled && el.getBoundingClientRect().top <= pinned + 0.5;
      el.toggleAttribute("data-stuck", stuck);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    const root = target;
    const measure = () => root.style.setProperty("--strip-dock-height", `${el.offsetHeight}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    check();
    scroller.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--strip-dock-height");
      if (frame) cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", schedule);
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
