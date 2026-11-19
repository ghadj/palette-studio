/**
 * Keeps the focused control clear of the sticky header, the pinned swatch strip and the fixed tab
 * bar below 1024 px (spec 8 v1 acceptance 10; WCAG 2.2 SC 2.4.11). `scroll-padding` in app.css
 * does this in Chromium; WebKit and Firefox ignore it for focus scrolling, so after focus lands
 * this nudges the page by whatever the chrome still covers.
 */
const PHONE = "(max-width: 1023.98px)";
const GAP = 8;

export function nudgeFocusClear(): void {
  const el = document.activeElement;
  if (!el || el === document.body || !window.matchMedia(PHONE).matches) return;
  const top = ["header", "[data-testid=strip-dock]"].reduce((edge, selector) => {
    const chrome = document.querySelector(selector);
    return chrome ? Math.max(edge, chrome.getBoundingClientRect().bottom) : edge;
  }, 0);
  const tabBar = document.querySelector(".tabbar")?.getBoundingClientRect().top;
  const bottom = tabBar ?? window.innerHeight;
  const r = el.getBoundingClientRect();
  if (r.top < top + GAP) window.scrollBy(0, r.top - (top + GAP));
  else if (r.bottom > bottom - GAP) window.scrollBy(0, r.bottom - (bottom - GAP));
}

export function installFocusClearance(): void {
  // After the browser's own focus scroll, which may come a frame later.
  document.addEventListener("focusin", () => {
    requestAnimationFrame(() => requestAnimationFrame(nudgeFocusClear));
  });
}
