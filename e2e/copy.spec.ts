import { expect, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";
import { openExport } from "./helpers/sheet";

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
    // The export drawer is a desktop region (1024 px and up); the phone test sets its own size.
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
    const drawer = await openExport(page);
    await drawer.getByRole("button", { name: "Copy HEX" }).click();
    await expect(region(page)).toHaveAttribute("aria-live", "polite");
    await expect(region(page)).toHaveText("Copied HEX");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(HEX);
  });

  test("Copy CSS puts the :root block on the clipboard", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(demo());
    await (await openExport(page)).getByRole("button", { name: "Copy CSS" }).click();
    await expect(region(page)).toHaveText("Copied CSS");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CSS);
  });

  test("on phones the header's Export button opens the Palette section with the copy buttons", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    // Phones and medium screens share the tabbed layout (decision 4 as revised); M3 decision 53.
    for (const [width, height] of [
      [390, 844],
      [820, 1180],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto(demo("tab=source"));
      await expect(page.getByTestId("export-panel")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Copy HEX", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Copy CSS", exact: true })).toHaveCount(0);
      await page.goto(demo("tab=palette"));
      const sheet = await openExport(page);
      await sheet.getByRole("button", { name: "Copy HEX", exact: true }).click();
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
    const panel = await openExport(page);
    await panel.getByRole("button", { name: "Copy CSS" }).click();
    await expect(region(page)).toContainText("Couldn't copy the CSS");
    await expect(region(page)).toContainText("the browser didn't allow access to the clipboard");
    // The toast offers Download instead (spec 6.3).
    const download = page.waitForEvent("download");
    await region(page).getByRole("button", { name: "Download" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("Harbor mural palette.css");
    // A new failure toast stays until it is dismissed with its close button.
    await panel.getByRole("button", { name: "Copy HEX" }).click();
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
    await expect((await openExport(page)).getByRole("button", { name: "Copy HEX" })).toBeDisabled();
  });

  test("the toast respects reduced motion", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(demo());
    await (await openExport(page)).getByRole("button", { name: "Copy HEX" }).click();
    const toast = region(page).locator(".toast");
    await expect(toast).toBeVisible();
    expect(await toast.evaluate((el) => getComputedStyle(el).animationDuration)).toBe("0s");
  });
});
