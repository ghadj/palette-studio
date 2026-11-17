import { expect, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";

const HEX = "#E8693A\n#1DB07A\n#14386B\n#D4527F\n#1E8A2E\n#5039B0";
const CSS = [
  ":root {",
  "  --palette-1: #E8693A;",
  "  --palette-2: #1DB07A;",
  "  --palette-3: #14386B;",
  "  --palette-4: #D4527F;",
  "  --palette-5: #1E8A2E;",
  "  --palette-6: #5039B0;",
  "}",
].join("\n");

const region = (page: Page) => page.getByTestId("toast-region");

test.describe("copy HEX and CSS variables (spec 5.1, 6.3; M1 decision 7)", () => {
  test.beforeEach(async ({ browserName, page }, info) => {
    test.skip(
      browserName !== "chromium",
      "Playwright grants clipboard permissions in Chromium only",
    );
    // The export drawer is a desktop and tablet region; the phone test sets its own size.
    const phoneTest = info.title.startsWith("on phones");
    test.skip(isPhoneProject(info) && !phoneTest, "desktop viewport");
    if (!phoneTest) await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("Copy HEX puts the list on the clipboard and shows a 'Copied HEX' toast announced in a live region", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(demo());
    const drawer = page.getByTestId("export-drawer");
    await drawer.getByRole("button", { name: "Copy HEX" }).click();
    await expect(region(page)).toHaveAttribute("aria-live", "polite");
    await expect(region(page)).toHaveText("Copied HEX");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(HEX);
  });

  test("Copy CSS puts the :root block on the clipboard", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto(demo());
    await page.getByTestId("export-drawer").getByRole("button", { name: "Copy CSS" }).click();
    await expect(region(page)).toHaveText("Copied CSS");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CSS);
  });

  test("on phones the buttons sit under the swatch strip on the Source and Palette tabs", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const tab of ["source", "palette"]) {
      await page.goto(demo(`tab=${tab}`));
      await expect(page.getByTestId("export-drawer")).toHaveCount(0);
      const strip = await page.locator("[data-testid=swatch-strip]:visible").boundingBox();
      const button = page.getByRole("button", { name: "Copy HEX" });
      const box = await button.boundingBox();
      expect(box?.y ?? 0).toBeGreaterThan((strip?.y ?? 0) + (strip?.height ?? 0));
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      await button.click();
      await expect(region(page)).toHaveText("Copied HEX");
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(HEX);
    }
  });

  test("a clipboard failure shows a message that says why", async ({ page }) => {
    test.slow();
    await page.addInitScript(() => {
      Object.defineProperty(navigator.clipboard, "writeText", {
        configurable: true,
        value: () => Promise.reject(new DOMException("Denied", "NotAllowedError")),
      });
    });
    await page.goto(demo());
    await page.getByTestId("export-drawer").getByRole("button", { name: "Copy CSS" }).click();
    await expect(region(page)).toContainText("Couldn't copy the CSS");
    await expect(region(page)).toContainText("the browser didn't allow access to the clipboard");
    // The toast offers Download instead (spec 6.3).
    const download = page.waitForEvent("download");
    await region(page).getByRole("button", { name: "Download" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("Harbor mural palette.css");
    // A new failure toast stays until it is dismissed with its close button.
    await page.getByTestId("export-drawer").getByRole("button", { name: "Copy HEX" }).click();
    await expect(region(page)).toContainText("Couldn't copy the HEX");
    await page.waitForTimeout(9000);
    await expect(region(page)).toContainText("Couldn't copy the HEX");
    const close = region(page).getByRole("button", { name: "Dismiss" });
    const box = await close.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    await close.click();
    await expect(region(page).locator(".toast")).toHaveCount(0);
  });

  test("copy buttons are disabled with no palette", async ({ page }) => {
    await page.goto("./");
    await expect(
      page.getByTestId("export-drawer").getByRole("button", { name: "Copy HEX" }),
    ).toBeDisabled();
  });

  test("the toast respects reduced motion", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(demo());
    await page.getByTestId("export-drawer").getByRole("button", { name: "Copy HEX" }).click();
    const toast = region(page).locator(".toast");
    await expect(toast).toBeVisible();
    expect(await toast.evaluate((el) => getComputedStyle(el).animationDuration)).toBe("0s");
  });
});
