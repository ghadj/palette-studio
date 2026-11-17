import { expect, test } from "@playwright/test";
import { box, demo, tokenColor } from "./helpers/app";

const LICENSE = "https://github.com/ghadj/palette-studio/blob/main/LICENSE";
const REPO = "https://github.com/ghadj/palette-studio";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "phone", width: 390, height: 844 },
];

test.describe("footer (spec 7.8, 7.10; M1 decision 8)", () => {
  test("footer shows the no-upload statement, an MIT licence link to https://github.com/ghadj/palette-studio/blob/main/LICENSE and a GitHub link to https://github.com/ghadj/palette-studio, at desktop, tablet and phone widths", async ({
    page,
  }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      for (const path of [demo(), "./"]) {
        await page.goto(path);
        const footer = page.getByRole("contentinfo");
        await footer.scrollIntoViewIfNeeded();
        await expect(footer).toBeVisible();
        await expect(footer).toContainText(/never leave/i);
        await expect(footer).toContainText(/uploaded/i);
        await expect(footer.getByRole("link", { name: /MIT/ })).toHaveAttribute("href", LICENSE);
        await expect(footer.getByRole("link", { name: /GitHub/ })).toHaveAttribute("href", REPO);
      }
    }
  });

  test("footer uses tokens only and sits after the last panel content (desktop: below the export drawer; phone: end of each tab's scroll area, above the tab bar)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(demo());
    const footer = page.getByRole("contentinfo");
    const muted = await tokenColor(page, "--color-text-muted");
    const text = await tokenColor(page, "--color-text");
    expect(await footer.evaluate((el) => getComputedStyle(el).color)).toBe(muted);
    expect(await footer.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      "rgba(0, 0, 0, 0)",
    );
    for (const link of await footer.getByRole("link").all()) {
      expect(await link.evaluate((el) => getComputedStyle(el).color)).toBe(text);
      expect(await link.evaluate((el) => getComputedStyle(el).fontSize)).toBe("12px");
    }
    const drawer = await box(page, "[data-testid=export-drawer]");
    const foot = await box(page, "footer");
    expect(foot.y).toBeGreaterThanOrEqual(drawer.y + drawer.height);

    await page.setViewportSize({ width: 390, height: 844 });
    for (const tab of ["source", "palette", "gradient", "materials"]) {
      await page.goto(demo(`tab=${tab}`));
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const panel = await box(page, `[data-panel=${tab}]`);
      const f = await box(page, "footer");
      const bar = await box(page, "[data-testid=tabbar]");
      expect(f.y, tab).toBeGreaterThanOrEqual(panel.y + panel.height);
      expect(f.y + f.height, tab).toBeLessThanOrEqual(bar.y + 0.5);
    }
  });
});
