/**
 * The Ramp bottom sheet never crops its content (M3-F28): every tile, and its focus ring, sits
 * inside the sheet body's clip box, with no horizontal page scroll.
 */
import { expect, type Page, test } from "@playwright/test";
import { demo } from "./helpers/app";
import { sheetSettled } from "./helpers/sheet";

const RING = 4; // the focus ring: a 2 px outline with a 2 px offset (app.css :focus-visible)

async function openRamp(page: Page): Promise<void> {
  await page.goto(demo("tab=palette"));
  await page
    .locator("[data-testid=swatch-strip]:visible")
    .first()
    .locator("[data-swatch]")
    .first()
    .click();
  await page
    .locator("[data-panel=palette]")
    .getByRole("button", { name: "Ramp", exact: true })
    .click();
  await sheetSettled(page);
}

for (const scheme of ["light", "dark"] as const) {
  for (const width of [320, 390, 820]) {
    test(`ramp sheet is not cropped at ${width} px, ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: 800 });
      await openRamp(page);
      const body = page.getByRole("dialog").locator(".bottom-sheet__body");
      const clip = await body.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, scrollLeft: el.scrollLeft };
      });
      expect(clip.scrollLeft).toBe(0);
      const tiles = page.getByRole("dialog").locator("[data-testid=ramp-tile]");
      const n = await tiles.count();
      expect(n).toBeGreaterThan(11);
      const boxes = await tiles.evaluateAll((els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect();
          return { left: r.left, right: r.right };
        }),
      );
      for (const b of boxes) {
        expect(b.left - RING).toBeGreaterThanOrEqual(clip.left - 1);
        expect(b.right + RING).toBeLessThanOrEqual(clip.right + 1);
      }
      const noScroll = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      );
      expect(noScroll).toBe(true);
    });
  }
}
