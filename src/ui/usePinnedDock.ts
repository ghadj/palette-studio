/**
 * Pins a dock container and tells the page how tall it is (M4 plan T2; the same mechanism as
 * `StripDock`, M2 decision 19 and M3 decisions 33 and 45). Below 1024 px the container is sticky in
 * the window, under the header; from 1024 px it is sticky at the top of its column's scroll
 * container. While pinned it carries `data-stuck`, which draws a divider under it. Its height goes
 * to a custom property (`--dock-height` for the gradient dock), on the root below 1024 px and on the
 * column's scroll container from 1024 px, where `scroll-padding-top` uses it so focus and
 * scrollIntoView never leave a control under the dock.
 */
import type { RefObject } from "preact";
import { useEffect } from "preact/hooks";

export function usePinnedDock(ref: RefObject<HTMLElement | null>, property: string): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const column = el.closest<HTMLElement>(".column__scroll");
    const scroller: HTMLElement | Window = column ?? window;
    const target: HTMLElement = column ?? document.documentElement;
    let frame = 0;
    const check = () => {
      frame = 0;
      const top = Number.parseFloat(getComputedStyle(el).top) || 0;
      const scrolled = column ? column.scrollTop > 0 : window.scrollY > 0;
      const pinned = column ? column.getBoundingClientRect().top : top;
      el.toggleAttribute("data-stuck", scrolled && el.getBoundingClientRect().top <= pinned + 0.5);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    const measure = () => target.style.setProperty(property, `${el.offsetHeight}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    check();
    scroller.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      observer.disconnect();
      target.style.removeProperty(property);
      if (frame) cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ref, property]);
}
