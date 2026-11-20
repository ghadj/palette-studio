/**
 * Below 1024 px the palette-wide copy actions live in an "Export palette" drawer, opened from a
 * button in the pinned strip dock on the Palette tab (M3 decision 53). The Source tab has none.
 * From 1024 px the "Palette export" bar is unchanged.
 */
import { expect, test } from "@playwright/test";
import { demo } from "./helpers/app";
import { sheetSettled } from "./helpers/sheet";

const HEX = "#E8693A\n#1DB07A\n#14386B\n#D4527F\n#1E8A2E\n#5039B0";

for (const [width, height] of [
  [390, 844],
  [820, 1180],
] as const) {
  test.describe(`${width} x ${height}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height });
    });

    test("the Source tab has no Copy HEX or Copy CSS", async ({ page }) => {
      await page.goto(demo("tab=source"));
      await expect(page.getByTestId("tabbar")).toBeVisible();
      await expect(page.getByRole("button", { name: "Copy HEX", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Copy CSS", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Export palette" })).toHaveCount(0);
    });

    test("the Palette tab's Export button sits in the dock, 44 px, visible at the page end", async ({
      page,
    }) => {
      await page.goto(demo("tab=palette"));
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(150);
      const button = page.getByRole("button", { name: "Export palette" });
      await expect(button).toBeVisible();
      const b = await button.boundingBox();
      const dock = await page.getByTestId("strip-dock").boundingBox();
      expect(b?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(b?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(b?.y ?? 0).toBeGreaterThanOrEqual((dock?.y ?? 0) - 0.5);
      expect((b?.y ?? 0) + (b?.height ?? 0)).toBeLessThanOrEqual(
        (dock?.y ?? 0) + (dock?.height ?? 0) + 0.5,
      );
      // Right-aligned within the dock.
      expect((dock?.x ?? 0) + (dock?.width ?? 0) - ((b?.x ?? 0) + (b?.width ?? 0))).toBeLessThan(
        24,
      );
      await expect(page.getByTestId("palette-rows")).toBeVisible();
      await expect(page.getByRole("button", { name: "Copy HEX", exact: true })).toHaveCount(0);
    });

    test("it opens a drawer below the dock; Copy HEX copies and closing returns focus", async ({
      page,
      context,
      browserName,
    }) => {
      test.skip(
        browserName !== "chromium",
        "Playwright grants clipboard permissions in Chromium only",
      );
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.goto(demo("tab=palette"));
      const button = page.getByRole("button", { name: "Export palette" });
      await button.click();
      await sheetSettled(page);
      const sheet = page.getByTestId("sheet-export");
      await expect(sheet.getByRole("heading", { name: "Export palette" })).toBeVisible();
      await expect(sheet.getByRole("button", { name: "Copy CSS", exact: true })).toBeVisible();
      const dock = await page.getByTestId("strip-dock").boundingBox();
      const panel = await sheet.locator(".bottom-sheet__panel").boundingBox();
      expect(panel?.y ?? 0).toBeGreaterThanOrEqual((dock?.y ?? 0) + (dock?.height ?? 0) - 1);
      await sheet.getByRole("button", { name: "Copy HEX", exact: true }).click();
      await expect(page.getByTestId("toast-region")).toHaveText("Copied HEX");
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(HEX);
      await sheet.getByRole("button", { name: "Close" }).click();
      await expect(sheet).toHaveCount(0);
      await expect(button).toBeFocused();
    });
  });
}

test("1280: the desktop Palette export bar is unchanged", async ({ page }, info) => {
  test.skip(info.project.name.startsWith("phone"), "desktop viewport");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(demo());
  const bar = page.getByTestId("export-drawer");
  await expect(bar.getByRole("heading", { name: "Palette export" })).toBeVisible();
  await expect(bar.getByRole("button", { name: "Copy HEX", exact: true })).toBeVisible();
  await expect(bar.getByRole("button", { name: "Copy CSS", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export palette" })).toHaveCount(0);
});
