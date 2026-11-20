/**
 * The Cluster map toggle on devices without a fine pointer (M2 decision 13f): it shows at any
 * width, including the desktop layout on an iPad in landscape, under the swatch strip in column 2.
 * A fine-pointer desktop doesn't get it.
 */
import { expect, test } from "@playwright/test";
import { demo } from "./helpers/app";

test.describe("touch-only device in the desktop layout", () => {
  test.use({ hasTouch: true, isMobile: false, viewport: { width: 1180, height: 820 } });

  test("the toggle is under the swatch strip in column 2 and shows the map", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "touch emulation on desktop is Chromium only");
    await page.goto(demo());
    const matches = await page.evaluate(
      () => window.matchMedia("(hover: none), (pointer: coarse)").matches,
    );
    expect(matches).toBe(true);
    const toggle = page.locator("#cluster-map-toggle:visible");
    await expect(toggle).toBeVisible();
    const strip = await page.locator("[data-testid=swatch-strip]:visible").first().boundingBox();
    const box = await toggle.boundingBox();
    if (!strip || !box) throw new Error("no boxes");
    expect(box.y).toBeGreaterThan(strip.y + strip.height - 1);
    expect(box.x).toBeGreaterThanOrEqual(strip.x - 1);
    await toggle.click();
    await expect(page.locator("[data-testid=cluster-overlay]")).toBeVisible();
  });
});

test("a fine-pointer desktop has no toggle", async ({ page, hasTouch }) => {
  test.skip(hasTouch, "needs a fine pointer");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(demo());
  await expect(page.locator("#cluster-map-toggle:visible")).toHaveCount(0);
});
