import { expect, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";

/** The CVD row (M3-T9; spec 3.5, plan D6). The demo palette has six swatches; Swatch 3 is selected. */

const url = (info: { project: { name: string } }) =>
  demo(info.project.name.startsWith("phone") ? "tab=palette&rows=cvd" : "rows=cvd");

const panel = (page: Page) => page.locator("[data-testid=cvd-panel]:visible");
const strips = (page: Page) => panel(page).locator("[data-testid^=cvd-strip-]");

async function backgrounds(page: Page): Promise<string[]> {
  return panel(page)
    .locator("[data-cvd-swatch]")
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
}

test.describe("CVD simulation (spec 3.5)", () => {
  test("demo: the CVD row shows 5 strips of 6 swatches", async ({ page }, info) => {
    await page.goto(url(info));
    await expect(strips(page)).toHaveCount(5);
    await expect(strips(page).locator(".cvd-strip__label")).toHaveText([
      "Normal",
      "Protanopia",
      "Deuteranopia",
      "Tritanopia",
      "Achromatopsia",
    ]);
    for (let i = 0; i < 5; i += 1) {
      await expect(strips(page).nth(i).locator("[data-cvd-swatch]")).toHaveCount(6);
      await expect(strips(page).nth(i).locator("[data-user-content]")).toHaveCount(6);
    }
    // The Normal strip is the palette; achromatopsia is gray.
    await expect(strips(page).first().locator("[data-cvd-swatch]").nth(2)).toHaveAttribute(
      "data-hex",
      "#14386B",
    );
    const gray = await strips(page)
      .nth(4)
      .locator("[data-cvd-swatch]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-hex") ?? ""));
    for (const hex of gray) expect(hex.slice(1, 3) === hex.slice(3, 5)).toBe(true);
  });

  test("strips update after an adjustment", async ({ page }, info) => {
    test.skip(isPhoneProject(info), "the sheet covers the Adjustments row");
    await page.goto(demo("rows=cvd,adjustments"));
    const swatchAt = (strip: number) => strips(page).nth(strip).locator("[data-cvd-swatch]").nth(2);
    const normalBefore = await swatchAt(0).getAttribute("data-hex");
    const simulatedBefore = await swatchAt(1).getAttribute("data-hex");
    const lightness = page
      .locator("[data-testid=adjustments-panel]:visible")
      .getByRole("spinbutton", { name: /^Lightness$/ })
      .first();
    await lightness.fill("0.2");
    await lightness.press("Enter");
    await expect(swatchAt(0)).not.toHaveAttribute("data-hex", normalBefore ?? "");
    await expect(swatchAt(1)).not.toHaveAttribute("data-hex", simulatedBefore ?? "");
  });

  test("phone: opens as a sheet", async ({ page }, info) => {
    test.skip(!isPhoneProject(info), "phone layout");
    await page.goto(demo("tab=palette"));
    await page.getByRole("button", { name: "CVD", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").getByTestId("cvd-panel")).toBeVisible();
    await expect(strips(page)).toHaveCount(5);
  });

  test("strip colors are identical in light and dark", async ({ page }, info) => {
    const seen: string[][] = [];
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(url(info));
      await expect(strips(page)).toHaveCount(5);
      seen.push(await backgrounds(page));
    }
    expect(seen[0]).toHaveLength(30);
    expect(seen[1]).toEqual(seen[0]);
  });
});
