/**
 * M4-T14: flows across the palette and the gradient (spec 4.2, 4.3; plan Q1a, v1 acceptance 5). The
 * fixture gradient is live: Smooth path over swatches 2, 4 and 6, its middle stop linked to swatch 4
 * (#D4527F).
 */
import { expect, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";
import { fixture } from "./helpers/files";

const preview = (page: Page) => page.getByTestId("gradient-preview");
const technique = (page: Page) => page.getByTestId("technique-value");
const handles = (page: Page) => page.getByTestId("stop-handle");
const strip = (page: Page) =>
  page.locator("[data-testid=swatch-strip]:visible").first().locator("[data-swatch]");
const stopsOf = async (page: Page) =>
  ((await preview(page).getAttribute("data-stops")) ?? "").split(",");
/** All the stops, as `data-stops` has them. Smooth path orders by color, so a stop can move. */
const all = async (page: Page) => (await preview(page).getAttribute("data-stops")) ?? "";

test.describe("gradient flows (M4-T14)", () => {
  test("a marker drag, an adjustment and a HEX edit each change the linked stop", async ({
    page,
  }, info) => {
    test.skip(
      isPhoneProject(info),
      "the image, strip and gradient are on different tabs on phones",
    );
    await page.setViewportSize({ width: 1280, height: 1500 });
    await page.goto(demo("rows=adjustments"));
    await expect(preview(page)).toBeVisible();
    expect(await all(page)).toContain("#D4527F@50");

    // Dragging marker 4 changes the stop before release.
    const dragged = await all(page);
    const marker = page.locator('[data-marker="4"] .marker__ring');
    const b = await marker.boundingBox();
    if (!b) throw new Error("no marker");
    const from = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= 20; i += 1) await page.mouse.move(from.x + i * 4, from.y + i * 6);
    await expect.poll(() => all(page)).not.toBe(dragged);
    await page.mouse.up();
    await expect(technique(page)).not.toHaveText("Custom");

    // A HEX edit of swatch 4 (which also clears its marker, spec 3.7).
    await strip(page).nth(3).click();
    const hex = page
      .locator("[data-testid=swatch-editor]:visible")
      .getByLabel("HEX", { exact: true });
    await hex.fill("#112233");
    await hex.press("Enter");
    await expect.poll(() => all(page)).toContain("#112233@");
    await expect(technique(page)).not.toHaveText("Custom");

    // A global adjustment reaches the linked stop, too.
    const lightness = page
      .locator("[data-testid=adjustments-panel]:visible")
      .getByRole("spinbutton", { name: /^Lightness$/ })
      .first();
    const edited = await all(page);
    await lightness.fill("0.2");
    await lightness.press("Enter");
    await expect.poll(() => all(page)).not.toBe(edited);
    await expect(technique(page)).not.toHaveText("Custom");
  });

  test("Colors 6 → 5 rebuilds a live gradient", async ({ page }, info) => {
    test.skip(isPhoneProject(info), "the Colors slider and the stop bar are on different tabs");
    await page.setViewportSize({ width: 1280, height: 1200 });
    await page.goto("./");
    await page.getByTestId("file-input").setInputFiles(fixture("twelve-colors.png"));
    await expect(strip(page)).toHaveCount(6);
    await expect(page.locator("[data-testid=swatch-strip][data-busy]")).toHaveCount(0);
    // Smooth path over all colors: one stop per swatch.
    await expect(handles(page)).toHaveCount(6);
    await page
      .locator(".slider:visible")
      .first()
      .evaluate((el) => {
        (el as HTMLInputElement).value = "5";
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });
    await expect(strip(page)).toHaveCount(5);
    await expect(handles(page)).toHaveCount(5);
    await expect(technique(page)).not.toHaveText("Custom");
    await page.locator("header").getByRole("button", { name: "Undo Colors" }).click();
    await expect(strip(page)).toHaveCount(6);
    await expect(handles(page)).toHaveCount(6);
  });

  test("custom + a swatch delete gives a fixed stop", async ({ page }, info) => {
    test.skip(isPhoneProject(info), "the strip's remove button is behind the sheet on phones");
    await page.setViewportSize({ width: 1280, height: 1280 });
    await page.goto(demo("rows=stop"));
    await expect(handles(page)).toHaveCount(3);
    // Moving a stop makes the gradient custom, so its stops are stored.
    await handles(page).nth(1).focus();
    await page.keyboard.press("Shift+ArrowLeft");
    await expect(technique(page)).toHaveText("Custom");
    expect((await stopsOf(page))[1]).toMatch(/^#D4527F@(39|40)/);
    // Deleting the swatch the stop followed leaves a stop with that color, no longer linked.
    await strip(page).nth(3).click();
    await page.getByRole("button", { name: "Remove swatch 4" }).click();
    await expect(strip(page)).toHaveCount(5);
    await expect(handles(page)).toHaveCount(3);
    expect((await stopsOf(page))[1]).toMatch(/^#D4527F@(39|40)/);
    const row = page.getByTestId("row-stop");
    await expect(row.getByText("Swatch removed")).toBeVisible();
    await expect(row.getByRole("radio", { checked: true })).toHaveCount(0);
  });

  test("v1 acceptance 5: Linear, Radial and Conic render without error from every technique in OKLCH", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "desktop: the type chips and the preview are in view together");
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 1100 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    for (const kind of [
      "palette-order",
      "sorted",
      "smooth-path",
      "image-sample",
      "derived",
      "random",
      "population",
    ]) {
      await page.goto(demo(`technique=${kind}&space=oklch`));
      await expect(handles(page).first()).toBeVisible();
      for (const [label, type] of [
        ["Linear", "linear"],
        ["Radial", "radial"],
        ["Conic", "conic"],
      ] as const) {
        await page.getByTestId("gradient-types").getByRole("button", { name: label }).click();
        await expect(preview(page)).toHaveAttribute("data-type", type);
        await expect(preview(page)).toHaveAttribute("data-space", "oklch");
        expect(
          await preview(page).evaluate((el) => getComputedStyle(el).backgroundImage),
          `${kind} ${type}`,
        ).toContain(`${type}-gradient(`);
        expect((await stopsOf(page)).length, `${kind} ${type}: stops`).toBeGreaterThanOrEqual(2);
      }
    }
    expect(errors).toEqual([]);
  });
});
