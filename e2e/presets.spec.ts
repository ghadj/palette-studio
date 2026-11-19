import { expect, type Page, test } from "@playwright/test";
import { hexToOklab } from "../src/color/convert";
import { TWELVE_COLORS } from "../tools/fixture-colors";
import { hasHorizontalScroll } from "./helpers/app";
import { fixture } from "./helpers/files";

// Presets (spec 2.5; M2 decisions 2a and 11).

const strip = (page: Page) =>
  page.locator("[data-testid=swatch-strip]:visible").first().locator("[data-swatch]");

async function hexes(page: Page): Promise<string[]> {
  const labels = await strip(page).evaluateAll((els) =>
    els.map((e) => e.getAttribute("aria-label") ?? ""),
  );
  return labels.map((l) => l.split(", ")[1] ?? "");
}

async function settled(page: Page) {
  await expect(page.locator("[data-testid=swatch-strip][data-busy]")).toHaveCount(0);
}

const preset = (page: Page) => page.locator("#setting-preset:visible");

test.describe("presets (spec 2.5)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
  });

  test("the Preset row sits above Algorithm and starts at Balanced", async ({ page }) => {
    const labels = await page
      .locator("[data-testid=setting-rows]:visible")
      .first()
      .locator(":scope > .setting-row .setting-row__label")
      .allTextContents();
    expect(labels.slice(0, 2)).toEqual(["Preset", "Algorithm"]);
    await expect(preset(page)).toHaveValue("balanced");
    await expect(preset(page).locator("option:checked")).toHaveText("Balanced");
    // Custom is offered only while no preset matches.
    await expect(preset(page).locator("option")).toHaveText([
      "Dominant",
      "Balanced",
      "Vibrant",
      "Flat art",
      "Accents",
      "Swatch roles",
    ]);
  });

  test("Flat art on twelve-colors.png gives all 12 hexes", async ({ page }) => {
    await page.getByTestId("file-input").setInputFiles(fixture("twelve-colors.png"));
    await expect(strip(page).first()).toBeVisible();
    await settled(page);
    // Flat art keeps Colors (decision 11), so ask for 12 first.
    await page.locator("#setting-colors:visible").fill("12");
    await preset(page).selectOption({ label: "Flat art" });
    await expect(page.locator("#setting-algorithm:visible")).toHaveValue("exact");
    await expect(strip(page)).toHaveCount(12);
    await settled(page);
    await expect
      .poll(async () => [...(await hexes(page))].sort())
      .toEqual([...TWELVE_COLORS].sort());
    await expect(preset(page)).toHaveValue("flat-art");
    await page.locator('details.chevron-row:visible summary:has-text("Advanced")').click();
    await expect(page.locator("#setting-resampling:visible")).toHaveValue("nearest");
    await expect(page.locator("#setting-merge:visible")).toHaveValue("0.000");
  });

  test("Vibrant on white-background.png has no swatch above L 0.95", async ({ page }) => {
    await page.getByTestId("file-input").setInputFiles(fixture("white-background.png"));
    await expect(strip(page).first()).toBeVisible();
    await settled(page);
    expect((await hexes(page)).some((h) => hexToOklab(h).l > 0.95)).toBe(true);
    await preset(page).selectOption({ label: "Vibrant" });
    await expect(page.locator("#setting-algorithm:visible")).toHaveValue("kmeans");
    await expect
      .poll(async () => (await hexes(page)).every((h) => hexToOklab(h).l <= 0.95))
      .toBe(true);
    await settled(page);
    const after = await hexes(page);
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((h) => hexToOklab(h).l <= 0.95)).toBe(true);
    // Vibrant turns both lightness filters on.
    await page.locator("[data-testid=filters-row]:visible summary").click();
    await expect(page.locator("#setting-ignore-dark:visible")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(page.locator("#setting-ignore-light:visible")).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("changing Colors after Dominant shows Custom", async ({ page }) => {
    await preset(page).selectOption({ label: "Dominant" });
    await expect(preset(page)).toHaveValue("dominant");
    await expect(page.locator("#setting-algorithm:visible")).toHaveValue("median-cut");
    await expect(page.locator("#setting-colors:visible")).toHaveValue("6");
    await page.locator("#setting-colors:visible").fill("8");
    await expect(preset(page)).toHaveValue("custom");
    await expect(preset(page).locator("option:checked")).toHaveText("Custom");
    // Custom can't be chosen; it only names settings that match no preset.
    await expect(preset(page).locator("option:checked")).toBeDisabled();
    // Choosing Dominant again restores its 6 colors.
    await preset(page).selectOption({ label: "Dominant" });
    await expect(page.locator("#setting-colors:visible")).toHaveValue("6");
    await expect(preset(page)).toHaveValue("dominant");
  });

  test("the Algorithm select follows a preset, and an algorithm change can land on another preset", async ({
    page,
  }) => {
    await preset(page).selectOption({ label: "Swatch roles" });
    await expect(page.locator("#setting-algorithm:visible")).toHaveValue("swatch-roles");
    await page.locator("#setting-algorithm:visible").selectOption({ label: "Wu" });
    await expect(preset(page)).toHaveValue("custom");
    await page.locator("#setting-algorithm:visible").selectOption({ label: "Balanced" });
    await expect(preset(page)).toHaveValue("balanced");
  });

  test("the Preset select is keyboard operable and 44 px at phone width", async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("./?demo=mockup");
    const select = preset(page);
    await expect(select).toHaveValue("balanced");
    if (info.project.name.includes("webkit")) {
      // WebKit on macOS tabs only to some form controls by default (as in zoom.spec.ts).
      await select.focus();
    } else {
      // Reach it with Tab from the image well, which comes before it in the page.
      await page.locator("[data-testid=image-well]:visible").focus();
      for (let i = 0; i < 40; i++) {
        if (await select.evaluate((el) => el === document.activeElement)) break;
        await page.keyboard.press("Tab");
      }
    }
    await expect(select).toBeFocused();
    // Type-ahead picks an option on a closed select in every engine.
    await page.keyboard.type("F");
    await expect(select).toHaveValue("flat-art");
    await expect(page.locator("#setting-algorithm:visible")).toHaveValue("exact");
    const b = await select.boundingBox();
    expect(b).not.toBeNull();
    expect(b?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(b?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((b?.x ?? 0) + (b?.width ?? 0)).toBeLessThanOrEqual(320);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});
