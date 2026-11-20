import { expect, type Page, test } from "@playwright/test";
import { hexToOklab } from "../src/color/convert";
import { deltaEOK } from "../src/color/delta-e";
import { GRAYSCALE_RED, STUDIO_BACKDROP } from "../tools/fixture-colors";
import { fixture } from "./helpers/files";
import { isSheetLayout, openRow } from "./helpers/rows";
import { sheetSettled } from "./helpers/sheet";

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

/** Opens Filters in place from 1024 px, or as a bottom sheet below (M3 decision 34). */
async function openFilters(page: Page) {
  await openRow(page, "Filters");
  await expect(page.locator("#setting-ignore-dark:visible")).toBeVisible();
}

/** True once the Filters row is open: its `open` attribute, or the sheet below 1024 px. */
async function filtersOpen(page: Page) {
  if (await isSheetLayout(page)) {
    await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
  } else {
    await expect(page.locator("[data-testid=filters-row]:visible")).toHaveAttribute("open", "");
  }
}

const lightness = (hex: string) => hexToOklab(hex).l;

/** The Ignore background status note; it is empty, so it has no size, while there is no note. */
const backgroundNote = (page: Page) =>
  page.locator("[data-testid=filters-row]:visible #setting-ignore-background-note");

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

  // The plan's "leaves no swatch within ΔE OK 0.04 of #ECEAE6" can't hold on this fixture: the
  // enclosed #ECEAE6 patch is kept (decision 4), so it forms its own small swatch. This test checks
  // the backdrop is removed (user decision 4b).
  test("Ignore background Auto on studio-backdrop.png removes the backdrop: the subject's colors lead and only the enclosed patch's swatch stays near #ECEAE6", async ({
    page,
  }) => {
    const backdrop = hexToOklab(STUDIO_BACKDROP.backdrop);
    const near = (hex: string) => deltaEOK(hexToOklab(hex), backdrop) <= 0.04;
    const { left, right } = STUDIO_BACKDROP.subject;
    await page.getByTestId("file-input").setInputFiles(fixture("studio-backdrop.png"));
    await expect(strip(page).first()).toBeVisible();
    await settled(page);
    // Off: the backdrop, 75% of the image, is the first swatch by population.
    expect(near((await hexes(page))[0] ?? "")).toBe(true);
    await openFilters(page);
    const select = page.locator("#setting-ignore-background:visible");
    await expect(select).toHaveValue("off");
    await select.selectOption({ label: "Auto" });
    await expect
      .poll(async () => (await hexes(page)).slice(0, 2).sort())
      .toEqual([left, right].sort());
    await settled(page);
    const after = await hexes(page);
    expect(after.slice(0, 2).sort()).toEqual([left, right].sort());
    // At most one swatch stays near the backdrop color, and it is the enclosed patch: small (at most 5%
    // of the kept pixels). Its rank isn't checked: the resampled edges between the subject and
    // the patch can form a swatch of their own, larger than the patch in Chromium and smaller in
    // Firefox, depending on the browser's downscale.
    const nearIndexes = after.flatMap((h, i) => (near(h) ? [i] : []));
    expect(nearIndexes.length).toBeLessThanOrEqual(1);
    if (nearIndexes.length === 1) {
      const shares = await strip(page).evaluateAll((els) =>
        els.map((e) => Number(e.getAttribute("data-share"))),
      );
      // The near swatch is small next to the backdrop's own 75% share: at most 5% of the kept
      // pixels. The bound is loose on purpose, since browsers resample the edges between the
      // subject and the enclosed patch differently (Linux WebKit blends about 3x the patch's
      // area into it). A backdrop left in would be far larger.
      const nearShare = shares[nearIndexes[0] ?? 0] ?? Number.NaN;
      expect(nearShare).toBeGreaterThan(0);
      expect(nearShare).toBeLessThanOrEqual(0.05);
    }
    // A background was found, so no note shows.
    await expect(backgroundNote(page)).toHaveText("");
  });

  test("a busy border shows 'None found'", async ({ page }) => {
    // twelve-colors.png: twelve stripes, so no color covers half the border band.
    await page.getByTestId("file-input").setInputFiles(fixture("twelve-colors.png"));
    await expect(strip(page).first()).toBeVisible();
    await settled(page);
    const before = await hexes(page);
    await openFilters(page);
    const select = page.locator("#setting-ignore-background:visible");
    const note = backgroundNote(page);
    // The note is a live region, empty until Auto finds nothing (spec 6.3; decision 18).
    await expect(note).toHaveAttribute("role", "status");
    await expect(note).toHaveAttribute("aria-live", "polite");
    await expect(note).toHaveText("");
    await expect(select).not.toHaveAttribute("aria-describedby");
    await select.selectOption({ label: "Auto" });
    await expect(note).toHaveText("None found");
    await expect(select).toHaveAttribute("aria-describedby", "setting-ignore-background-note");
    await settled(page);
    // Nothing is removed.
    expect(await hexes(page)).toEqual(before);
    // Off again: the note goes.
    await select.selectOption({ label: "Off" });
    await expect(note).toHaveText("");
    await expect(select).not.toHaveAttribute("aria-describedby");
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
    if (await isSheetLayout(page)) await expect(page.getByRole("dialog")).toHaveCount(0);
    else
      await expect(page.locator("[data-testid=filters-row]:visible")).not.toHaveAttribute(
        "open",
        "",
      );
    // Order: Preset above Algorithm (M2 decision 2a), then Working space, Filters and Advanced
    // (M2 decision 2b).
    const order = await page
      .locator("[data-testid=setting-rows]:visible")
      .first()
      .evaluate((el) =>
        [...el.children].map(
          (c) =>
            c.querySelector("summary, .chevron-row__summary")?.textContent ??
            c.querySelector(".setting-row__label")?.textContent ??
            "",
        ),
      );
    expect(order.slice(0, 6)).toEqual([
      "Preset",
      "Algorithm",
      "Colors",
      "Working space",
      "Filters",
      "Advanced",
    ]);
    await page.goto("./?demo=mockup&rows=filters");
    await filtersOpen(page);
    await expect(page.locator("#setting-ignore-dark:visible")).toBeVisible();
  });

  test("at 320 px the open Filters rows fit without sideways scroll, with 44 px controls (spec 6.1)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("./?demo=mockup&rows=filters");
    await expect(page.locator("#setting-ignore-dark:visible")).toBeVisible();
    // At 320 px Filters is a drawer (decision 34); measure its resting geometry, not the slide-in.
    await sheetSettled(page);
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
      "#setting-ignore-background",
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
