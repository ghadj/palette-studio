import { expect, type Page, test } from "@playwright/test";
import { demo } from "./helpers/app";
import { fixture } from "./helpers/files";

const canvas = (page: Page) => page.locator("[data-testid=image-well] canvas:visible");
const swatches = (page: Page) =>
  page.locator("[data-testid=swatch-strip]:visible").first().locator("[data-swatch]");
const replace = (page: Page) =>
  page.locator("header").getByRole("button", { name: "Replace image" });

for (const viewport of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "phone", width: 390, height: 844 },
]) {
  test(`replace image loads a second image and re-extracts (${viewport.name})`, async ({
    page,
  }, info) => {
    test.skip(
      info.project.name.startsWith("phone") && viewport.name === "desktop",
      "desktop viewport",
    );
    await page.setViewportSize(viewport);
    await page.goto("./");
    // Hidden on the empty screen: the drop zone offers the same choices there.
    await expect(replace(page)).toHaveCount(0);
    await page.getByTestId("file-input").setInputFiles(fixture("two-color.png"));
    await expect(swatches(page)).toHaveCount(2);

    // Choose image from the header menu opens the picker.
    await expect(replace(page)).toBeVisible();
    await expect(replace(page)).toHaveAttribute("aria-haspopup", "menu");
    await replace(page).click();
    const menu = page.getByRole("menu", { name: "Replace image" });
    await expect(menu.getByRole("menuitem")).toHaveText([
      "Choose image",
      "Paste",
      "Dunes sample",
      "Tiles sample",
      "Orbits sample",
    ]);
    const chooser = page.waitForEvent("filechooser");
    await menu.getByRole("menuitem", { name: "Choose image" }).click();
    await (await chooser).setFiles(fixture("single-color.png"));
    await expect(canvas(page)).toHaveAttribute("aria-label", "Source image, single-color.png");
    await expect(swatches(page)).toHaveCount(1);
    await expect(menu).toHaveCount(0);

    // A sample from the same menu replaces it again and re-extracts.
    await replace(page).click();
    await page.getByRole("menuitem", { name: "Tiles sample" }).click();
    await expect(canvas(page)).toHaveAttribute("aria-label", "Source image, Tiles.png");
    await expect(swatches(page)).toHaveCount(6);
    await expect(page.locator("header .project-button__name")).toHaveText("Tiles");

    // Keyboard: arrows move, Escape closes and returns focus.
    await replace(page).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitem", { name: "Choose image" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "Paste" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(replace(page)).toBeFocused();
  });
}

test("at 320 px the header doesn't overflow: the name truncates and every control is at least 44 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  for (const setup of ["demo", "loaded"] as const) {
    if (setup === "demo") await page.goto(demo());
    else {
      await page.goto("./");
      await page.getByTestId("file-input").setInputFiles({
        name: "a very long project name that cannot fit.png",
        mimeType: "image/png",
        buffer: (await import("node:fs")).readFileSync(fixture("two-color.png")),
      });
      await expect(canvas(page)).toBeVisible();
    }
    const header = page.locator("header");
    await expect(replace(page)).toBeVisible();
    const fits = await header.evaluate((el) => {
      const right = document.documentElement.clientWidth;
      return {
        scroll: el.scrollWidth <= el.clientWidth,
        inside: Array.from(el.querySelectorAll("button")).every(
          (b) =>
            b.getBoundingClientRect().right <= right + 0.5 &&
            b.getBoundingClientRect().left >= -0.5,
        ),
      };
    });
    expect(fits, setup).toEqual({ scroll: true, inside: true });
    for (const button of await header.getByRole("button").all()) {
      const box = await button.boundingBox();
      expect(box?.width ?? 0, setup).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0, setup).toBeGreaterThanOrEqual(44);
    }
    const name = header.locator(".project-button__name");
    expect(await name.evaluate((el) => getComputedStyle(el).textOverflow)).toBe("ellipsis");
    if (setup === "loaded") {
      expect(await name.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    }
    // The open menu stays on screen.
    await replace(page).click();
    const menu = await page.getByRole("menu").boundingBox();
    expect(menu?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((menu?.x ?? 0) + (menu?.width ?? 0)).toBeLessThanOrEqual(320);
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= 320)).toBe(true);
  }
});
