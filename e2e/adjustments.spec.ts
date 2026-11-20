import { expect, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";
import { measure } from "./helpers/rows";
import { openExport, sheetSettled } from "./helpers/sheet";

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
  test("Lightness +0.1 changes the strip hex; the editor keeps the base L 0.345 and shows no After-adjustments line (decisions 24, 57)", async ({
    page,
  }, info) => {
    await open(page, info);
    const before = await labelOf(page, 3);
    await expect(editorL(page)).toHaveValue("0.345");
    await expect(page.getByTestId("after-adjustments")).toHaveCount(0);
    await enter(page, "^Lightness$", "0.1");
    await expect(editorL(page)).toHaveValue("0.345");
    await expect(page.getByText(/After adjustments/)).toHaveCount(0);
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
    await expect(
      page.locator("[data-testid=swatch-strip]:visible [data-swatch][data-pinned]"),
    ).toHaveCount(1);
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

  test("Reset returns the base hexes: the header icon resets all as one undo step (decision 58)", async ({
    page,
  }, info) => {
    await open(page, info);
    const before = await labelOf(page, 1);
    await enter(page, "Hue rotate", "90");
    await enter(page, "^Lightness$", "0.1");
    const adjusted = await labelOf(page, 1);
    expect(adjusted).not.toBe(before);
    await expect(panel(page).getByRole("button", { name: /^Reset$/ })).toHaveCount(0);
    if (isPhoneProject(info)) await page.keyboard.press("Escape");
    const header = page.getByRole("button", { name: "Adjustments, 2 active" });
    await expect(header).toHaveText("Adjustments · 2");
    await page.getByRole("button", { name: "Reset adjustments", exact: true }).click();
    expect(await labelOf(page, 1)).toBe(before);
    await expect(page.getByRole("button", { name: "Reset adjustments", exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: "Adjustments", exact: true })).toBeVisible();
    await expect(page.getByTestId("adjustments-badge")).toHaveCount(0);
    // One undo step restores both.
    await undoButton(page).click();
    expect(await labelOf(page, 1)).toBe(adjusted);
  });

  test("the header shows the count; a row icon resets one adjustment and hides at the default (decision 58)", async ({
    page,
  }, info) => {
    await open(page, info);
    await expect(panel(page).getByRole("button", { name: /^Reset / })).toHaveCount(0);
    await enter(page, "^Lightness$", "0.1");
    const phone = isPhoneProject(info);
    const rowReset = panel(page).getByRole("button", { name: "Reset Lightness", exact: true });
    await expect(rowReset).toBeVisible();
    await expect(panel(page).getByRole("button", { name: /^Reset / })).toHaveCount(1);
    expect((await rowReset.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(phone ? 43.9 : 32);
    expect((await rowReset.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(phone ? 43.9 : 32);
    await expect(page.getByTestId("adjustments-badge")).toHaveText("· 1");
    await expect(page.getByRole("button", { name: "Adjustments, 1 active" })).toHaveText(
      "Adjustments · 1",
    );
    await rowReset.click();
    await expect(field(page, "^Lightness$").first()).toHaveValue("0.00");
    await expect(rowReset).toHaveCount(0);
    await expect(page.getByTestId("adjustments-badge")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reset adjustments", exact: true })).toHaveCount(
      0,
    );
    if (phone) await page.keyboard.press("Escape");
    await undoButton(page).click();
    if (phone) await page.getByRole("button", { name: "Adjustments, 1 active" }).click();
    await expect(field(page, "^Lightness$").first()).toHaveValue("0.10");
  });

  test("the header reset icon doesn't open or close the row, and is 44 px on a phone", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "on a phone the open sheet covers the header; checked below");
    await open(page, info);
    await enter(page, "^Lightness$", "0.1");
    const row = page.getByRole("button", { name: "Adjustments, 1 active" });
    await expect(row).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("button", { name: "Reset adjustments", exact: true }).click();
    await expect(page.getByRole("button", { name: "Adjustments", exact: true })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  test("phone: the header reset icon is 44 px and leaves a closed row closed", async ({
    page,
  }, info) => {
    test.skip(!isPhoneProject(info), "phone only");
    await open(page, info);
    await enter(page, "^Lightness$", "0.1");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const reset = page.getByRole("button", { name: "Reset adjustments", exact: true });
    const box = await reset.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    await reset.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Adjustments", exact: true })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
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
    test.skip(isPhoneProject(info), "the export panel check runs once, on desktop");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, info);
    await enter(page, "Hue rotate", "90");
    const hex = (await labelOf(page, 1))?.match(/#[0-9A-F]{6}/)?.[0];
    expect(hex).toBeTruthy();
    await (await openExport(page)).getByRole("button", { name: "Copy HEX" }).click();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text.split("\n")[0]).toBe(hex);
    expect(text).not.toContain("#E8693A");
  });

  for (const width of [1280, 1024, 390, 320]) {
    test(`rows with a reset icon keep one line, apart and centered at ${width} px (decision 58)`, async ({
      page,
    }, info) => {
      test.skip(info.project.name !== "chromium", "layout is checked once, at set widths");
      await page.setViewportSize({ width, height: 900 });
      await page.goto(demo(`${width < 1024 ? "tab=palette&" : ""}rows=adjustments`));
      if (width < 1024) await sheetSettled(page);
      // Every adjustment away from its default, so every row shows its icon.
      for (const [name, value] of [
        ["^Lightness$", "0.1"],
        ["^Chroma %", "120"],
        ["Hue rotate", "20"],
        ["^Contrast %", "120"],
        ["^Temperature", "0.02"],
        ["^Tint", "0.02"],
        ["^Gamma", "1.2"],
        ["Lightness range min", "0.1"],
        ["Lightness range max", "0.9"],
        ["Harmonize anchor", "30"],
        ["Harmonize amount", "20"],
      ] as const)
        await enter(page, name, value);
      await panel(page).getByRole("switch", { name: "Even out lightness" }).click();
      await panel(page).getByRole("button", { name: "Clamp" }).click();
      await expect(panel(page).getByTestId("adjust-reset-row")).toHaveCount(13);
      const rows = await measure(page);
      for (const r of rows) {
        if (!r.value) continue;
        const apart = r.group.right <= r.value.left + 0.5;
        expect(apart, `${r.name}: label group and value are side by side, not overlapping`).toBe(
          true,
        );
        expect(r.value.top, `${r.name}: the value stays on the label's line`).toBeLessThan(
          r.group.bottom - 0.5,
        );
        const mid = (b: DOMRect) => b.top + b.height / 2;
        expect(Math.abs(mid(r.value) - mid(r.group)), `${r.name}: centered`).toBeLessThanOrEqual(
          Math.max(r.group.height, r.value.height) / 2 + 1,
        );
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    });
  }
});
