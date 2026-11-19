import { expect, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";

/** The color editor (M3-T3; spec 3.2, 3.5, 6.1; plan decision 1b). Swatch 3 is selected in the demo. */

async function open(page: Page, info: { project: { name: string } }) {
  await page.goto(demo(info.project.name.startsWith("phone") ? "tab=palette" : ""));
}

const editor = (page: Page) => page.locator("[data-testid=swatch-editor]:visible");
const field = (page: Page, name: string) =>
  editor(page).getByRole("spinbutton", { name: new RegExp(name) });
const slider = (page: Page, name: string) => editor(page).getByLabel(`${name} slider`);
const hexField = (page: Page) => editor(page).getByLabel("HEX", { exact: true });
const lock = (page: Page) => editor(page).getByRole("button", { name: "Lock", exact: true });
const stripSwatch = (page: Page, n: number) =>
  page.locator("[data-testid=swatch-strip]:visible [data-swatch]").nth(n - 1);
const undoButton = (page: Page) => page.locator("header").getByRole("button", { name: /^Undo/ });

test.describe("color editor (spec 3.2)", () => {
  test("demo: Swatch 3 shows L 0.345 and HEX #14386B", async ({ page }, info) => {
    await open(page, info);
    await expect(field(page, "Lightness")).toHaveValue("0.345");
    await expect(hexField(page)).toHaveValue("#14386B");
  });

  test("typing #1E8A2E updates strip swatch 3 and is one undo step", async ({ page }, info) => {
    await open(page, info);
    await hexField(page).fill("#1E8A2E");
    await hexField(page).press("Enter");
    await expect(stripSwatch(page, 3)).toHaveAttribute("aria-label", "Swatch 3, #1E8A2E");
    await expect(hexField(page)).toHaveValue("#1E8A2E");
    await undoButton(page).click();
    await expect(stripSwatch(page, 3)).toHaveAttribute("aria-label", "Swatch 3, #14386B");
    await expect(undoButton(page)).toHaveAttribute("aria-disabled", "true");
  });

  test("an invalid HEX is rejected and reverts", async ({ page }, info) => {
    await open(page, info);
    await hexField(page).fill("#12345");
    await expect(hexField(page)).toHaveAttribute("aria-invalid", "true");
    await hexField(page).press("Enter");
    await hexField(page).blur();
    await expect(hexField(page)).toHaveValue("#14386B");
    await expect(undoButton(page)).toHaveAttribute("aria-disabled", "true");
  });

  test("a 3-digit HEX without # is accepted", async ({ page }, info) => {
    await open(page, info);
    await hexField(page).fill("e63");
    await hexField(page).press("Enter");
    await expect(stripSwatch(page, 3)).toHaveAttribute("aria-label", "Swatch 3, #EE6633");
  });

  test("one L-slider drag is one undo step", async ({ page }, info) => {
    test.skip(isPhoneProject(info), "mouse drag");
    await open(page, info);
    const box = await slider(page, "Lightness").boundingBox();
    if (!box) throw new Error("no slider box");
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.3, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.6, y, { steps: 8 });
    await page.mouse.move(box.x + box.width * 0.8, y, { steps: 8 });
    await page.mouse.up();
    await expect(stripSwatch(page, 3)).not.toHaveAttribute("aria-label", "Swatch 3, #14386B");
    await undoButton(page).click();
    await expect(stripSwatch(page, 3)).toHaveAttribute("aria-label", "Swatch 3, #14386B");
    await expect(undoButton(page)).toHaveAttribute("aria-disabled", "true");
  });

  test("arrow keys move a focused slider", async ({ page }, info) => {
    await open(page, info);
    await slider(page, "Hue").focus();
    const before = Number(await slider(page, "Hue").inputValue());
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    expect(Number(await slider(page, "Hue").inputValue())).toBeCloseTo(before + 2, 5);
  });

  test("C 0.4 at H 150 shows 'Out of sRGB'", async ({ page }, info) => {
    await open(page, info);
    await expect(editor(page).getByText("Out of sRGB")).toHaveCount(0);
    await field(page, "Chroma").fill("0.4");
    await field(page, "Hue").fill("150");
    await field(page, "Hue").press("Enter");
    await expect(editor(page).getByText("Out of sRGB")).toBeVisible();
  });

  test("Lock toggles aria-pressed and is undoable", async ({ page }, info) => {
    await open(page, info);
    await expect(lock(page)).toHaveAttribute("aria-pressed", "false");
    await lock(page).click();
    await expect(lock(page)).toHaveAttribute("aria-pressed", "true");
    await undoButton(page).click();
    await expect(lock(page)).toHaveAttribute("aria-pressed", "false");
  });

  test("an edit pins the swatch, not locks it; Pinned unpins; Undo restores", async ({
    page,
  }, info) => {
    await open(page, info);
    const pin = editor(page).getByTestId("pin-button");
    await expect(pin).toHaveCount(0);
    await hexField(page).fill("#1E8A2E");
    await hexField(page).press("Enter");
    await expect(pin).toBeVisible();
    await expect(pin).toHaveAttribute("aria-pressed", "true");
    await expect(lock(page)).toHaveAttribute("aria-pressed", "false");
    await pin.click();
    await expect(pin).toHaveCount(0);
    await undoButton(page).click();
    await expect(pin).toBeVisible();
    await undoButton(page).click();
    await expect(pin).toHaveCount(0);
  });

  test("number fields show '0.345' with the locale forced to de-DE", async ({ browser }, info) => {
    const context = await browser.newContext({
      locale: "de-DE",
      ...(isPhoneProject(info) ? { viewport: { width: 390, height: 844 } } : {}),
    });
    const page = await context.newPage();
    await open(page, info);
    await expect(field(page, "Lightness")).toHaveValue("0.345");
    await context.close();
  });

  test("fields are 16 px with inputmode=decimal at phone width", async ({ page }, info) => {
    test.skip(!isPhoneProject(info), "phone only");
    await open(page, info);
    for (const name of ["Lightness", "Chroma", "Hue"]) {
      await expect(field(page, name)).toHaveAttribute("inputmode", "decimal");
      expect(await field(page, name).evaluate((el) => getComputedStyle(el).fontSize)).toBe("16px");
    }
    expect(await hexField(page).evaluate((el) => getComputedStyle(el).fontSize)).toBe("16px");
    await expect(hexField(page)).toHaveAttribute("autocapitalize", "off");
    await expect(hexField(page)).toHaveAttribute("autocorrect", "off");
  });

  test("controls are at least 44 px high on phones", async ({ page }, info) => {
    test.skip(!isPhoneProject(info), "phone only");
    await open(page, info);
    for (const loc of [field(page, "Lightness"), hexField(page), lock(page)]) {
      const box = await loc.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
});
