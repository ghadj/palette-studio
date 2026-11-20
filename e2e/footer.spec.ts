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
        // Wide layouts show the full sentence, narrow ones the short one (decision 54).
        const shown = viewport.width >= 1024 ? ".footer__long" : ".footer__short";
        await expect(footer.locator(shown)).toBeVisible();
        await expect(footer.locator(".footer__long")).toHaveText(
          "Your images never leave this browser.",
        );
        await expect(footer.locator(".footer__short")).toHaveText("Images stay in your browser");
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

  test("desktop: the footer's top border runs edge to edge and there is no export bar above it (M3 decision 56)", async ({
    page,
  }, info) => {
    test.skip(info.project.name.startsWith("phone"), "desktop viewport");
    for (const width of [1024, 1280, 1920]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(demo());
      await expect(page.getByTestId("export-drawer")).toHaveCount(0);
      const footer = await page.getByRole("contentinfo").boundingBox();
      expect(footer?.x, `${width}`).toBeCloseTo(0, 0);
      expect(footer?.width, `${width}`).toBeCloseTo(width, 0);
    }
  });

  test("footer uses tokens only and sits after the last panel content (desktop: below the columns; phone: end of each tab's scroll area, above the tab bar)", async ({
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
    const columns = await box(page, ".columns");
    const foot = await box(page, "footer");
    expect(foot.y).toBeGreaterThanOrEqual(columns.y + columns.height - 0.5);

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

  test("one thin row: text and links share a line, no wrap, no horizontal scroll (decision 54)", async ({
    page,
  }) => {
    for (const viewport of [
      { width: 320, height: 640 },
      { width: 390, height: 844 },
      { width: 820, height: 1180 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(demo());
      const footer = page.getByRole("contentinfo");
      await footer.scrollIntoViewIfNeeded();
      const label = `${viewport.width}`;
      const f = await footer.boundingBox();
      const statement = await footer.locator(".footer__statement").boundingBox();
      const license = await footer.getByRole("link", { name: /MIT/ }).boundingBox();
      const github = await footer.getByRole("link", { name: /GitHub/ }).boundingBox();
      if (!f || !statement || !license || !github) throw new Error("no boxes");
      // The text is centered in the same row as the links: their vertical centers match.
      const mid = (b: { y: number; height: number }) => b.y + b.height / 2;
      expect(Math.abs(mid(statement) - mid(license)), label).toBeLessThanOrEqual(2);
      expect(Math.abs(license.y - github.y), label).toBeLessThanOrEqual(2);
      expect(statement.x + statement.width, label).toBeLessThanOrEqual(license.x + 0.5);
      if (viewport.width < 1024) {
        // 44 px touch targets, plus the 1 px divider and nothing else.
        expect(f.height, label).toBeLessThanOrEqual(45.5);
        expect(license.height, label).toBeGreaterThanOrEqual(44);
        expect(github.height, label).toBeGreaterThanOrEqual(44);
        expect(license.width, label).toBeGreaterThanOrEqual(44);
        expect(github.width, label).toBeGreaterThanOrEqual(44);
      } else {
        // --hit (32 px on a pointer device, 44 px on touch) plus the divider.
        const hit = await page.evaluate(() => {
          const probe = document.createElement("div");
          probe.style.height = "var(--hit)";
          document.body.append(probe);
          const h = probe.getBoundingClientRect().height;
          probe.remove();
          return h;
        });
        expect(f.height, label).toBeLessThanOrEqual(hit + 1.5);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
        `${label}: no horizontal scroll`,
      ).toBe(true);
    }
  });

  test("the privacy statement stays reachable: visible text, and the full sentence as a title", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(demo());
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByText("Images stay in your browser")).toBeVisible();
    await expect(footer.locator(".footer__statement")).toHaveAttribute(
      "title",
      "Your images never leave this browser.",
    );
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(footer.getByText("Your images never leave this browser.")).toBeVisible();
  });
});
