/**
 * Tapping or focusing the sticky chrome itself never scrolls the page (M2 decision 19; M2 final
 * evaluation failure 1). The focus clearance nudge only serves elements under the chrome.
 */
import { expect, type Page, test } from "@playwright/test";
import { addScrollSpace, demo } from "./helpers/app";

const SIZES = [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
];

const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));
const settle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 50))),
        ),
      ),
  );

async function pressAt(page: Page, selector: string, touch: boolean): Promise<void> {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`No box for ${selector}`);
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await settle(page);
}

for (const size of SIZES) {
  test.describe(`${size.width} × ${size.height}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(demo());
      await addScrollSpace(page);
      await expect(page.locator("[data-testid=strip-dock]")).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 600));
      await settle(page);
      expect(await scrollY(page)).toBe(600);
    });

    const targets = [
      ["a pinned swatch", "[data-testid=strip-dock] .swatch-cell:nth-child(3) [data-swatch]"],
      ["a header button", "header .project-button"],
      ["the active tab", ".tabbar [role=tab][aria-selected=true]"],
    ] as const;
    for (const [name, selector] of targets) {
      test(`pressing ${name} leaves the scroll position alone`, async ({ page }, info) => {
        const touch = Boolean(info.project.use.hasTouch);
        await pressAt(page, selector, touch);
        expect(await scrollY(page)).toBe(600);
      });
    }

    test("Shift+Tab from the first setting row into the strip keeps the strip pinned", async ({
      page,
      browserName,
    }) => {
      // WebKit's Tab skips buttons unless Alt is held.
      const tab = browserName === "webkit" ? "Alt+Tab" : "Tab";
      await page.locator("[data-testid=strip-dock] [data-swatch]").last().focus();
      await page.keyboard.press(tab);
      await settle(page); // let the focus nudge finish before moving the page
      // A focused swatch can shorten the page: scroll as far as it allows.
      await page.evaluate(() => window.scrollTo(0, 600));
      await settle(page);
      const before = await scrollY(page);
      expect(before).toBeGreaterThan(100);
      const rects = () =>
        page.evaluate(() => ({
          dock: Math.round(
            document.querySelector("[data-testid=strip-dock]")?.getBoundingClientRect().top ?? -1,
          ),
          header: Math.round(
            document.querySelector("header")?.getBoundingClientRect().bottom ?? -2,
          ),
        }));
      const pinned = await rects();
      expect(pinned.dock).toBeGreaterThanOrEqual(pinned.header);
      expect(pinned.dock).toBeLessThanOrEqual(pinned.header + 16);
      await page.keyboard.press(`Shift+${tab}`);
      await settle(page);
      const inDock = await page.evaluate(() =>
        Boolean(document.activeElement?.closest("[data-testid=strip-dock]")),
      );
      expect(inDock).toBe(true);
      expect(await rects()).toEqual(pinned);
    });
  });
}
