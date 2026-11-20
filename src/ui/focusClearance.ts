/**
 * Keeps the focused control clear of the sticky header, the pinned swatch strip and the fixed tab
 * bar below 1024 px (spec 8 v1 acceptance 10; WCAG 2.2 SC 2.4.11). `scroll-padding` in app.css
 * does this in Chromium; WebKit and Firefox ignore it for focus scrolling, so after focus lands
 * this nudges the page by whatever the chrome still covers.
 */
const PHONE = "(max-width: 1023.98px)";
const GAP = 8;
/** The sticky or fixed chrome itself, and its menus: focus inside never scrolls the page. */
const CHROME = "header, [data-testid=strip-dock], .tabbar, [role=menu], [role=dialog]";

const keyboardFocus = (el: Element): boolean => {
  try {
    return el.matches(":focus-visible");
  } catch {
    return false;
  }
};

/**
 * From 1024 px the strip pins inside column 2's scroll container (M3 decision 45). Firefox and
 * WebKit ignore `scroll-padding` for focus scrolling there too, so scroll that container by
 * whatever the pinned strip still covers.
 */
function nudgeColumnClear(el: Element): void {
  const scroller = el.closest<HTMLElement>(".column__scroll");
  const dock = scroller?.querySelector<HTMLElement>("[data-testid=strip-dock]");
  if (!scroller || !dock || dock.contains(el)) return;
  const covered = dock.getBoundingClientRect().bottom + GAP;
  const r = el.getBoundingClientRect();
  if (r.top < covered) scroller.scrollTop += r.top - covered;
}

export function nudgeFocusClear(): void {
  const el = document.activeElement;
  if (!el || el === document.body) return;
  if (!window.matchMedia(PHONE).matches) {
    nudgeColumnClear(el);
    return;
  }
  // Taps and clicks never scroll, and neither does focus inside the chrome (M2 decision 19).
  if (el.closest(CHROME) || !keyboardFocus(el)) return;
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
  // Chromium's native scroll-padding scrolls when keyboard focus enters the pinned strip. The
  // chrome is already in view, so put the page back where it was when the key went down.
  let keyY = window.scrollY;
  document.addEventListener(
    "keydown",
    () => {
      keyY = window.scrollY;
    },
    true,
  );
  document.addEventListener("focusin", (event) => {
    const target = event.target;
    const inChrome = target instanceof Element && target.closest(CHROME) !== null;
    const restoreY = keyY;
    // After the browser's own focus scroll, which may come a frame later.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (inChrome) {
          if (
            window.matchMedia(PHONE).matches &&
            window.scrollY !== restoreY &&
            keyboardFocus(document.activeElement ?? document.body)
          )
            window.scrollTo(0, restoreY);
        } else nudgeFocusClear();
      }),
    );
  });
}
