/**
 * Round-2 fixes (M3 decisions 48 and 49; re-evaluation V-new-1 to V-new-4, notes 3 and 5).
 */
import { expect, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";
import { sheetSettled } from "./helpers/sheet";

const strip = (page: Page) => page.locator("[data-testid=swatch-strip]:visible").first();
const swatches = (page: Page) => strip(page).locator("[data-swatch]");

test.describe("strip columns (V-new-1)", () => {
  test("at 320 px the phone Source tab fits 6 swatches in one row, with no empty column", async ({
    page,
  }, info) => {
    test.skip(!isPhoneProject(info), "phone layout");
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(demo("tab=source"));
    await expect(swatches(page)).toHaveCount(6);
    const tops = await swatches(page).evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().top)),
    );
    expect(new Set(tops).size, "one row").toBe(1);
    const last = await swatches(page).last().boundingBox();
    const bar = await strip(page).boundingBox();
    if (!last || !bar) throw new Error("no boxes");
    expect(last.x + last.width, "the last swatch reaches the strip's right edge").toBeGreaterThan(
      bar.x + bar.width - 2,
    );
  });
});

test.describe("toolbar (V-new-2, V-new-3)", () => {
  for (const view of ["image", "palette", "values"]) {
    test(`${view} view: zoom controls on the right, ordered Zoom out, Fit, Zoom in`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(demo(`tab=source&image=${view}`));
      const toolbar = page.getByTestId("image-toolbar");
      const zoom = page.getByTestId("zoom-controls");
      const t = await toolbar.boundingBox();
      const z = await zoom.boundingBox();
      if (!t || !z) throw new Error("no boxes");
      expect(Math.abs(t.x + t.width - (z.x + z.width)), "right edge").toBeLessThanOrEqual(1);
      const names = await zoom
        .getByRole("button")
        .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
      expect(names).toEqual(["Zoom out", "Fit", "Zoom in"]);
    });
  }
});

test.describe("badge and remove X (V-new-4)", () => {
  for (const size of [
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
  ]) {
    test(`at ${size.width} px the pin or lock badge and the X don't overlap`, async ({
      page,
    }, info) => {
      test.skip(
        size.width < 1024 !== isPhoneProject(info) && info.project.name !== "chromium",
        "layout matches the project",
      );
      await page.setViewportSize(size);
      await page.goto(demo("tab=palette"));
      await page.getByRole("button", { name: "Lock", exact: true }).click();
      const badge = page.locator("[data-swatch][data-locked] .swatch__badge");
      await expect(badge).toBeVisible();
      const x = page.locator("[data-testid=remove-swatch] .swatch-remove__chip").first();
      const b = await badge.boundingBox();
      const c = await x.boundingBox();
      if (!b || !c) throw new Error("no boxes");
      const overlap =
        b.x < c.x + c.width && b.x + b.width > c.x && b.y < c.y + c.height && b.y + b.height > c.y;
      expect(overlap, "badge and X overlap").toBe(false);
    });
  }
});

test.describe("12 swatches (decision 49)", () => {
  test("the '+' tile is hidden and the note shows", async ({ page }) => {
    await page.goto(demo("tab=palette"));
    for (let i = 0; i < 6; i += 1) {
      await page.locator("[data-testid=add-swatch]:visible").first().click();
      await expect(swatches(page)).toHaveCount(7 + i);
    }
    await expect(swatches(page)).toHaveCount(12);
    await expect(page.getByTestId("add-swatch")).toHaveCount(0);
    await expect(page.getByTestId("strip-full-note")).toHaveText(
      "A palette holds at most 12 colors.",
    );
  });
});

