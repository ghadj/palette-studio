/**
 * The Export sheet below 1024 px is a plain bottom sheet (M3 decision 62): it doesn't scroll the
 * page, pin the strip dock or start below it, and the page stays put on close. Settings drawers
 * keep decisions 35 and 59.
 */
import { expect, type Page, test } from "@playwright/test";
import { demo } from "./helpers/app";
import { openExport, sheetSettled } from "./helpers/sheet";

const SIZES = [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
] as const;

const dock = (page: Page) => page.getByTestId("strip-dock");
const state = (page: Page) =>
  page.evaluate(() => ({
    y: window.scrollY,
    stuck: document.querySelector("[data-testid=strip-dock]")?.hasAttribute("data-stuck") ?? null,
  }));

for (const size of SIZES) {
  for (const tab of ["source", "palette"] as const) {
    test(`Export leaves the page and the strip alone: ${tab} at ${size.width} px`, async ({
      page,
    }, info) => {
      test.skip(!info.project.name.startsWith("phone-chromium"), "layout, checked once");
      await page.setViewportSize(size);
      await page.goto(demo(`tab=${tab}`));
      await page.evaluate(() => window.scrollTo(0, 0));
      const before = await state(page);
      expect(before.y).toBe(0);
      expect(before.stuck).toBe(false);
      await openExport(page);
      await sheetSettled(page);
      expect(await state(page)).toEqual(before);
      // The sheet anchors to the bottom of the viewport.
      const panel = await page.getByRole("dialog").locator(".bottom-sheet__panel").boundingBox();
      if (!panel) throw new Error("no panel");
      expect(Math.abs(panel.y + panel.height - size.height)).toBeLessThanOrEqual(1);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(await state(page)).toEqual(before);
      await expect(
        page.locator("header").getByRole("button", { name: "Export", exact: true }),
      ).toBeFocused();
    });
  }
}

test("a scrolled page stays where it was when Export closes (390 px)", async ({ page }, info) => {
  test.skip(!info.project.name.startsWith("phone-chromium"), "layout, checked once");
  await page.setViewportSize({ width: 390, height: 500 });
  await page.goto(demo("tab=palette"));
  await page.evaluate(() => window.scrollTo(0, 120));
  const before = await state(page);
  expect(before.y).toBeGreaterThan(0);
  // The header scrolls away on this tab: focus the button and press Enter, as a keyboard user does.
  await page
    .locator("header")
    .getByRole("button", { name: "Export", exact: true })
    .evaluate((el) => (el as HTMLElement).focus({ preventScroll: true }));
  await page.keyboard.press("Enter");
  await sheetSettled(page);
  expect((await state(page)).y).toBe(before.y);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await state(page)).y).toBe(before.y);
});

test("a settings drawer still pins the strip and starts below it with the gap", async ({
  page,
}, info) => {
  test.skip(!info.project.name.startsWith("phone-chromium"), "layout, checked once");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(demo("tab=source"));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: "Advanced", exact: true }).click();
  await sheetSettled(page);
  expect((await state(page)).stuck).toBe(true);
  const d = await dock(page).boundingBox();
  const panel = await page.getByRole("dialog").locator(".bottom-sheet__panel").boundingBox();
  if (!d || !panel) throw new Error("no boxes");
  expect(panel.y).toBeGreaterThanOrEqual(d.y + d.height + 7);
});
