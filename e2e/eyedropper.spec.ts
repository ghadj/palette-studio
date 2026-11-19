import { expect, type Page, test } from "@playwright/test";
import { demo, isPhoneProject, showTab } from "./helpers/app";

/** The eyedropper (spec 3.2, 3.7; M3 decision 5c and D11, M3-T16). */

/** The fixture's patches (docs/design/mockup-state.md), by swatch number. */
const PATCH = {
  4: { x: 0.38, y: 0.796 },
  6: { x: 0.102, y: 0.185 },
} as const;

const strip = (page: Page) => page.locator("[data-testid=swatch-strip]:visible").first();
const swatches = (page: Page) => strip(page).locator("[data-swatch]");
const tool = (page: Page) => page.getByRole("button", { name: "Eyedropper" });
const undoButton = (page: Page) => page.locator("header").getByRole("button", { name: /^Undo/ });
const addTile = (page: Page) => page.locator("[data-testid=add-swatch]:visible").first();

/** Waits for swatch n to have this hex. */
async function expectHex(page: Page, n: number, hex: string) {
  await expect(swatches(page).nth(n - 1)).toHaveAttribute("aria-label", new RegExp(`${hex}$`));
}

/** The screen position of a point on the image. */
async function screenPoint(page: Page, p: { x: number; y: number }) {
  const image = page.locator(".image-well__image:visible").first();
  await image.scrollIntoViewIfNeeded();
  const b = await image.boundingBox();
  if (!b) throw new Error("no image box");
  return { x: b.x + p.x * b.width, y: b.y + p.y * b.height };
}

/** Dispatches a touch pointer event at a screen point. */
async function touch(page: Page, type: string, at: { x: number; y: number }) {
  await page.evaluate(
    ({ type, x, y }) => {
      const target = document.elementFromPoint(x, y) ?? document.body;
      target.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 9,
          pointerType: "touch",
          isPrimary: true,
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          button: 0,
          buttons: type === "pointerup" ? 0 : 1,
        }),
      );
    },
    { type, ...at },
  );
}

/** A click with a mouse, or a tap on phones. */
async function pick(page: Page, p: { x: number; y: number }, phone: boolean) {
  const at = await screenPoint(page, p);
  if (phone) {
    await touch(page, "pointerdown", at);
    await touch(page, "pointerup", at);
  } else {
    await page.mouse.click(at.x, at.y);
  }
}

