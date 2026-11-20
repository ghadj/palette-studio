/**
 * M4-T10: the render state (spec 4.3 "Gamut handling", 4.5; plan D10, D12). The Gamut row lives in
 * T9's Interpolation options drawer and shows only while the bake maps colors into sRGB; the preview
 * falls back to baked stops where `CSS.supports` rejects the `in <space>` clause.
 */
import { expect, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";
import { sheetSettled } from "./helpers/sheet";

type Info = Parameters<typeof isPhoneProject>[0];

const preview = (page: Page) => page.getByTestId("gradient-preview");
const options = (page: Page) => page.getByTestId("interpolation-options");
const gamutRow = (page: Page) =>
  options(page)
    .locator(".setting-row")
    .filter({ hasText: /^Gamut/ });
const space = (page: Page) => page.locator("#interpolation-space");
const header = (page: Page) => page.locator("[data-row=interpolation] .chevron-row__button");
const editor = (page: Page) => page.locator("[data-testid=swatch-editor]:visible");
const stripSwatch = (page: Page, n: number) =>
  page.locator("[data-testid=swatch-strip]:visible [data-swatch]").nth(n - 1);

/** Types a HEX into swatch `n` through the color editor (M3-T3). */
async function setSwatch(page: Page, n: number, hex: string) {
  await stripSwatch(page, n).click();
  const field = editor(page).getByLabel("HEX", { exact: true });
  await field.fill(hex);
  await field.press("Enter");
  await expect(stripSwatch(page, n)).toHaveAttribute("aria-label", `Swatch ${n}, ${hex}`);
}

/**
 * The fixture gradient runs over swatches 2, 4 and 6 (mockup-state "Gradient"). Making them red,
 * red and green gives a #FF0000→#00FF00 gradient, then shows the Interpolation options.
 */
async function redToGreen(page: Page, info: Info) {
  if (isPhoneProject(info)) await page.goto(demo("tab=palette"));
  else {
    await page.setViewportSize({ width: 1280, height: 1280 });
    await page.goto(demo("rows=interpolation"));
  }
  await setSwatch(page, 2, "#FF0000");
  await setSwatch(page, 4, "#FF0000");
  await setSwatch(page, 6, "#00FF00");
  if (isPhoneProject(info)) {
    await page.getByTestId("tabbar").getByRole("tab", { name: "Gradient" }).click();
  }
  const stops = await preview(page).getAttribute("data-stops");
  // Smooth path may put green at either end; the colors are what matter.
  const colors = stops?.split(",").map((s) => s.split("@")[0]);
  expect(colors?.sort()).toEqual(["#00FF00", "#FF0000", "#FF0000"]);
}

/** Picks the interpolation space and shows the drawer (a sheet on phones). */
async function showOptions(page: Page, info: Info, value: string) {
  if (isPhoneProject(info)) {
    if ((await page.getByRole("dialog").count()) > 0) {
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    await space(page).selectOption(value);
    await header(page).click();
    await sheetSettled(page);
  } else await space(page).selectOption(value);
  await expect(options(page)).toBeVisible();
}

test.describe("Render state (M4-T10)", () => {
  test("opening Interpolation options shows the Gamut row for #FF0000→#00FF00 in OKLCH, but not in OKLab", async ({
    page,
  }, info) => {
    await redToGreen(page, info);

    await showOptions(page, info, "oklab");
    await expect(options(page).getByText("Easing", { exact: true })).toBeVisible();
    await expect(gamutRow(page)).toHaveCount(0);

    await showOptions(page, info, "oklch");
    await expect(gamutRow(page)).toBeVisible();
    await expect(gamutRow(page)).toContainText("Some colors fall outside sRGB.");
    await expect(page.locator("#interp-gamut")).toHaveValue("chroma");
    await expect(preview(page)).toHaveAttribute("data-space", "oklch");
  });

  test("the live preview is native CSS with the `in` clause", async ({ page }, info) => {
    if (isPhoneProject(info)) await page.goto(demo("tab=gradient"));
    else await page.goto(demo());
    await expect(preview(page)).toHaveAttribute("data-render", "native");
    const background = await preview(page).evaluate((el) => (el as HTMLElement).style.background);
    expect(background).toContain("in oklab");
  });

  test("with an init script making CSS.supports return false, data-render is baked", async ({
    page,
  }, info) => {
    await page.addInitScript(() => {
      CSS.supports = () => false;
    });
    if (isPhoneProject(info)) await page.goto(demo("tab=gradient"));
    else await page.goto(demo());
    await expect(preview(page)).toHaveAttribute("data-render", "baked");
    const background = await preview(page).evaluate((el) => (el as HTMLElement).style.background);
    expect(background).not.toContain(" in ");
    // 16 to 64 baked stops (plan D8).
    const stops = background.match(/rgb\(/g)?.length ?? 0;
    expect(stops).toBeGreaterThanOrEqual(16);
    expect(stops).toBeLessThanOrEqual(64);
    // The fixture's colors still lead and end it.
    await expect(preview(page)).toHaveAttribute("data-stops", "#1DB07A@0,#D4527F@50,#5039B0@100");
  });
});
