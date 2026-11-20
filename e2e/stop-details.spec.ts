/**
 * M4-T8: the Stop row (spec 4.3 "Stops"; plan D29, D30). The fixture's selected stop is the 50% one,
 * linked to swatch 4 (#D4527F), between #1DB07A at 0 and #5039B0 at 100.
 */
import { expect, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";
import { sheetSettled } from "./helpers/sheet";

const STOPS = "#1DB07A@0,#D4527F@50,#5039B0@100";
const preview = (page: Page) => page.getByTestId("gradient-preview");
const scope = (page: Page) => page.locator("[data-testid=row-stop], [data-testid=sheet-stop]");

async function open(page: Page, query = "") {
  await page.goto(demo(`rows=stop&tab=gradient${query ? `&${query}` : ""}`));
  await expect(scope(page)).toBeVisible();
  if ((await page.getByRole("dialog").count()) > 0) await sheetSettled(page);
}

const hexField = (page: Page) => scope(page).getByRole("textbox", { name: "HEX" });
const position = (page: Page) => scope(page).getByRole("spinbutton", { name: "Position" });
const alpha = (page: Page) => scope(page).getByRole("spinbutton", { name: "Alpha", exact: true });
const lock = (page: Page) => scope(page).getByRole("switch", { name: "Lock" });
const remove = (page: Page) => scope(page).getByRole("button", { name: "Remove stop" });
const chip = (page: Page, name: string) => scope(page).getByRole("radio", { name });
const technique = (page: Page) => page.getByTestId("technique-value");

/** Undo from the keyboard: a sheet covers the header's button on phones. */
async function undo(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("ControlOrMeta+z");
}

test.describe("Stop row (M4-T8)", () => {
  test("fixture: Stop 2 shows Swatch 4, linked, at 50%, alpha 100%", async ({ page }, info) => {
    await open(page);
    await expect(preview(page)).toHaveAttribute("data-stops", STOPS);
    if (isPhoneProject(info)) {
      await expect(page.getByRole("dialog")).toHaveAccessibleName("Stop 2 of 3");
    } else {
      await expect(page.locator("[data-row=stop]")).toHaveText(/^Stop/);
    }
    await expect(chip(page, "Swatch 4")).toHaveAttribute("aria-checked", "true");
    await expect(hexField(page)).toHaveValue("#D4527F");
    await expect(position(page)).toHaveValue("50.0");
    await expect(alpha(page)).toHaveValue("100");
    await expect(scope(page).getByRole("button", { name: /^Relink/ })).toHaveCount(0);
    await expect(technique(page)).not.toHaveText("Custom");
  });

  test("typing #FF0000 detaches the stop and shows 'Relink to Swatch 4'; Relink gives #D4527F back; each is one step", async ({
    page,
  }) => {
    await open(page);
    await hexField(page).fill("#FF0000");
    await hexField(page).press("Enter");
    await expect(preview(page)).toHaveAttribute("data-stops", "#1DB07A@0,#FF0000@50,#5039B0@100");
    await expect(chip(page, "Swatch 4")).toHaveAttribute("aria-checked", "false");
    await expect(technique(page)).toHaveText("Custom");
    const relink = scope(page).getByRole("button", { name: "Relink to Swatch 4" });
    await expect(relink).toBeVisible();
    await relink.click();
    await expect(preview(page)).toHaveAttribute("data-stops", STOPS);
    await expect(relink).toHaveCount(0);
    await expect(chip(page, "Swatch 4")).toHaveAttribute("aria-checked", "true");
    await undo(page);
    await expect(preview(page)).toHaveAttribute("data-stops", "#1DB07A@0,#FF0000@50,#5039B0@100");
    await undo(page);
    await expect(preview(page)).toHaveAttribute("data-stops", STOPS);
    await expect(technique(page)).not.toHaveText("Custom");
  });

  test("an invalid HEX is dropped on blur and the field shows the stop's color again", async ({
    page,
  }) => {
    await open(page);
    await hexField(page).fill("#GG");
    await hexField(page).blur();
    await expect(hexField(page)).toHaveValue("#D4527F");
    await expect(preview(page)).toHaveAttribute("data-stops", STOPS);
  });

  test("the Swatch 1 chip links the stop: data-stops shows #E8693A@50", async ({ page }) => {
    await open(page);
    await chip(page, "Swatch 1").click();
    await expect(preview(page)).toHaveAttribute("data-stops", "#1DB07A@0,#E8693A@50,#5039B0@100");
    await expect(chip(page, "Swatch 1")).toHaveAttribute("aria-checked", "true");
    await expect(hexField(page)).toHaveValue("#E8693A");
  });

  test("desktop: editing swatch 4's HEX in column 2 updates a linked stop", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "needs column 2 beside the open row");
    await page.setViewportSize({ width: 1280, height: 1280 });
    await open(page);
    await page.locator("[data-column=palette] [data-swatch-id]").nth(3).click();
    await page.getByRole("button", { name: "Swatch", exact: true }).click();
    const field = page.getByTestId("swatch-fields").getByRole("textbox", { name: "HEX" });
    await field.fill("#102030");
    await field.press("Enter");
    await expect(preview(page)).toHaveAttribute("data-stops", /#102030@/);
    await expect(hexField(page)).toHaveValue("#102030");
  });

  test("alpha 50% gives #D4527F80, as one step", async ({ page }) => {
    await open(page);
    await alpha(page).fill("50");
    await alpha(page).press("Enter");
    await expect(preview(page)).toHaveAttribute("data-stops", "#1DB07A@0,#D4527F80@50,#5039B0@100");
    await expect(technique(page)).toHaveText("Custom");
    await scope(page).getByRole("button", { name: "Reset alpha" }).click();
    await expect(preview(page)).toHaveAttribute("data-stops", STOPS);
    await expect(scope(page).getByRole("button", { name: "Reset alpha" })).toHaveCount(0);
  });

  test("midpoint: shows on a stop with a next stop; 30% gives ~30; its reset restores 50", async ({
    page,
  }) => {
    await open(page);
    const mid = scope(page).getByRole("spinbutton", { name: "Midpoint", exact: true });
    await expect(mid).toHaveValue("50");
    await expect(scope(page).getByRole("button", { name: "Reset midpoint" })).toHaveCount(0);
    await mid.fill("30");
    await mid.press("Enter");
    await expect(preview(page)).toHaveAttribute(
      "data-stops",
      "#1DB07A@0,#D4527F@50,~30,#5039B0@100",
    );
    await scope(page).getByRole("button", { name: "Reset midpoint" }).click();
    await expect(preview(page)).toHaveAttribute("data-stops", STOPS);
  });

  test("position 25 moves the stop and keeps it selected; a period is the decimal separator", async ({
    page,
  }, info) => {
    await open(page);
    await position(page).fill("25");
    await expect(preview(page)).toHaveAttribute("data-stops", "#1DB07A@0,#D4527F@25,#5039B0@100");
    await position(page).fill("33,5");
    await expect(preview(page)).toHaveAttribute("data-stops", "#1DB07A@0,#D4527F@33.5,#5039B0@100");
    if (isPhoneProject(info)) {
      await expect(page.getByRole("dialog")).toHaveAccessibleName("Stop 2 of 3");
    }
    await undo(page);
    await undo(page);
    await expect(preview(page)).toHaveAttribute("data-stops", STOPS);
  });

  test("position in px converts against the preview's width", async ({ page }) => {
    await open(page);
    const width = await preview(page).evaluate((el) => el.clientWidth);
    await scope(page)
      .getByRole("button", { name: /Position unit/ })
      .click();
    await expect(position(page)).toHaveValue(String((width * 0.5).toFixed(1)));
    await position(page).fill(String(width / 4));
    await expect(preview(page)).toHaveAttribute("data-stops", /#D4527F@25,/);
  });

  test("lock: a locked stop's position is disabled and Remove is refused, with its note", async ({
    page,
  }) => {
    await open(page);
    await expect(remove(page)).toHaveAttribute("aria-disabled", "false");
    await lock(page).click();
    await expect(lock(page)).toHaveAttribute("aria-checked", "true");
    await expect(position(page)).toBeDisabled();
    await expect(remove(page)).toHaveAttribute("aria-disabled", "true");
    await expect(scope(page).getByText("Unlock the stop to remove it.")).toBeVisible();
    await remove(page).click({ force: true });
    await expect(preview(page)).toHaveAttribute("data-stops", STOPS);
    await lock(page).click();
    await expect(position(page)).toBeEnabled();
    await expect(scope(page).getByText("Unlock the stop to remove it.")).toHaveCount(0);
  });

  test("Remove removes the stop and selects its neighbor; at 2 stops it is disabled, with its note", async ({
    page,
  }) => {
    await open(page);
    await expect(scope(page).getByText(/at least 2 stops/)).toHaveCount(0);
    await remove(page).click();
    await expect(preview(page)).toHaveAttribute("data-stops", "#1DB07A@0,#5039B0@100");
    await expect(hexField(page)).toHaveValue("#5039B0");
    await expect(remove(page)).toHaveAttribute("aria-disabled", "true");
    await expect(scope(page).getByText("A gradient needs at least 2 stops.")).toBeVisible();
    await undo(page);
    await expect(preview(page)).toHaveAttribute("data-stops", STOPS);
  });

  test("custom: deleting swatch 4 leaves a fixed #D4527F, with Relink disabled ('Swatch removed')", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "the strip's remove button is behind the sheet on phones");
    await page.setViewportSize({ width: 1280, height: 1280 });
    await open(page);
    await hexField(page).fill("#FF0000");
    await hexField(page).press("Enter");
    await page.locator("[data-column=palette] [data-swatch-id]").nth(3).click();
    await page.getByRole("button", { name: "Remove swatch 4" }).click();
    const relink = scope(page).getByRole("button", { name: "Relink to swatch" });
    await expect(relink).toHaveAttribute("aria-disabled", "true");
    await expect(scope(page).getByText("Swatch removed")).toBeVisible();
  });

  test("deleting the linked swatch leaves the stop's last color, fixed", async ({ page }, info) => {
    test.skip(isPhoneProject(info), "the strip's remove button is behind the sheet on phones");
    await page.setViewportSize({ width: 1280, height: 1280 });
    await open(page);
    await lock(page).click();
    await page.locator("[data-column=palette] [data-swatch-id]").nth(3).click();
    await page.getByRole("button", { name: "Remove swatch 4" }).click();
    await expect(preview(page)).toHaveAttribute("data-stops", /#D4527F@50/);
    await expect(hexField(page)).toHaveValue("#D4527F");
    await expect(scope(page).getByText("Swatch removed")).toBeVisible();
  });

  test("copy icon copies the stop's HEX", async ({ page, context }, info) => {
    test.skip(info.project.name.includes("webkit"), "clipboard permissions");
    // Only Chromium knows the clipboard permissions; elsewhere the copy runs on the click alone.
    if (info.project.name.includes("chromium")) {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    }
    await open(page);
    await scope(page).getByRole("button", { name: "Copy HEX value" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Copied #D4527F" })).toBeVisible();
  });

  test("Alpha and Midpoint commit on Enter, blur or an arrow step, not per keystroke (one undo step)", async ({
    page,
  }) => {
    await open(page);
    const undoDepth = async () => {
      // Undoing once must restore the starting stops only if the whole edit was one step.
      await undo(page);
      return preview(page).getAttribute("data-stops");
    };
    // Typing "50" over "100" is one commit: nothing changes until Enter.
    await alpha(page).click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("50");
    await expect(preview(page)).toHaveAttribute("data-stops", STOPS);
    await page.keyboard.press("Enter");
    await expect(preview(page)).toHaveAttribute("data-stops", /#D4527F80@50/);
    expect(await undoDepth()).toBe(STOPS);
    // Blur commits.
    await alpha(page).click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("30");
    await expect(preview(page)).toHaveAttribute("data-stops", STOPS);
    await alpha(page).evaluate((el) => (el as HTMLElement).blur());
    await expect(preview(page)).toHaveAttribute("data-stops", /#D4527F4D@50/);
    // An arrow key commits at once, one step per press.
    await alpha(page).focus();
    await page.keyboard.press("ArrowDown");
    await expect(preview(page)).toHaveAttribute("data-stops", /#D4527F4[0-9A-F]@50/);
    // Midpoint: typed "30" waits for Enter, then is one step.
    const mid = scope(page).getByRole("spinbutton", { name: "Midpoint", exact: true });
    const before = await preview(page).getAttribute("data-stops");
    await mid.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("30");
    await expect(preview(page)).toHaveAttribute("data-stops", before ?? "");
    await page.keyboard.press("Enter");
    await expect(preview(page)).toHaveAttribute("data-stops", /~30/);
    expect(await undoDepth()).toBe(before);
  });

  test("phone: fields are 16 px with inputmode=decimal; the HEX field has autocorrect off; the sheet sits below the dock", async ({
    page,
  }, info) => {
    test.skip(!isPhoneProject(info), "phone layout");
    await open(page);
    for (const field of [position(page), alpha(page)]) {
      await expect(field).toHaveAttribute("inputmode", "decimal");
      expect(await field.evaluate((el) => getComputedStyle(el).fontSize)).toBe("16px");
    }
    await expect(hexField(page)).toHaveAttribute("autocorrect", "off");
    await expect(hexField(page)).toHaveAttribute("autocapitalize", "off");
    await expect(hexField(page)).toHaveAttribute("spellcheck", "false");
    expect(await hexField(page).evaluate((el) => getComputedStyle(el).fontSize)).toBe("16px");
    const dock = await preview(page).boundingBox();
    const sheet = await page.getByRole("dialog").boundingBox();
    expect(sheet && dock && sheet.y >= dock.y + dock.height - 1).toBe(true);
    // 44 px targets.
    for (const target of [
      chip(page, "Swatch 1"),
      lock(page),
      remove(page),
      scope(page).getByRole("button", { name: "Copy HEX value" }),
    ]) {
      const b = await target.boundingBox();
      expect(b?.width ?? 0).toBeGreaterThanOrEqual(43.5);
      expect(b?.height ?? 0).toBeGreaterThanOrEqual(43.5);
    }
  });

  test("values use periods under de-DE", async ({ browser }) => {
    const context = await browser.newContext({ locale: "de-DE" });
    const page = await context.newPage();
    await open(page);
    await expect(position(page)).toHaveValue("50.0");
    await position(page).fill("12,5");
    await expect(preview(page)).toHaveAttribute("data-stops", /#D4527F@12\.5,/);
    await position(page).blur();
    await expect(position(page)).toHaveValue("12.5");
    await context.close();
  });

  test("320 px: the rows don't overlap and nothing scrolls sideways", async ({ page }, info) => {
    test.skip(!isPhoneProject(info), "phone layout");
    await page.setViewportSize({ width: 320, height: 640 });
    await open(page);
    await hexField(page).fill("#FF0000");
    await hexField(page).press("Enter");
    await alpha(page).fill("50");
    await alpha(page).press("Enter");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);
    const rows = await scope(page)
      .locator(".setting-row")
      .evaluateAll((els) =>
        els
          .filter((el) => el.getClientRects().length > 0)
          .map((el) => {
            const group = el.querySelector(".setting-row__label-group, .setting-row__label");
            const value = el.querySelector(".setting-row__value");
            const g = group?.getBoundingClientRect();
            const v = value?.getBoundingClientRect();
            const r = el.getBoundingClientRect();
            return {
              name: group?.textContent ?? "",
              apart:
                !g ||
                !v ||
                g.right <= v.left + 0.5 ||
                v.right <= g.left + 0.5 ||
                g.bottom <= v.top + 0.5 ||
                v.bottom <= g.top + 0.5,
              inside: !v || (v.left >= r.left - 0.5 && v.right <= r.right + 0.5),
            };
          }),
      );
    expect(rows.length).toBeGreaterThan(4);
    for (const r of rows) {
      expect(r.apart, `${r.name}: label overlaps value`).toBe(true);
      expect(r.inside, `${r.name}: value leaves the row`).toBe(true);
    }
  });
});
