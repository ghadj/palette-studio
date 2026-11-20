/**
 * The Cluster map toggle on devices without a fine pointer (M2 decision 13f): it is reachable at
 * any width, including the desktop layout on an iPad in landscape. Since M3-T2 it lives in the
 * Swatch row (decision 13d), which expands in place in column 2 under the swatch strip. A
 * fine-pointer desktop has it there too (M3-T4, D21).
 */
import { expect, test } from "@playwright/test";
import { demo } from "./helpers/app";

test.describe("touch-only device in the desktop layout", () => {
  test.use({ hasTouch: true, isMobile: false, viewport: { width: 1180, height: 820 } });

  test("the toggle is in the Swatch row, under the swatch strip in column 2, and shows the map", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "touch emulation on desktop is Chromium only");
    await page.goto(demo());
    const matches = await page.evaluate(
      () => window.matchMedia("(hover: none), (pointer: coarse)").matches,
    );
    expect(matches).toBe(true);
    // The Swatch row is a plain button, reachable without hover; it expands in place.
    const row = page
      .locator("[data-panel=palette]")
      .getByRole("button", { name: "Swatch", exact: true });
    await expect(row).toHaveAttribute("aria-expanded", "false");
    await row.click();
    await expect(row).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const toggle = page.locator("#cluster-map-toggle:visible");
    await expect(toggle).toBeVisible();
    await expect(page.getByTestId("row-swatch").locator("#cluster-map-toggle")).toHaveCount(1);
    const strip = await page.locator("[data-testid=swatch-strip]:visible").first().boundingBox();
    const box = await toggle.boundingBox();
    if (!strip || !box) throw new Error("no boxes");
    expect(box.y).toBeGreaterThan(strip.y + strip.height - 1);
    expect(box.x).toBeGreaterThanOrEqual(strip.x - 1);
    await toggle.click();
    await expect(page.locator("[data-testid=cluster-overlay]")).toBeVisible();
  });
});

test("a fine-pointer desktop has the toggle in the Swatch row too (D21)", async ({
  page,
  hasTouch,
}) => {
  test.skip(hasTouch, "needs a fine pointer");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(demo());
  // Hidden until the Swatch row opens: hover shows the map there (spec 2.6), the toggle is the
  // same path without hover.
  await expect(page.locator("#cluster-map-toggle:visible")).toHaveCount(0);
  await page
    .locator("[data-panel=palette]")
    .getByRole("button", { name: "Swatch", exact: true })
    .click();
  await expect(page.getByTestId("row-swatch")).toBeVisible();
  await expect(page.locator("#cluster-map-toggle:visible")).toHaveCount(1);
  await page.locator("#cluster-map-toggle").click();
  await expect(page.locator("[data-testid=cluster-overlay]")).toBeVisible();
});
