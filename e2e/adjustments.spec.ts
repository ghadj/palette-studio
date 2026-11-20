import { expect, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";

/** Global adjustments and Compare (M3-T6; spec 3.3, 3.6; plan decisions 24, D16). Swatch 3 is selected. */

async function open(page: Page, info: { project: { name: string } }) {
  const phone = info.project.name.startsWith("phone");
  await page.goto(demo(`${phone ? "tab=palette&" : ""}rows=adjustments`));
}

const panel = (page: Page) => page.locator("[data-testid=adjustments-panel]:visible");
const field = (page: Page, name: string) =>
  panel(page).getByRole("spinbutton", { name: new RegExp(name) });
const slider = (page: Page, name: string) => panel(page).getByLabel(`${name} slider`);
const stripSwatch = (page: Page, n: number) =>
  page.locator("[data-testid=swatch-strip]:visible [data-swatch]").nth(n - 1);
const labelOf = (page: Page, n: number) => stripSwatch(page, n).getAttribute("aria-label");
const undoButton = (page: Page) => page.locator("header").getByRole("button", { name: /^Undo/ });
const editorL = (page: Page) =>
  page
    .locator("[data-testid=swatch-editor]:visible")
    .getByRole("spinbutton", { name: /Lightness/ });

async function enter(page: Page, name: string, value: string) {
  const f = field(page, name).first();
  await f.fill(value);
  await f.press("Enter");
}

test.describe("adjustments (spec 3.3)", () => {
  test("Lightness +0.1 changes the strip hex; the editor keeps the base L 0.345 and names the adjusted color (decision 24)", async ({
    page,
  }, info) => {
    await open(page, info);
    const before = await labelOf(page, 3);
    await expect(editorL(page)).toHaveValue("0.345");
    await expect(page.getByTestId("after-adjustments")).toHaveCount(0);
    await enter(page, "^Lightness$", "0.1");
    await expect(editorL(page)).toHaveValue("0.345");
    await expect(page.locator("[data-testid=after-adjustments]:visible")).toHaveText(
      /^After adjustments #[0-9A-F]{6}$/,
    );
    expect(await labelOf(page, 3)).not.toBe(before);
  });

  test("a pinned swatch is still adjusted; a locked one is not (decision 24)", async ({
    page,
  }, info) => {
    const phone = isPhoneProject(info);
    test.skip(phone, "the editor is under the sheet on a phone; covered by the unit tests");
    await page.goto(demo("rows=adjustments"));
    const hex = page
      .locator("[data-testid=swatch-editor]:visible")
      .getByLabel("HEX", { exact: true });
    await hex.fill("#14386F");
    await hex.press("Enter");
    await expect(page.getByTestId("pin-button")).toBeVisible();
    const pinned = await labelOf(page, 3);
    await enter(page, "^Lightness$", "0.2");
    expect(await labelOf(page, 3)).not.toBe(pinned);
    await page
      .locator("[data-testid=swatch-editor]:visible")
      .getByRole("button", { name: "Lock", exact: true })
      .click();
    const locked = await labelOf(page, 3);
    await enter(page, "^Lightness$", "0.3");
    expect(await labelOf(page, 3)).toBe(locked);
  });

  test("a locked swatch stays the same", async ({ page }, info) => {
    const phone = isPhoneProject(info);
    // On a phone the open sheet covers the editor, so lock first and open Adjustments after.
    await page.goto(demo(phone ? "tab=palette" : "rows=adjustments"));
    const lock = page
      .locator("[data-testid=swatch-editor]:visible")
      .getByRole("button", { name: "Lock", exact: true });
    if ((await lock.count()) > 0) await lock.click();
    if (phone) {
      await page
        .locator("[data-panel=palette]")
        .getByRole("button", { name: "Adjustments", exact: true })
        .click();
      await expect(panel(page)).toBeVisible();
    }
    const locked = await labelOf(page, 3);
    const other = await labelOf(page, 1);
    await enter(page, "^Lightness$", "0.2");
    expect(await labelOf(page, 3)).toBe(locked);
    expect(await labelOf(page, 1)).not.toBe(other);
  });

  test("one slider drag is one undo step", async ({ page }, info) => {
    test.skip(isPhoneProject(info), "mouse drag");
    await open(page, info);
    const box = await slider(page, "Lightness").first().boundingBox();
    if (!box) throw new Error("no slider box");
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.5, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, y, { steps: 8 });
    await page.mouse.move(box.x + box.width * 0.9, y, { steps: 8 });
    await page.mouse.up();
    await expect(field(page, "^Lightness$").first()).not.toHaveValue("0.00");
    await undoButton(page).click();
    await expect(undoButton(page)).toHaveAttribute("aria-disabled", "true");
    await expect(field(page, "^Lightness$").first()).toHaveValue("0.00");
  });

  test("Reset returns the base hexes", async ({ page }, info) => {
    await open(page, info);
    const before = await labelOf(page, 1);
    await enter(page, "Hue rotate", "90");
    expect(await labelOf(page, 1)).not.toBe(before);
    await panel(page).getByRole("button", { name: "Reset" }).click();
    expect(await labelOf(page, 1)).toBe(before);
    await expect(panel(page).getByRole("button", { name: "Reset" })).toBeDisabled();
  });

  test("Compare shows the base hexes and isn't an undo step", async ({ page }, info) => {
    await open(page, info);
    const before = await labelOf(page, 1);
    await enter(page, "Hue rotate", "90");
    const adjusted = await labelOf(page, 1);
    expect(adjusted).not.toBe(before);
    const compare = panel(page).getByRole("switch", { name: "Compare to base colors" });
    await compare.click();
    expect(await labelOf(page, 1)).toBe(before);
    await compare.click();
    expect(await labelOf(page, 1)).toBe(adjusted);
    // A phone's open sheet is modal, so close it before using the header.
    if (isPhoneProject(info)) await page.keyboard.press("Escape");
    await undoButton(page).click();
    await expect(undoButton(page)).toHaveAttribute("aria-disabled", "true");
  });

  test("Copy HEX copies the adjusted hexes", async ({ page, context, browserName }, info) => {
    test.skip(
      browserName !== "chromium",
      "Playwright grants clipboard permissions in Chromium only",
    );
    test.skip(isPhoneProject(info), "the export drawer is a desktop region");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, info);
    await enter(page, "Hue rotate", "90");
    const hex = (await labelOf(page, 1))?.match(/#[0-9A-F]{6}/)?.[0];
    expect(hex).toBeTruthy();
    await page.getByTestId("export-drawer").getByRole("button", { name: "Copy HEX" }).click();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text.split("\n")[0]).toBe(hex);
    expect(text).not.toContain("#E8693A");
  });
});