test.describe("Duplicate in the Swatch drawer (decision 48)", () => {
  for (const size of [
    { width: 390, height: 844 },
    { width: 820, height: 1180 },
  ]) {
    test(`at ${size.width} px the title bar has a 44 px Duplicate swatch button`, async ({
      page,
    }, info) => {
      test.skip(!isPhoneProject(info) && info.project.name !== "chromium", "phone layout");
      await page.setViewportSize(size);
      await page.goto(demo("tab=palette&rows=swatch"));
      await sheetSettled(page);
      const dialog = page.getByRole("dialog");
      const button = dialog.getByRole("button", { name: "Duplicate swatch" });
      const close = dialog.getByRole("button", { name: "Close" });
      const d = await button.boundingBox();
      const c = await close.boundingBox();
      if (!d || !c) throw new Error("no boxes");
      expect(d.width).toBeGreaterThanOrEqual(44);
      expect(d.height).toBeGreaterThanOrEqual(44);
      expect(d.x + d.width, "beside Close").toBeLessThanOrEqual(c.x + 1);
      await button.click();
      await expect(swatches(page)).toHaveCount(7);
      // Like the D shortcut: the copy follows its source and is selected.
      await expect(swatches(page).nth(3)).toHaveAttribute("aria-pressed", "true");
    });
  }

  test("desktop has no Duplicate button; D still works", async ({ page }, info) => {
    test.skip(isPhoneProject(info), "desktop layout");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(demo("rows=swatch"));
    await expect(page.getByTestId("duplicate-swatch")).toHaveCount(0);
    await page.keyboard.press("d");
    await expect(swatches(page)).toHaveCount(7);
  });
});

test.describe("focus (note 3)", () => {
  test("after removing the last swatch on the phone Source tab, focus goes to a tab button", async ({
    page,
  }, info) => {
    test.skip(!isPhoneProject(info), "phone layout");
    await page.goto(demo("tab=source"));
    for (let i = 0; i < 6; i += 1) {
      await page.getByTestId("remove-swatch").click();
      if (i < 5) await expect(swatches(page)).toHaveCount(5 - i);
    }
    await expect(page.getByRole("tab", { name: "Source" })).toBeFocused();
  });
});

test.describe("editor HEX copy icon (decision 50)", () => {
  for (const size of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    test(`at ${size.width} px the icon is visible beside the HEX field and copies #14386B`, async ({
      page,
      context,
    }, info) => {
      test.skip(
        info.project.name !== "chromium",
        "Playwright grants clipboard permissions in Chromium only",
      );
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.setViewportSize(size);
      await page.goto(demo(size.width < 1024 ? "tab=palette" : ""));
      const editor = page.locator("[data-testid=swatch-editor]:visible");
      const hex = editor.getByLabel("HEX", { exact: true });
      const icon = editor.getByRole("button", { name: "Copy swatch HEX", exact: true });
      await expect(icon).toBeVisible();
      const h = await hex.boundingBox();
      const i = await icon.boundingBox();
      if (!h || !i) throw new Error("no boxes");
      expect(Math.abs(h.y + h.height / 2 - (i.y + i.height / 2)), "same line").toBeLessThanOrEqual(
        4,
      );
      expect(i.x - (h.x + h.width), "within 8 px").toBeLessThanOrEqual(8);
      expect(i.x - (h.x + h.width), "after the field").toBeGreaterThanOrEqual(-1);
      expect(i.height).toBeGreaterThanOrEqual(size.width < 1024 ? 44 : 32);
      await icon.click();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("#14386B");
    });
  }

  test("phone sizes: the icon is 44 px at 320 px too", async ({ page }, info) => {
    test.skip(!isPhoneProject(info), "phone layout");
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(demo("tab=palette"));
    const icon = page
      .locator("[data-testid=swatch-editor]:visible")
      .getByRole("button", { name: "Copy swatch HEX", exact: true });
    const box = await icon.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});

test("the Swatch drawer opens with focus on Close, so Enter cannot duplicate (decision 48)", async ({
  page,
}, info) => {
  test.skip(!isPhoneProject(info) && info.project.name !== "chromium", "phone layout");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(demo("tab=palette&rows=swatch"));
  await sheetSettled(page);
  await expect(page.getByRole("dialog").getByRole("button", { name: "Close" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(swatches(page)).toHaveCount(6);
});
