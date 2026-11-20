/**
 * M4-T13: the Surround group in the theme menu (spec 6.2; plan Q3a to Q3c).
 */
import { expect, type Locator, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";

const stage = (page: Page) => page.getByTestId("gradient-stage");
const well = (page: Page) => page.locator(".image-well--image:visible").first();

async function openMenu(page: Page) {
  await page.getByRole("button", { name: /^Theme/ }).click();
  await expect(page.getByRole("menu")).toBeVisible();
}

async function pickSurround(page: Page, name: string) {
  await openMenu(page);
  await page.getByRole("menuitemradio", { name }).click();
  await expect(page.getByRole("menu")).toBeHidden();
}

/** The preview's pixels, inset past its rounded corners so the stage behind never shows. */
async function pixels(locator: Locator, inset = 6): Promise<string> {
  const b = await locator.boundingBox();
  if (!b) throw new Error("no box");
  const png = await locator.page().screenshot({
    clip: {
      x: b.x + inset,
      y: b.y + inset,
      width: b.width - 2 * inset,
      height: b.height - 2 * inset,
    },
  });
  return png.toString("base64");
}

test.describe("surround (spec 6.2)", () => {
  test("Black sets the stage and the image well, not the pixels (demo, no storage)", async ({
    page,
  }, info) => {
    const phone = isPhoneProject(info);
    if (!phone) await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(demo(phone ? "tab=gradient" : ""));
    const preview = page.getByTestId("gradient-preview");
    await expect(preview).toBeVisible();
    const before = await pixels(preview);
    await pickSurround(page, "Black");
    await expect(stage(page)).toHaveCSS("background-color", "rgb(0, 0, 0)");
    expect(await pixels(preview)).toBe(before);

    if (phone) await page.goto(demo("surround=black"));
    const imageWell = well(page);
    await expect(imageWell).toBeVisible();
    await expect(imageWell).toHaveCSS("background-color", "rgb(0, 0, 0)");
    const image = page.locator(".image-well__image:visible").first();
    await expect(image).toHaveAttribute("data-user-content", "");
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
    if (!phone) {
      await pickSurround(page, "Match theme");
      await expect(imageWell).not.toHaveCSS("background-color", "rgb(0, 0, 0)");
    }
  });

  test("the choice survives a reload outside the demo", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("./");
    await page.evaluate(() => localStorage.clear());
    await pickSurround(page, "White");
    expect(await page.evaluate(() => localStorage.getItem("palette-studio:surround"))).toBe(
      "white",
    );
    await page.reload();
    await openMenu(page);
    await expect(page.getByRole("menuitemradio", { name: "White" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.keyboard.press("Escape");
    await pickSurround(page, "Match theme");
    expect(await page.evaluate(() => localStorage.getItem("palette-studio:surround"))).toBeNull();
  });

  test("the demo writes no localStorage and honors surround=", async ({ page }) => {
    await page.goto(demo("surround=mid-gray"));
    await pickSurround(page, "White");
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
  });

  test("the Surround group is keyboard operable and its items are 44 px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(demo());
    const button = page.getByRole("button", { name: /^Theme/ });
    await button.focus();
    await page.keyboard.press("Enter");
    const group = page.getByRole("group", { name: "Surround" });
    await expect(group).toBeVisible();
    const items = group.getByRole("menuitemradio");
    await expect(items).toHaveCount(4);
    for (const item of await items.all()) {
      const b = await item.boundingBox();
      expect(b?.height).toBeGreaterThanOrEqual(44);
    }
    // Focus starts on System; four arrows reach Light, Dark, Match theme, Mid-gray.
    for (let i = 0; i < 4; i += 1) await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitemradio", { name: "Mid-gray" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(button).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitemradio", { name: "Mid-gray" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
