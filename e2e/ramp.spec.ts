/**
 * The Ramp panel (M3-T7; spec 3.4; plan D4, D5; decisions 4a, 4b): the 11-step ramp and the five
 * harmony groups of the selected swatch, each tile addable to the palette.
 */
import { expect, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";
import { sheetSettled } from "./helpers/sheet";

const strip = (page: Page) =>
  page.locator("[data-testid=swatch-strip]:visible").first().locator("[data-swatch]");
const panel = (page: Page) => page.locator("[data-testid=ramp-panel]:visible");
const tiles = (page: Page) => panel(page).locator("[data-testid=ramp-tile]");

/** Selects swatch 1 (#E8693A) and opens the Ramp panel. */
async function openRamp(page: Page): Promise<void> {
  await page.goto(demo("tab=palette"));
  await strip(page).first().click();
  const pill = page.locator("[data-panel=palette]").getByRole("button", {
    name: "Ramp",
    exact: true,
  });
  await pill.click();
  await expect(panel(page)).toBeVisible();
  if (page.viewportSize() && (page.viewportSize()?.width ?? 0) < 1024) await sheetSettled(page);
}

test.describe("ramp panel", () => {
  test("Ramp on swatch 1 shows 11 tiles with #E8693A at 400", async ({ page }) => {
    await openRamp(page);
    const ramp = panel(page).getByTestId("ramp-tiles");
    await expect(ramp.locator("[data-testid=ramp-tile]")).toHaveCount(11);
    await expect(ramp.locator("[data-step='400']")).toHaveAttribute("data-hex", "#E8693A");
    await expect(ramp.locator("[data-step='50']")).toBeVisible();
    await expect(ramp.locator("[data-step='950']")).toBeVisible();
  });

  test("adding 700 adds a manual swatch; Undo removes it", async ({ page }) => {
    await openRamp(page);
    const before = await strip(page).count();
    const hex = await panel(page)
      .locator("[data-testid=ramp-tiles] [data-step='700']")
      .getAttribute("data-hex");
    await panel(page).locator("[data-testid=ramp-tiles] [data-step='700']").click();
    await expect(strip(page)).toHaveCount(before + 1);
    await expect(strip(page).last()).toHaveAttribute("aria-label", new RegExp(`${hex}`));
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("Control+z");
    await expect(strip(page)).toHaveCount(before);
  });

  test("harmonies show 5 groups", async ({ page }) => {
    await openRamp(page);
    await expect(panel(page).getByTestId("harmony-group")).toHaveCount(5);
    await expect(
      panel(page).getByTestId("harmony-group").first().locator("[data-testid=ramp-tile]"),
    ).toHaveCount(1);
  });

  test("adding is disabled at 12, with a note", async ({ page }) => {
    await openRamp(page);
    const group = panel(page).getByTestId("harmony-group").nth(3);
    for (let guard = 0; guard < 12 && (await strip(page).count()) < 12; guard += 1) {
      await group.locator("[data-testid=ramp-tile]").first().click();
    }
    await expect(strip(page)).toHaveCount(12);
    await expect(tiles(page).first()).toBeDisabled();
    await expect(panel(page)).toContainText("A palette holds up to 12 colors");
  });

  test("phone: opens as a sheet", async ({ page }, info) => {
    test.skip(!isPhoneProject(info), "phone layout");
    await openRamp(page);
    await expect(page.getByRole("dialog")).toHaveAccessibleName("Ramp");
    await expect(page.getByRole("dialog").getByTestId("ramp-panel")).toBeVisible();
  });

  test("tiles are data-user-content and at least 44 px on phones", async ({ page }, info) => {
    await openRamp(page);
    const count = await tiles(page).count();
    expect(count).toBe(11 + 1 + 2 + 2 + 3 + 2);
    for (let i = 0; i < count; i += 1) {
      const tile = tiles(page).nth(i);
      await expect(tile).toHaveAttribute("data-user-content", /.*/);
      if (isPhoneProject(info)) {
        await tile.scrollIntoViewIfNeeded();
        const b = await tile.boundingBox();
        expect(b?.width ?? 0).toBeGreaterThanOrEqual(44);
        expect(b?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
    }
  });
});
