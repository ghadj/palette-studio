import { expect, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";

/** C copies the selected swatch's HEX (M3-T17; plan D17). The demo selects swatch 3. */
test("C copies the selected swatch's HEX, but not while typing in a field", async ({
  page,
  context,
  browserName,
}, info) => {
  test.skip(browserName !== "chromium", "Playwright grants clipboard permissions in Chromium only");
  test.skip(isPhoneProject(info), "keyboard shortcut");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(demo());
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  await page.keyboard.press("c");
  await expect(page.getByTestId("toast-region")).toHaveText("Copied #14386B");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("#14386B");

  // Select another swatch: C follows the selection.
  await page.locator("[data-testid=swatch-strip]:visible [data-swatch]").first().click();
  await page.keyboard.press("c");
  await expect(page.getByTestId("toast-region")).toHaveText("Copied #E8693A");

  // In a text field the key types a letter, as the shortcut rules say.
  await page
    .getByRole("spinbutton", { name: /Lightness/ })
    .first()
    .focus();
  await page.keyboard.press("c");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("#E8693A");
});
