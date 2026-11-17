import { expect, test } from "@playwright/test";
import { box, demo, hasHorizontalScroll, isPhoneProject, PHONE_SIZES } from "./helpers/app";

test.describe("responsive shell (spec 6.1)", () => {
  test("1280×800: three equal columns (widths within 1 px) with a 16 px gutter and the export drawer below", async ({
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

    const drawer = await box(page, "[data-testid=export-drawer]");
    const tallest = Math.max(a.y + a.height, b.y + b.height, c.y + c.height);
    expect(drawer.y).toBeGreaterThanOrEqual(tallest);
    expect(drawer.x).toBeLessThanOrEqual(a.x + 1);
    expect(drawer.x + drawer.width).toBeGreaterThanOrEqual(c.x + c.width - 1);
    await expect(page.getByRole("heading", { name: "Palette export" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Gradient export" })).toBeVisible();
    // Desktop has no bottom tab bar.
    await expect(page.locator("[data-testid=tabbar]")).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("820×1180: the tablet two-column layout", async ({ page }, info) => {
    test.skip(isPhoneProject(info), "tablet viewport");
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto(demo());
    const columns = page.locator("[data-column]");
    await expect(columns).toHaveCount(2);
    const left = await box(page, "[data-column=source]");
    const right = await box(page, "[data-column=panel]");
    expect(left.x).toBeLessThan(right.x);
    expect(left.y).toBeCloseTo(right.y, 0);
    expect(Math.abs(left.width - right.width)).toBeLessThanOrEqual(1);
    await expect(page.locator("[data-testid=export-drawer]")).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("601 to 1023 px: Source column on the left (image, swatch strip beneath it, setting rows); the right column shows the active panel, chosen by Palette, Gradient and Materials tabs", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "tablet viewport");
    for (const width of [601, 1023]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(demo());
      await expect(page.locator("[data-column]")).toHaveCount(2);
      const source = page.locator("[data-column=source]");
      const image = await box(page, "[data-column=source] [data-testid=image-well]");
      const strip = await box(page, "[data-column=source] [data-testid=swatch-strip]");
      const rows = await box(page, "[data-column=source] [data-testid=setting-rows]");
      expect(strip.y).toBeGreaterThanOrEqual(image.y + image.height);
      expect(rows.y).toBeGreaterThanOrEqual(strip.y + strip.height);
      await expect(source.getByText("Algorithm")).toBeVisible();

      const panel = page.locator("[data-column=panel]");
      const tabs = panel.getByRole("tab");
      await expect(tabs).toHaveText(["Palette", "Gradient", "Materials"]);
      await expect(panel.getByRole("tab", { name: "Palette" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(panel.locator("[data-panel=palette]")).toBeVisible();
      for (const name of ["Gradient", "Materials", "Palette"] as const) {
        await panel.getByRole("tab", { name }).click();
        await expect(panel.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
        await expect(panel.locator(`[data-panel=${name.toLowerCase()}]`)).toBeVisible();
        await expect(panel.getByRole("tabpanel")).toHaveCount(1);
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

  test("landscape phone uses the two-column layout", async ({ page }) => {
    for (const viewport of [
      { width: 844, height: 390 },
      { width: 667, height: 375 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(demo());
      await expect(page.locator("[data-column]")).toHaveCount(2);
      await expect(page.getByTestId("tabbar")).toHaveCount(0);
    }
  });
});
