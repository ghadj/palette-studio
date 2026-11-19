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
  if (!dock) return () => {};
  const root = document.documentElement;
  const header = document.querySelector("header");
  const headerBottom = () => header?.getBoundingClientRect().bottom ?? 0;
  const place = () =>
    dialog.style.setProperty("--sheet-top", `${dock.getBoundingClientRect().bottom}px`);

  // Bring the dock under the header, adding room below the page if it can't scroll that far.
  const slack = dock.getBoundingClientRect().top - headerBottom();
  if (slack > 0.5) {
    const target = window.scrollY + slack;
    const room = root.scrollHeight - window.innerHeight - target;
    if (room < 0) root.style.setProperty("--sheet-extra", `${Math.ceil(-room)}px`);
    window.scrollTo(0, target);
  }
  place();

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
    root.style.removeProperty("--sheet-extra");
  };
}
