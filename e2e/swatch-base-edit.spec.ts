/**
 * The Swatch row edits the BASE color (M3 decision 47, round-2 failure 1; decision 24; spec 3.3):
 * its fields show the base, a commit sets that exact base and pins the swatch. The "After
 * adjustments" line is gone (decision 57); the strip shows the output color. With Lightness +0.1 active, editing R by 1 must not
 * apply the adjustment twice.
 */
import { expect, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";
import { sheetSettled } from "./helpers/sheet";

const details = (page: Page) => page.locator("[data-testid=swatch-details]:visible");
const editor = (page: Page) => page.locator("[data-testid=swatch-editor]:visible");
const stripSwatch = (page: Page) =>
  page.locator("[data-testid=swatch-strip]:visible [data-swatch]").nth(2);
const adjustmentsField = (page: Page) =>
  page.locator("[data-testid=adjustments-panel]:visible").getByRole("spinbutton", {
    name: /^Lightness$/,
  });

/** Sets Lightness +0.1, then shows the Swatch row in RGB. */
async function setUp(page: Page, phone: boolean): Promise<void> {
  await page.goto(demo(phone ? "tab=palette&rows=adjustments" : "rows=adjustments,swatch"));
  if (phone) await sheetSettled(page);
  const l = adjustmentsField(page).first();
  await l.fill("0.1");
  await l.press("Enter");
  if (phone) {
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Swatch", exact: true }).click();
    await sheetSettled(page);
  }
  await expect(details(page)).toBeVisible();
  await details(page).getByTestId("swatch-format").getByRole("button", { name: "RGB" }).click();
}

const rgb = (page: Page) =>
  Promise.all(["R", "G", "B"].map((c) => details(page).getByLabel(`RGB ${c}`).inputValue()));

test("with Lightness +0.1 active, the row shows and edits the base, once", async ({
  page,
}, info) => {
  const phone = isPhoneProject(info);
  await setUp(page, phone);
  expect(await rgb(page), "the row shows the base color").toEqual(["20", "56", "107"]);
  const adjusted = (await stripSwatch(page).getAttribute("aria-label")) ?? "";
  await expect(details(page).getByTestId("swatch-after-adjustments")).toHaveCount(0);
  await expect(details(page).getByText(/After adjustments/)).toHaveCount(0);

  const r = details(page).getByLabel("RGB R");
  await r.fill("21");
  await r.press("Enter");
  expect(await rgb(page), "the base is exactly what was typed").toEqual(["21", "56", "107"]);
  const afterEdit = (await stripSwatch(page).getAttribute("aria-label")) ?? "";
  expect(afterEdit).not.toBe(adjusted);

  // The strip shows the typed base adjusted once: the adjusted hex differs from the base by about
  // the same lightness step as before, not by twice as much.
  const outHex = afterEdit.toUpperCase().match(/#[0-9A-F]{6}/)?.[0] ?? "";
  expect(outHex).not.toBe("");
  const channel = (hex: string, at: number) =>
    Number.parseInt(hex.slice(1 + at * 2, 3 + at * 2), 16);
  const adjustedBefore = adjusted.toUpperCase().match(/#[0-9A-F]{6}/)?.[0] ?? "#000000";
  expect(Math.abs(channel(outHex, 2) - channel(adjustedBefore, 2))).toBeLessThanOrEqual(6);

  // The editor agrees with the row (desktop: it sits beside the row; phones: behind the scrim).
  if (!phone) await expect(editor(page).getByLabel(/^HEX/).first()).toHaveValue("#15386B");
});

test("the row and the editor agree; clearing the adjustments gives exactly the typed color", async ({
  page,
}, info) => {
  const phone = isPhoneProject(info);
  test.skip(
    phone,
    "the editor sits behind the drawer's scrim on phones; the first test covers phones",
  );
  await setUp(page, false);
  const r = details(page).getByLabel("RGB R");
  await r.fill("21");
  await r.press("Enter");
  await editor(page).getByLabel(/^HEX/).first().waitFor();
  await expect(editor(page).getByLabel(/^HEX/).first()).toHaveValue("#15386B");
  // Clear the adjustments: the strip shows exactly the typed color.
  const l = adjustmentsField(page).first();
  await l.fill("0");
  await l.press("Enter");
  await expect(details(page).getByTestId("swatch-after-adjustments")).toHaveCount(0);
  await expect(stripSwatch(page)).toHaveAttribute("aria-label", /#15386B/i);
});

test("the field's icon copies the shown base; there is no adjusted copy icon (decision 57)", async ({
  page,
  context,
}, info) => {
  test.skip(
    info.project.name !== "chromium",
    "Playwright grants clipboard permissions in Chromium only",
  );
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await setUp(page, false);
  const read = () => page.evaluate(() => navigator.clipboard.readText());
  await details(page).getByTestId("copy-value").click();
  expect(await read()).toBe("rgb(20 56 107)");
  await expect(details(page).getByRole("button", { name: /Copy adjusted/ })).toHaveCount(0);
});