test.describe("eyedropper (spec 3.2, 3.7)", () => {
  test("Eyedropper, then a click on patch 4, adds swatch 7 #D4527F with a marker there", async ({
    page,
  }, info) => {
    await page.goto(demo());
    await expect(tool(page)).toHaveAttribute("aria-pressed", "false");
    await tool(page).click();
    await expect(tool(page)).toHaveAttribute("aria-pressed", "true");
    await pick(page, PATCH[4], isPhoneProject(info));
    await expect(swatches(page)).toHaveCount(7);
    await expectHex(page, 7, "#D4527F");
    const marker = page.locator('[data-marker="7"]');
    await expect(marker).toHaveCount(1);
    const m = await marker.locator(".marker__ring").boundingBox();
    const at = await screenPoint(page, PATCH[4]);
    if (!m) throw new Error("no marker box");
    expect(Math.abs(m.x + m.width / 2 - at.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(m.y + m.height / 2 - at.y)).toBeLessThanOrEqual(2);
    // The new swatch is picked and locked, and stays selected.
    await expect(swatches(page).nth(6)).toHaveAttribute("aria-pressed", "true");
  });

  test("in Replace mode, a click on patch 6 makes swatch 3 #5039B0", async ({ page }, info) => {
    await page.goto(demo());
    await tool(page).click();
    const chip = page.getByRole("button", { name: "Replace swatch 3" });
    await expect(chip).toHaveAttribute("aria-pressed", "false");
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await pick(page, PATCH[6], isPhoneProject(info));
    await expect(swatches(page)).toHaveCount(6);
    await expectHex(page, 3, "#5039B0");
    const m = await page.locator('[data-marker="3"] .marker__ring').boundingBox();
    const at = await screenPoint(page, PATCH[6]);
    if (!m) throw new Error("no marker box");
    expect(Math.abs(m.x + m.width / 2 - at.x)).toBeLessThanOrEqual(2);
  });

  test("Undo removes the added swatch and restores the replaced one; Redo reapplies", async ({
    page,
  }, info) => {
    const phone = isPhoneProject(info);
    await page.goto(demo());
    await tool(page).click();
    await pick(page, PATCH[4], phone);
    await expect(swatches(page)).toHaveCount(7);
    await undoButton(page).click();
    await expect(swatches(page)).toHaveCount(6);
    await page.locator("header").getByRole("button", { name: /^Redo/ }).click();
    await expect(swatches(page)).toHaveCount(7);
    await expectHex(page, 7, "#D4527F");

    await swatches(page).nth(6).click();
    await page.getByRole("button", { name: "Replace swatch 7" }).click();
    await pick(page, PATCH[6], phone);
    await expectHex(page, 7, "#5039B0");
    await undoButton(page).click();
    await expectHex(page, 7, "#D4527F");
  });

  test("E toggles it, but not in a text field; Esc turns it off", async ({ page }, info) => {
    test.skip(isPhoneProject(info), "keyboard shortcut");
    await page.goto(demo());
    await page.locator("body").click({ position: { x: 1, y: 1 } });
    await page.keyboard.press("e");
    await expect(tool(page)).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("e");
    await expect(tool(page)).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("e");
    await page.keyboard.press("Escape");
    await expect(tool(page)).toHaveAttribute("aria-pressed", "false");

    const hex = page.getByRole("textbox", { name: "HEX" });
    await hex.focus();
    await page.keyboard.press("e");
    await expect(tool(page)).toHaveAttribute("aria-pressed", "false");
  });

  test("disabled at 12 in Add mode: a click adds nothing and the hint says why", async ({
    page,
  }, info) => {
    await page.goto(demo("tab=palette"));
    for (let i = 0; i < 6; i += 1) {
      await addTile(page).click();
      await page.getByRole("menuitem", { name: "Type a color" }).click();
    }
    await expect(swatches(page)).toHaveCount(12);
    // The "+" tile is on the Palette tab below 1024 px, the image on the Source tab (decision 32).
    await showTab(page, "Source");
    await tool(page).click();
    await expect(page.getByTestId("marker-hint")).toContainText("12");
    await pick(page, PATCH[4], isPhoneProject(info));
    await page.waitForTimeout(300);
    await expect(swatches(page)).toHaveCount(12);
    // Replace still works.
    await page.getByRole("button", { name: /^Replace swatch/ }).click();
    await pick(page, PATCH[4], isPhoneProject(info));
    await expectHex(page, 12, "#D4527F");
    await expect(swatches(page)).toHaveCount(12);
  });

  test("a press on a marker samples; it doesn't drag the marker", async ({ page }, info) => {
    await page.goto(demo());
    await tool(page).click();
    // Marker 6 is at patch 6; press on it and drag a little.
    const at = await screenPoint(page, PATCH[6]);
    if (isPhoneProject(info)) {
      await touch(page, "pointerdown", at);
      await touch(page, "pointermove", { x: at.x + 20, y: at.y + 10 });
      await touch(page, "pointerup", { x: at.x + 20, y: at.y + 10 });
    } else {
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
      await page.mouse.move(at.x + 20, at.y + 10, { steps: 4 });
      await page.mouse.up();
    }
    await expect(swatches(page)).toHaveCount(7);
    await expectHex(page, 6, "#5039B0");
    await expect(swatches(page).nth(5)).toHaveAttribute("data-origin", "extracted");
  });

  test("the + tile's Pick from image starts the eyedropper in Add mode", async ({ page }) => {
    await page.goto(demo("tab=palette"));
    await addTile(page).click();
    await page.getByRole("menuitem", { name: "Pick from image" }).click();
    await expect(tool(page)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Replace swatch 3" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("phone: a tap with the loupe works and the page doesn't scroll during the press", async ({
    page,
  }, info) => {
    test.skip(!isPhoneProject(info), "touch");
    await page.goto(demo());
    await tool(page).click();
    const at = await screenPoint(page, PATCH[4]);
    const before = await page.evaluate(() => window.scrollY);
    await touch(page, "pointerdown", at);
    const loupe = page.getByTestId("loupe");
    await expect(loupe).toBeVisible();
    await expect(loupe).toHaveAttribute("data-touch", "true");
    await expect(loupe).toContainText("#D4527F");
    const box = await loupe.boundingBox();
    if (!box) throw new Error("no loupe box");
    // Not under the finger: above it, or beside it when the well is too short.
    const covers =
      at.x >= box.x && at.x <= box.x + box.width && at.y >= box.y && at.y <= box.y + box.height;
    expect(covers).toBe(false);
    await touch(page, "pointermove", { x: at.x + 3, y: at.y - 3 });
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    const layer = page.getByTestId("eyedropper-layer");
    expect(await layer.evaluate((el) => getComputedStyle(el).touchAction)).toBe("none");
    await touch(page, "pointerup", { x: at.x + 3, y: at.y - 3 });
    await expect(loupe).toHaveCount(0);
    await expect(swatches(page)).toHaveCount(7);
  });

  test("the tool is at least 44 px on phones", async ({ page }, info) => {
    test.skip(!isPhoneProject(info), "phone sizing");
    await page.goto(demo());
    const b = await tool(page).boundingBox();
    expect(b?.width).toBeGreaterThanOrEqual(44);
    expect(b?.height).toBeGreaterThanOrEqual(44);
  });
});
