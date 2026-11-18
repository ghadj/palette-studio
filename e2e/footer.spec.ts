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
        await expect(footer.locator(".footer__statement")).toHaveText(
          "Your images never leave this browser.",
        );
        await expect(footer).not.toContainText("uploaded");
        await expect(footer.getByRole("link", { name: /MIT/ })).toHaveAttribute("href", LICENSE);
        await expect(footer.getByRole("link", { name: /GitHub/ })).toHaveAttribute("href", REPO);
      }
    }
  });

  test("the footer's top border runs edge to edge while its content keeps the page gutters, on every layout", async ({
    page,
  }) => {
    for (const viewport of [...VIEWPORTS, { name: "narrow", width: 320, height: 640 }]) {
      await page.setViewportSize(viewport);
      await page.goto(demo());
      const footer = page.getByRole("contentinfo");
      const b = await footer.boundingBox();
      expect(b?.x, viewport.name).toBeCloseTo(0, 0);
      expect(b?.width, viewport.name).toBeCloseTo(viewport.width, 0);
      expect(await footer.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe("1px");
      const gutter = viewport.width >= 1024 ? 24 : 16;
      const text = await footer.locator(".footer__statement").boundingBox();
      expect(text?.x, viewport.name).toBeCloseTo(gutter, 0);
      const links = await footer.locator(".footer__links").boundingBox();
      expect((links?.x ?? 0) + (links?.width ?? 0), viewport.name).toBeLessThanOrEqual(
        viewport.width - gutter + 0.5,
      );
    }
  });

  test("desktop: the export drawer's top border stays inside the 24 px page gutters while the footer's runs edge to edge", async ({
    page,
  }, info) => {
    test.skip(info.project.name.startsWith("phone"), "desktop viewport");
    for (const width of [1024, 1280, 1920]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(demo());
      const drawer = page.getByTestId("export-drawer");
      const b = await drawer.boundingBox();
      expect(b?.x, `${width}`).toBeCloseTo(24, 0);
      expect(b?.width, `${width}`).toBeCloseTo(width - 48, 0);
      expect(await drawer.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe("1px");
      const title = await drawer.getByRole("heading", { name: "Palette export" }).boundingBox();
      expect(title?.x, `${width}`).toBeCloseTo(24, 0);
      const footer = await page.getByRole("contentinfo").boundingBox();
      expect(footer?.x, `${width}`).toBeCloseTo(0, 0);
      expect(footer?.width, `${width}`).toBeCloseTo(width, 0);
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
