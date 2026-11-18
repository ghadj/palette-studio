import { expect, type Page, test } from "@playwright/test";
import { hexToOklab } from "../src/color/convert";
import { GRAYSCALE_RED } from "../tools/fixture-colors";
import { fixture } from "./helpers/files";

// Pixel filters (spec 2.1 step 3, 2.4; M2 decisions 2b, 3 and 18).

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

async function openFilters(page: Page) {
  const row = page.locator("[data-testid=filters-row]:visible");
  await expect(row).not.toHaveAttribute("open", "");
  await row.locator("summary").click();
  await expect(row).toHaveAttribute("open", "");
}

const lightness = (hex: string) => hexToOklab(hex).l;

test.describe("pixel filters (spec 2.1, 2.4)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
  });

  test("Ignore light on white-background.png leaves no swatch with L above 0.95", async ({
    page,
  }) => {
    await page.getByTestId("file-input").setInputFiles(fixture("white-background.png"));
    await expect(strip(page).first()).toBeVisible();
    await settled(page);
    // Unfiltered, the white background is the main swatch.
    expect((await hexes(page)).some((h) => lightness(h) > 0.95)).toBe(true);
    await openFilters(page);
    const toggle = page.locator("#setting-ignore-light:visible");
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect
      .poll(async () => (await hexes(page)).every((h) => lightness(h) <= 0.95))
      .toBe(true);
    await settled(page);
    const after = await hexes(page);
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((h) => lightness(h) <= 0.95)).toBe(true);
    expect(after).toContain("#E8693A");
  });

  test("Minimum chroma 0.05 on grayscale-plus-red.png gives only red", async ({ page }) => {
    await page.getByTestId("file-input").setInputFiles(fixture("grayscale-plus-red.png"));
    await expect(strip(page).first()).toBeVisible();
    await settled(page);
    expect((await hexes(page)).length).toBeGreaterThan(1);
    await openFilters(page);
    const field = page.locator("#setting-min-chroma:visible");
    await expect(field).toHaveValue("0.00");
    await expect(field).toHaveAttribute("inputmode", "decimal");
    await field.fill("0,05");
    await expect.poll(() => hexes(page)).toEqual([GRAYSCALE_RED]);
    await settled(page);
    expect(await hexes(page)).toEqual([GRAYSCALE_RED]);
    // The field shows a period whatever was typed.
    await field.blur();
    await expect(field).toHaveValue("0.05");
  });

  test("filtering everything shows 'Every pixel is filtered out. Loosen a filter.' in a live region and an empty strip; loosening it brings the palette back", async ({
    page,
  }) => {
    await page.getByTestId("file-input").setInputFiles(fixture("two-color.png"));
    await expect(strip(page)).toHaveCount(2);
    await settled(page);
    await openFilters(page);
    await page.locator("#setting-ignore-dark:visible").click();
    // Every pixel has L below 1, so a dark threshold of 1 drops them all.
    await page.locator("#setting-dark-threshold:visible").fill("1");
    const region = page.getByTestId("image-message");
    await expect(region).toHaveAttribute("role", "status");
    await expect(region).toHaveAttribute("aria-live", "polite");
    await expect(region).toHaveText("Every pixel is filtered out. Loosen a filter.");
    await expect(strip(page)).toHaveCount(0);

    await page.locator("#setting-ignore-dark:visible").click();
    await expect(strip(page)).toHaveCount(2);
    await settled(page);
    expect(await hexes(page)).toEqual(["#1DB07A", "#5039B0"]);
    await expect(region).toHaveText("");
  });

  test("the threshold slider is disabled while its toggle is off", async ({ page }) => {
    await openFilters(page);
    for (const [toggleId, sliderName, fieldId, value] of [
      ["#setting-ignore-dark", "Dark threshold slider", "#setting-dark-threshold", "0.20"],
      ["#setting-ignore-light", "Light threshold slider", "#setting-light-threshold", "0.95"],
    ] as const) {
      const toggle = page.locator(`${toggleId}:visible`);
      const slider = page.getByRole("slider", { name: sliderName }).filter({ visible: true });
      const field = page.locator(`${fieldId}:visible`);
      await expect(toggle).toHaveAttribute("role", "switch");
      await expect(toggle).toHaveAttribute("aria-checked", "false");
      // Disabled, not hidden, and the value is kept (M1 decision 14).
      await expect(slider).toBeVisible();
      await expect(slider).toBeDisabled();
      await expect(field).toBeDisabled();
      await expect(field).toHaveValue(value);
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-checked", "true");
      await expect(slider).toBeEnabled();
      await expect(field).toBeEnabled();
      await expect(slider).toHaveValue(String(Number(value)));
      await toggle.click();
      await expect(slider).toBeDisabled();
    }
  });

  test("the Filters row starts collapsed after Working space and opens with rows=filters in the mockup state", async ({
    page,
  }) => {
    const row = page.locator("[data-testid=filters-row]:visible");
    await expect(row).not.toHaveAttribute("open", "");
    // Order: Working space, then Filters, then Advanced (M2 decision 2b).
    const order = await page
      .locator("[data-testid=setting-rows]:visible")
      .first()
      .evaluate((el) =>
        [...el.children].map(
          (c) =>
            c.querySelector("summary")?.textContent ??
            c.querySelector(".setting-row__label")?.textContent ??
            "",
        ),
      );
    expect(order.slice(0, 5)).toEqual([
      "Algorithm",
      "Colors",
      "Working space",
      "Filters",
      "Advanced",
    ]);
    await page.goto("./?demo=mockup&rows=filters");
    await expect(page.locator("[data-testid=filters-row]:visible")).toHaveAttribute("open", "");
    await expect(page.locator("#setting-ignore-dark:visible")).toBeVisible();
  });

  test("at 320 px the open Filters rows fit without sideways scroll, with 44 px controls (spec 6.1)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("./?demo=mockup&rows=filters");
    await expect(page.locator("#setting-ignore-dark:visible")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);
    const ids = [
      "#setting-ignore-dark",
      "#setting-dark-threshold",
      "#setting-ignore-light",
      "#setting-light-threshold",
      "#setting-min-chroma",
      "#setting-alpha-cutoff",
    ];
    for (const id of ids) {
      const b = await page.locator(`${id}:visible`).boundingBox();
      expect(b, id).not.toBeNull();
      expect(b?.width ?? 0, id).toBeGreaterThanOrEqual(44);
      expect(b?.height ?? 0, id).toBeGreaterThanOrEqual(44);
      expect((b?.x ?? 0) + (b?.width ?? 0), id).toBeLessThanOrEqual(320);
    }
  });
});
