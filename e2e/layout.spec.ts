import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { box, demo, hasHorizontalScroll, isPhoneProject, PHONE_SIZES } from "./helpers/app";
import { sheetSettled } from "./helpers/sheet";
import { checkTokens, describeFailures } from "./helpers/tokens";

test.describe("responsive shell (spec 6.1)", () => {
  test("1280×800: three equal columns (widths within 1 px) with a 16 px gutter and no export bar below", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "desktop viewport");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(demo());
    const columns = page.locator("[data-column]");
    await expect(columns).toHaveCount(3);
    expect(
      await columns.evaluateAll((els) => els.map((e) => e.getAttribute("data-column"))),
    ).toEqual(["source", "palette", "gradient"]);
    const boxes = await Promise.all((await columns.all()).map((c) => c.boundingBox()));
    const [a, b, c] = boxes.map((x) => {
      if (!x) throw new Error("column not rendered");
      return x;
    });
    if (!a || !b || !c) throw new Error("missing column");
    expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(b.width - c.width)).toBeLessThanOrEqual(1);
    expect(b.x - (a.x + a.width)).toBeCloseTo(16, 0);
    expect(c.x - (b.x + b.width)).toBeCloseTo(16, 0);
    expect(a.y).toBeCloseTo(b.y, 0);
    expect(b.y).toBeCloseTo(c.y, 0);

    // No export bar under the columns: they reach the footer (M3 decision 56).
    await expect(page.getByTestId("export-drawer")).toHaveCount(0);
    const footer = await box(page, "footer");
    const area = await box(page, ".columns");
    expect(area.y + area.height).toBeCloseTo(footer.y, 0);
    // Desktop has no bottom tab bar.
    await expect(page.locator("[data-testid=tabbar]")).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("desktop: the columns sit directly above the footer at the bottom of the window, with no gap", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "desktop viewport");
    for (const [width, height] of [
      [1280, 800],
      [1280, 1200],
      [1024, 768],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto(demo());
      const columns = await box(page, ".columns");
      const footer = await box(page, "footer");
      expect(footer.y + footer.height, `${width}×${height}`).toBeCloseTo(height, 0);
      expect(columns.y + columns.height, `${width}×${height}`).toBeCloseTo(footer.y, 0);
      expect(
        await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight),
      ).toBe(true);
    }
  });

  test("desktop: a column taller than the window scrolls on its own between the header and the footer (M3 decision 37)", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "desktop viewport");
    await page.setViewportSize({ width: 1280, height: 680 });
    await page.goto("./");
    await page.locator('details.chevron-row summary:has-text("Advanced")').click();
    const source = page.locator("[data-column=source] .column__scroll");
    const sizes = await source.evaluate((el) => ({
      scroll: el.scrollHeight,
      client: el.clientHeight,
      overflow: getComputedStyle(el).overflowY,
    }));
    expect(sizes.scroll).toBeGreaterThan(sizes.client);
    expect(sizes.overflow).toBe("auto");
    const header = await box(page, "header");
    const area = await box(page, ".columns");
    const footer = await box(page, "footer");
    expect(area.y).toBeCloseTo(header.y + header.height, 0);
    expect(area.y + area.height).toBeCloseTo(footer.y, 0);
    expect(footer.y + footer.height).toBeCloseTo(680, 0);
    // The page itself doesn't scroll; the column does, and the others stay where they are.
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight),
    ).toBe(true);
    const others = await page.evaluate(() =>
      ["palette", "gradient"].map((name) => {
        const el = document.querySelector(`[data-column=${name}] .column__scroll`) as HTMLElement;
        return el.scrollTop;
      }),
    );
    await source.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect(page.locator("#setting-seed")).toBeInViewport();
    expect(await source.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect(
      await page.evaluate(() =>
        ["palette", "gradient"].map(
          (name) =>
            (document.querySelector(`[data-column=${name}] .column__scroll`) as HTMLElement)
              .scrollTop,
        ),
      ),
    ).toEqual(others);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    // Each column's box fills the area, so a long column leaves no white gap beside the others.
    const heights = await page
      .locator("[data-column]")
      .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
    expect(new Set(heights).size).toBe(1);
  });

  test("below 320 px wide the page stops shrinking and scrolls sideways", async ({ page }) => {
    for (const width of [300, 280]) {
      await page.setViewportSize({ width, height: 640 });
      await page.goto(demo());
      const root = await box(page, "#app-root");
      expect(root.width, `${width}`).toBeCloseTo(320, 0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeGreaterThanOrEqual(320);
      // The header is laid out at 320 px: every control keeps its 44 px.
      for (const button of await page.locator("header").getByRole("button").all()) {
        const b = await button.boundingBox();
        expect(b?.width ?? 0).toBeGreaterThanOrEqual(44);
        expect(b?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
    }
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(demo());
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("desktop: below about 640 px tall the page scrolls instead of squashing the columns and drawer", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "desktop viewport");
    await page.setViewportSize({ width: 1280, height: 640 });
    await page.goto(demo());
    const atMinimum = await box(page, ".columns");
    for (const height of [600, 480]) {
      await page.setViewportSize({ width: 1280, height });
      await page.goto(demo());
      const root = await box(page, "#app-root");
      expect(root.height, `${height}`).toBeCloseTo(640, 0);
      expect(
        await page.evaluate(() => document.documentElement.scrollHeight),
      ).toBeGreaterThanOrEqual(640);
      const columns = await box(page, ".columns");
      expect(columns.height).toBeCloseTo(atMinimum.height, 0);
      const footer = await box(page, "footer");
      expect(columns.y + columns.height).toBeCloseTo(footer.y, 0);
      expect(footer.y + footer.height).toBeCloseTo(640, 0);
    }
  });

  test("desktop header: the Studio and Materials tabs stay centered whatever the side groups' widths", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "desktop viewport");
    const centered = async (width: number) => {
      const nav = await box(page, "nav[aria-label=Views]");
      expect(Math.abs(nav.x + nav.width / 2 - width / 2), `width ${width}`).toBeLessThanOrEqual(1);
    };
    for (const width of [1024, 1280, 1920]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(demo());
      await centered(width);
    }
    // A long project name and the Replace image button change the side groups; the tabs stay put.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("./");
    await centered(1280);
    await page.getByTestId("file-input").setInputFiles({
      name: "a remarkably long project name that will need to be truncated somewhere.png",
      mimeType: "image/png",
      buffer: readFileSync(resolve(process.cwd(), "tests/fixtures/two-color.png")),
    });
    await expect(
      page.locator("header").getByRole("button", { name: "Replace image" }),
    ).toBeVisible();
    await centered(1280);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("820×1180: the tabbed layout, with the panel centered at a readable width", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "tablet viewport");
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto(demo());
    await expect(page.locator("[data-column]")).toHaveCount(0);
    await expect(page.getByTestId("export-drawer")).toHaveCount(0);
    await expect(page.getByTestId("tabbar").getByRole("tab")).toHaveText([
      "Source",
      "Palette",
      "Gradient",
      "Materials",
    ]);
    // The phone header: no app name, icon buttons.
    await expect(page.locator("header.header--compact")).toBeVisible();
    // One swatch strip only (the tablet's duplicate is gone).
    await expect(page.locator("[data-testid=swatch-strip]:visible")).toHaveCount(1);
    // The panel is centered at 640 px (--space-8 × 20).
    const main = await box(page, "main");
    expect(main.width).toBeCloseTo(640, 0);
    expect(main.x).toBeCloseTo((820 - 640) / 2, 0);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("601 to 1023 px, portrait and landscape: one panel at a time with all four tabs in the bottom tab bar", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "tablet viewport");
    for (const viewport of [
      { width: 601, height: 900 },
      { width: 1023, height: 768 },
      { width: 768, height: 1024 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(demo());
      const tabbar = page.getByTestId("tabbar");
      await expect(tabbar.getByRole("tab")).toHaveText([
        "Source",
        "Palette",
        "Gradient",
        "Materials",
      ]);
      const bar = await box(page, "[data-testid=tabbar]");
      expect(bar.y + bar.height).toBeCloseTo(viewport.height, 0);
      for (const name of ["Palette", "Gradient", "Materials", "Source"] as const) {
        await tabbar.getByRole("tab", { name }).click();
        await expect(tabbar.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
        await expect(page.locator(`[data-panel=${name.toLowerCase()}]`)).toBeVisible();
        await expect(page.getByRole("tabpanel")).toHaveCount(1);
      }
      expect(await hasHorizontalScroll(page)).toBe(false);
    }
  });

  test("320, 375, 390, 430 px portrait and their landscape sizes: no horizontal scroll (scrollWidth ≤ clientWidth)", async ({
    page,
  }) => {
    for (const size of PHONE_SIZES) {
      for (const viewport of [size, { width: size.height, height: size.width }]) {
        await page.setViewportSize(viewport);
        for (const tab of ["source", "palette", "gradient", "materials"]) {
          await page.goto(demo(`tab=${tab}`));
          await expect(page.locator("#app-root")).toBeVisible();
          expect(
            await hasHorizontalScroll(page),
            `${viewport.width}×${viewport.height} ${tab}`,
          ).toBe(false);
        }
      }
    }
  });

  test("320, 375, 390, 430 px, light and dark: with every M3 sheet open there is no horizontal scroll, every control is at least 44 px and the colors, type and radii are tokens", async ({
    page,
  }) => {
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      for (const size of PHONE_SIZES) {
        await page.setViewportSize(size);
        for (const row of ["swatch", "adjustments", "ramp", "contrast", "cvd"]) {
          const at = `${theme} ${size.width} ${row}`;
          await page.goto(demo(`tab=palette&rows=${row}`));
          await expect(page.getByRole("dialog")).toBeVisible();
          await sheetSettled(page);
          expect(await hasHorizontalScroll(page), `${at}: scroll`).toBe(false);
          const failures = await checkTokens(page, { touchTargets: true });
          expect(failures, `${at}: ${describeFailures(failures)}`).toEqual([]);
        }
      }
    }
  });

  test("phone: four tabs Source, Palette, Gradient, Materials; selecting Gradient shows its panel and sets aria-selected", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(demo());
    const tabbar = page.getByTestId("tabbar");
    const tabs = tabbar.getByRole("tab");
    await expect(tabs).toHaveText(["Source", "Palette", "Gradient", "Materials"]);
    await expect(tabbar.getByRole("tab", { name: "Source" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.locator("[data-panel=source]")).toBeVisible();
    await tabbar.getByRole("tab", { name: "Gradient" }).click();
    await expect(tabbar.getByRole("tab", { name: "Gradient" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(tabbar.getByRole("tab", { name: "Source" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    await expect(page.locator("[data-panel=gradient]")).toBeVisible();
    await expect(page.locator("[data-panel=source]")).toHaveCount(0);
    await expect(page.getByRole("tabpanel")).toHaveCount(1);
    // The tab bar sits at the bottom of the viewport.
    const bar = await box(page, "[data-testid=tabbar]");
    expect(bar.y + bar.height).toBeCloseTo(844, 0);
    // The tab bar is padded for the home indicator (spec 6.1).
    const padded = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        for (const rule of Array.from(sheet.cssRules)) {
          if (
            rule instanceof CSSStyleRule &&
            rule.selectorText === ".tabbar" &&
            rule.style.paddingBottom.includes("safe-area-inset-bottom")
          )
            return true;
        }
      }
      return false;
    });
    expect(padded).toBe(true);
    // Arrow keys move between tabs.
    await tabbar.getByRole("tab", { name: "Gradient" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabbar.getByRole("tab", { name: "Materials" })).toBeFocused();
    await expect(tabbar.getByRole("tab", { name: "Materials" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("landscape phones use the tabbed layout too (decision 4 as revised)", async ({ page }) => {
    for (const viewport of [
      { width: 568, height: 320 },
      { width: 667, height: 375 },
      { width: 844, height: 390 },
      { width: 932, height: 430 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(demo());
      await expect(page.locator("[data-column]")).toHaveCount(0);
      await expect(page.getByTestId("tabbar")).toBeVisible();
    }
  });
});
