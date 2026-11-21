/**
 * M4-T6: the type chips and the Geometry row (spec 4.1, 4.3; plan D21, D24).
 */
import { expect, type Locator, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";
import { sheetSettled } from "./helpers/sheet";

const undoButton = (page: Page) => page.locator("header").getByRole("button", { name: /^Undo/ });

async function open(page: Page, info: Parameters<typeof isPhoneProject>[0], query = "") {
  if (isPhoneProject(info)) await page.goto(demo(`tab=gradient&rows=geometry&${query}`));
  else {
    await page.setViewportSize({ width: 1280, height: 1280 });
    await page.goto(demo(`rows=geometry&${query}`));
  }
  await expect(page.getByTestId("geometry-panel")).toBeVisible();
  if (isPhoneProject(info)) await sheetSettled(page);
}

const rowLabel = (panel: Locator, text: string) =>
  panel.locator(".setting-row__label").filter({ hasText: new RegExp(`^${text}$`) });

/** Undo by shortcut: on phones the sheet covers the header's button. */
async function undo(page: Page) {
  await page.keyboard.press("ControlOrMeta+z");
}

const preview = (page: Page) => page.getByTestId("gradient-preview");

/** Closes a phone sheet, so the type chips behind it can be used. */
async function closeSheet(page: Page, info: Parameters<typeof isPhoneProject>[0]) {
  if (!isPhoneProject(info)) return;
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // The sheet gives focus back to its row after it leaves the DOM; a chip focused before that
  // would lose it again, and the next key would go to the row.
  await expect(page.locator(".chevron-row__button:focus")).toHaveCount(1);
}

test.describe("Type chips and Geometry (M4-T6)", () => {
  test("the chips set data-type, each change one undo step", async ({ page }, info) => {
    await open(page, info);
    await closeSheet(page, info);
    const chips = page.getByTestId("gradient-types");
    await chips.getByRole("button", { name: "Radial" }).click();
    await expect(preview(page)).toHaveAttribute("data-type", "radial");
    await chips.getByRole("button", { name: "Conic" }).click();
    await expect(preview(page)).toHaveAttribute("data-type", "conic");
    await undoButton(page).click();
    await expect(preview(page)).toHaveAttribute("data-type", "radial");
    await undoButton(page).click();
    await expect(preview(page)).toHaveAttribute("data-type", "linear");
    await expect(undoButton(page)).toHaveAttribute("aria-disabled", "true");
  });

  test("arrow keys, Home and End move between the chips", async ({ page }, info) => {
    await open(page, info);
    await closeSheet(page, info);
    const chips = page.getByTestId("gradient-types");
    await chips.getByRole("button", { name: "Linear" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(preview(page)).toHaveAttribute("data-type", "radial");
    await page.keyboard.press("End");
    await expect(preview(page)).toHaveAttribute("data-type", "conic");
    await page.keyboard.press("Home");
    await expect(preview(page)).toHaveAttribute("data-type", "linear");
  });

  test("Angle and Center commit on Enter or blur, not per keystroke; one undo step", async ({
    page,
  }, info) => {
    await open(page, info);
    const panel = page.getByTestId("geometry-panel");
    const angle = panel.locator("#geometry-angle-field");
    await angle.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("45");
    await expect(preview(page)).toHaveAttribute("data-angle", "90");
    await page.keyboard.press("Enter");
    await expect(preview(page)).toHaveAttribute("data-angle", "45");
    await angle.evaluate((el) => (el as HTMLElement).blur());
    await undo(page);
    await expect(preview(page)).toHaveAttribute("data-angle", "90");
    await angle.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("120");
    await expect(preview(page)).toHaveAttribute("data-angle", "90");
    await angle.evaluate((el) => (el as HTMLElement).blur());
    await expect(preview(page)).toHaveAttribute("data-angle", "120");
  });

  test("the eight angle presets form a 4 by 2 grid", async ({ page }, info) => {
    await open(page, info);
    const buttons = page.getByTestId("angle-presets").getByRole("button");
    await expect(buttons).toHaveCount(8);
    const tops = await buttons.evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().top)),
    );
    expect(new Set(tops).size).toBe(2);
    expect(tops.filter((t) => t === tops[0])).toHaveLength(4);
  });

  test("dragging the dial to the right of its center sets data-angle 90; the 45 preset sets 45", async ({
    page,
  }, info) => {
    await open(page, info);
    const dial = page.getByTestId("geometry-angle-dial");
    const b = await dial.boundingBox();
    if (!b) throw new Error("no dial");
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    await page.mouse.move(cx, cy - 10);
    await page.mouse.down();
    await page.mouse.move(cx + 12, cy - 12, { steps: 3 });
    await page.mouse.move(cx + 15, cy, { steps: 3 });
    await page.mouse.up();
    await expect(preview(page)).toHaveAttribute("data-angle", "90");
    await expect(dial).toHaveAttribute("aria-valuenow", "90");
    // One drag is one undo step.
    await expect(undoButton(page)).toHaveAccessibleName(/Angle/);
    await undo(page);
    await expect(undoButton(page)).toHaveAttribute("aria-disabled", "true");
    await page.getByTestId("angle-presets").getByRole("button", { name: "45°" }).click();
    await expect(preview(page)).toHaveAttribute("data-angle", "45");
  });

  test("ArrowRight on the dial adds 1; Shift+ArrowRight adds 15", async ({ page }, info) => {
    await open(page, info);
    const dial = page.getByTestId("geometry-angle-dial");
    await dial.focus();
    await page.keyboard.press("ArrowRight");
    await expect(preview(page)).toHaveAttribute("data-angle", "91");
    await page.keyboard.press("Shift+ArrowRight");
    await expect(preview(page)).toHaveAttribute("data-angle", "106");
    await page.keyboard.press("ArrowLeft");
    await expect(preview(page)).toHaveAttribute("data-angle", "105");
  });

  test("Radial shows Shape, Size and Center; Linear doesn't", async ({ page }, info) => {
    await open(page, info);
    const panel = page.getByTestId("geometry-panel");
    await expect(rowLabel(panel, "Angle")).toBeVisible();
    await expect(rowLabel(panel, "Shape")).toHaveCount(0);
    await expect(rowLabel(panel, "Size")).toHaveCount(0);
    await expect(rowLabel(panel, "Center X %")).toHaveCount(0);
    await closeSheet(page, info);
    await page.getByTestId("gradient-types").getByRole("button", { name: "Radial" }).click();
    if (isPhoneProject(info)) {
      await page.getByRole("button", { name: /^Geometry/ }).click();
      await sheetSettled(page);
    }
    await expect(rowLabel(panel, "Shape")).toBeVisible();
    await expect(rowLabel(panel, "Size")).toBeVisible();
    await expect(rowLabel(panel, "Center X %")).toBeVisible();
    await expect(rowLabel(panel, "Center Y %")).toBeVisible();
    await expect(rowLabel(panel, "Angle")).toHaveCount(0);
    await expect(rowLabel(panel, "Reverse")).toBeVisible();
    await expect(rowLabel(panel, "Mirror")).toBeVisible();
  });

  test("Reverse gives data-stops #5039B0@0,#D4527F@50,#1DB07A@100; Mirror gives 5 stops", async ({
    page,
  }, info) => {
    await open(page, info);
    await page.getByRole("switch", { name: "Reverse" }).click();
    await expect(preview(page)).toHaveAttribute("data-stops", "#5039B0@0,#D4527F@50,#1DB07A@100");
    await page.getByRole("switch", { name: "Reverse" }).click();
    await page.getByRole("switch", { name: "Mirror" }).click();
    const stops = await preview(page).getAttribute("data-stops");
    expect(stops?.split(",")).toHaveLength(5);
  });

  test("reset icons show only when a row differs; each reset is one step", async ({
    page,
  }, info) => {
    await open(page, info);
    const panel = page.getByTestId("geometry-panel");
    await expect(panel.getByTestId("geometry-reset-row")).toHaveCount(0);
    await page.getByRole("switch", { name: "Reverse" }).click();
    await page.getByTestId("angle-presets").getByRole("button", { name: "45°" }).click();
    await expect(panel.getByTestId("geometry-reset-row")).toHaveCount(2);
    await panel.getByRole("button", { name: "Reset Angle" }).click();
    await expect(preview(page)).toHaveAttribute("data-angle", "90");
    await expect(panel.getByTestId("geometry-reset-row")).toHaveCount(1);
    await undo(page);
    await expect(preview(page)).toHaveAttribute("data-angle", "45");
    await panel.getByRole("button", { name: "Reset Angle" }).click();
    await panel.getByRole("button", { name: "Reset Reverse" }).click();
    await expect(panel.getByTestId("geometry-reset-row")).toHaveCount(0);
  });

  test("the header shows a count and a reset-all that is one step", async ({ page }, info) => {
    if (isPhoneProject(info)) test.skip(true, "the header sits behind the sheet on phones");
    await open(page, info);
    const row = page.locator("[data-row=geometry]");
    await expect(row.getByTestId("geometry-reset-all")).toHaveCount(0);
    await page.getByRole("switch", { name: "Reverse" }).click();
    await page.getByRole("switch", { name: "Mirror" }).click();
    await expect(row.getByTestId("geometry-badge")).toContainText("2");
    await row.getByTestId("geometry-reset-all").click();
    await expect(row.getByTestId("geometry-reset-all")).toHaveCount(0);
    await expect(page.getByRole("switch", { name: "Reverse" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await undoButton(page).click();
    await expect(page.getByRole("switch", { name: "Mirror" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("phone: Geometry opens a sheet below the dock; the dial and fields are 44 px; fields are 16 px", async ({
    page,
  }, info) => {
    test.skip(!isPhoneProject(info), "phone projects");
    await open(page, info);
    const dock = await page.getByTestId("gradient-dock").boundingBox();
    const panel = await page.getByRole("dialog").locator(".bottom-sheet__panel").boundingBox();
    if (!dock || !panel) throw new Error("no boxes");
    expect(panel.y).toBeGreaterThanOrEqual(dock.y + dock.height);
    const dial = await page.getByTestId("geometry-angle-dial").boundingBox();
    expect(dial?.width).toBeGreaterThanOrEqual(44);
    expect(dial?.height).toBeGreaterThanOrEqual(44);
    expect(
      await page
        .getByTestId("geometry-panel")
        .locator("input.number-field")
        .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize)),
    ).toBeGreaterThanOrEqual(16);
    expect(
      await page
        .getByTestId("geometry-angle-dial")
        .evaluate((el) => getComputedStyle(el).touchAction),
    ).toBe("none");
  });
});
