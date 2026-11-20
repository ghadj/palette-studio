/**
 * Where a bottom sheet starts when the page has a pinned swatch strip (M3 decision 35). The sheet's
 * dialog takes its top edge from `--sheet-top`, which this sets to the strip dock's bottom edge, so
 * the strip stays visible above the scrim and the panel is sized to the space under it.
 *
 * The dock only pins once the page has scrolled to it, so opening a sheet scrolls the page until
 * the dock sits under the header. If the page is too short to scroll that far, it gets extra room
 * at the bottom (`--sheet-extra`) while the sheet is open. Later scrolls and resizes keep
 * `--sheet-top` in step with the dock.
 */
const DOCK = "[data-testid=strip-dock]";

export function dockSheetBelowStrip(dialog: HTMLElement): () => void {
  const dock = document.querySelector<HTMLElement>(DOCK);
  if (!dock) return lockPage();
  const root = document.documentElement;
  const header = document.querySelector("header");
  const headerBottom = () => header?.getBoundingClientRect().bottom ?? 0;
  const place = () =>
    dialog.style.setProperty("--sheet-top", `${dock.getBoundingClientRect().bottom}px`);

  // Where the page was before the sheet opened; closing puts it back (M3 decision 47).
  const startY = window.scrollY;
  // Bring the dock under the header, adding room below the page if it can't scroll that far.
  const slack = dock.getBoundingClientRect().top - headerBottom();
  if (slack > 0.5) {
    const target = window.scrollY + slack;
    const room = root.scrollHeight - window.innerHeight - target;
    if (room < 0) root.style.setProperty("--sheet-extra", `${Math.ceil(-room)}px`);
    window.scrollTo(0, target);
  }
  place();
  // Only after the page has scrolled to pin the dock: from here on only the sheet scrolls.
  const unlock = lockPage();

  let frame = 0;
  const schedule = () => {
    if (!frame)
      frame = requestAnimationFrame(() => {
        frame = 0;
        place();
      });
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  const observer = new ResizeObserver(schedule);
  observer.observe(dock);
  return () => {
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    observer.disconnect();
    if (frame) cancelAnimationFrame(frame);
    unlock();
    root.style.removeProperty("--sheet-extra");
    window.scrollTo(0, startY);
    // The dialog's own focus return can scroll a frame later.
    requestAnimationFrame(() => window.scrollTo(0, startY));
  };
}

/** The scroll area inside a sheet: the only thing that scrolls while a drawer is open. */
const SHEET_SCROLL = ".bottom-sheet__body";

/**
 * Locks the page while a drawer is open (M3 decision 46), so the sheet is the only scroller. The
 * `sheet-locked` class on the root sets `overflow: hidden` below 1024 px, which keeps the scroll
 * position, with a stable scrollbar gutter so nothing shifts sideways. iOS Safari still scrolls an
 * `overflow: hidden` page on touch, so touchmove outside the sheet's scroll area (or inside one
 * with nothing to scroll) is cancelled here; `overscroll-behavior: contain` on the scroll area
 * stops chaining to the page at its ends.
 */
function lockPage(): () => void {
  const root = document.documentElement;
  root.classList.add("sheet-locked");
  const onTouchMove = (event: TouchEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    const area = target?.closest<HTMLElement>(SHEET_SCROLL);
    if (!area || area.scrollHeight <= area.clientHeight) event.preventDefault();
  };
  document.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
  return () => {
    document.removeEventListener("touchmove", onTouchMove, { capture: true });
    root.classList.remove("sheet-locked");
  };
}
