import { expect, type Page, test } from "@playwright/test";
import { isPhoneProject } from "./helpers/app";
import { fixture } from "./helpers/files";

const strip = (page: Page) => page.locator("[data-testid=swatch-strip]:visible").first();

async function loadTwelve(page: Page) {
  await page.goto("./");
  await page.getByTestId("file-input").setInputFiles(fixture("twelve-colors.png"));
  await expect(strip(page).locator("[data-swatch]")).toHaveCount(6);
  await page.locator("#setting-colors:visible").fill("12");
  await expect(strip(page).locator("[data-swatch]")).toHaveCount(12);
  await expect(page.locator("[data-testid=swatch-strip][data-busy]")).toHaveCount(0);
}

test.describe("palette size and swatch strip layout (decision 13)", () => {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 820, height: 1180 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    test(`12 colors at ${viewport.width} px: no clipping, at most 2 rows, every swatch at least 44 px`, async ({
      page,
    }, info) => {
      test.skip(isPhoneProject(info) && viewport.width >= 1024, "desktop viewport");
      await page.setViewportSize(viewport);
      await loadTwelve(page);
      const container = await strip(page).boundingBox();
      if (!container) throw new Error("no strip");
      const boxes = await strip(page)
        .locator("[data-swatch]")
        .evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          }),
        );
      const rows = new Set(boxes.map((b) => Math.round(b.y)));
      expect(rows.size).toBeLessThanOrEqual(2);
      // Two rows are even: 6 and 6.
      if (rows.size === 2) {
        const [first] = [...rows];
        expect(boxes.filter((b) => Math.round(b.y) === first)).toHaveLength(6);
      }
      for (const b of boxes) {
        expect(b.width).toBeGreaterThanOrEqual(44);
        expect(b.height).toBeGreaterThanOrEqual(44);
        expect(b.x).toBeGreaterThanOrEqual(container.x - 0.5);
        expect(b.x + b.width).toBeLessThanOrEqual(container.x + container.width + 0.5);
        expect(b.x + b.width).toBeLessThanOrEqual(viewport.width);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
    });
  }

  test("Colors runs 2 to 12, and typed values outside that are clamped", async ({ page }) => {
    await page.goto("./");
    const slider = page.locator(".slider:visible").first();
    await expect(slider).toHaveAttribute("min", "2");
    await expect(slider).toHaveAttribute("max", "12");
    const field = page.locator("#setting-colors:visible");
    await expect(field).toHaveAttribute("max", "12");
    await page.getByTestId("file-input").setInputFiles(fixture("twelve-colors.png"));
    await expect(strip(page).locator("[data-swatch]")).toHaveCount(6);
    await field.fill("20");
    await field.press("Enter");
    await expect(field).toHaveValue("12");
    await expect(slider).toHaveValue("12");
    await expect(strip(page).locator("[data-swatch]")).toHaveCount(12);
    await field.fill("1");
    await field.blur();
    await expect(field).toHaveValue("2");
    await expect(strip(page).locator("[data-swatch]")).toHaveCount(2);
  });
});
