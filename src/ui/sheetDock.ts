/**
 * Where a bottom sheet starts when the page has a pinned swatch strip (M3 decision 35). The sheet's
 * dialog takes its top edge from `--sheet-top`, which this sets to the strip dock's bottom edge, so
 * the strip stays visible above the scrim and the panel is sized to the space under it, less a
 * `--space-2` gap (`--sheet-gap`, M3 decision 59) so the open drawer doesn't touch the strip.
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
  // The panel starts one space-2 under the dock's bottom border (decision 59); the scrim, which
  // fills the dialog from `--sheet-top`, covers the gap.
  dialog.style.setProperty("--sheet-gap", "var(--space-2)");

  // Where the page was before the sheet opened; closing puts it back (M3 decision 46).
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
const SHEET_PANEL = ".bottom-sheet__panel";
/** Touch targets inside a sheet that own their gesture: a horizontal scroller and a slider. */
const OWN_GESTURE = ".contrast-scroll, input[type=range]";

/**
 * Locks the page while a drawer is open (M3 decision 46), so the sheet is the only scroller. The
 * `sheet-locked` class on the root sets `overflow: hidden` below 1024 px, which keeps the scroll
 * position, with a stable scrollbar gutter so nothing shifts sideways. iOS Safari still scrolls an
 * `overflow: hidden` page on touch, so touchmove outside the open sheet's panel (the pinned strip,
 * the page header, the scrim, the page) is cancelled here. Inside the panel a touchmove is never
 * cancelled, so the contrast matrix pans sideways and sliders follow the finger (M3-F20);
 * `overscroll-behavior: contain` on the scroll area stops chaining to the page at its ends.
 * The one exception is for iOS, which can still chain a vertical drag at the end of a body that
 * cannot scroll that way: a vertical move there is cancelled, unless it starts in a horizontal
 * scroller or on a slider.
 */
export function lockPage(): () => void {
  const root = document.documentElement;
  root.classList.add("sheet-locked");
  let start: { x: number; y: number } | null = null;
  const onTouchStart = (event: TouchEvent) => {
    const t = event.touches[0];
    start = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchMove = (event: TouchEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest(SHEET_PANEL)) {
      event.preventDefault();
      return;
    }
    const area = target.closest<HTMLElement>(SHEET_SCROLL);
    const t = event.touches[0];
    if (!area || !t || !start || target.closest(OWN_GESTURE)) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dy) <= Math.abs(dx)) return;
    const canScrollUp = area.scrollTop > 0;
    const canScrollDown = area.scrollTop + area.clientHeight < area.scrollHeight - 1;
    if ((dy > 0 && !canScrollUp) || (dy < 0 && !canScrollDown)) event.preventDefault();
  };
  const opts = { passive: false, capture: true } as const;
  document.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
  document.addEventListener("touchmove", onTouchMove, opts);
  return () => {
    document.removeEventListener("touchstart", onTouchStart, { capture: true });
    document.removeEventListener("touchmove", onTouchMove, { capture: true });
    root.classList.remove("sheet-locked");
  };
}
