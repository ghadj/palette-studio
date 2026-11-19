/**
 * Re-extraction keeps locked swatches, and Place on image (M3-T13; spec 3.6, 3.7; plan decisions
 * 2a to 2c, 3a). Markers are drawn by M3-T12, so the marker is checked through the swatch's state:
 * "Place on image" is offered only for a swatch without a point.
 */
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { isPhoneProject } from "./helpers/app";
import { fixture } from "./helpers/files";
import { sheetSettled } from "./helpers/sheet";

const strip = (page: Page) =>
  page.locator("[data-testid=swatch-strip]:visible").first().locator("[data-swatch]");

async function hexes(page: Page): Promise<string[]> {
  const labels = await strip(page).evaluateAll((els) =>
    els.map((e) => e.getAttribute("aria-label") ?? ""),
  );
  return labels.map((l) => l.split(", ")[1] ?? "");
}

async function waitForPalette(page: Page, count: number) {
  await expect(strip(page)).toHaveCount(count);
  await expect(page.locator("[data-testid=swatch-strip][data-busy]")).toHaveCount(0);
}

async function load(page: Page, info: { project: { name: string } }) {
  await page.goto("./");
  await page.getByTestId("file-input").setInputFiles(fixture("twelve-colors.png"));
  await waitForPalette(page, 6);
  if (info.project.name.startsWith("phone")) {
    await page.getByRole("tab", { name: "Palette" }).tap();
  }
}

/** Sets Colors with the slider, as the undo spec does. */
async function slideColors(page: Page, value: number) {
  await page
    .locator(".slider:visible")
    .first()
    .evaluate((el, v) => {
      (el as HTMLInputElement).value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
}

const headerButton = (page: Page, name: string | RegExp) =>
  page.locator("header").getByRole("button", { name });

test.describe("re-extraction keeps locked swatches (spec 3.6)", () => {
  test("lock swatch 2, change Colors 6 → 5: 5 swatches; swatch 2 keeps its hex and position; Undo restores 6", async ({
    page,
  }, info) => {
    await load(page, info);
    await strip(page).nth(1).click();
    const before = await hexes(page);
    await page.getByRole("button", { name: "Lock", exact: true }).locator("visible=true").click();
    await expect(
      page.getByRole("button", { name: "Lock", exact: true }).locator("visible=true"),
    ).toHaveAttribute("aria-pressed", "true");

    // Colors is on the Source tab on phones.
    if (isPhoneProject(info)) await page.getByRole("tab", { name: "Source" }).tap();
    await slideColors(page, 5);
    await waitForPalette(page, 5);
    const after = await hexes(page);
    expect(after).toHaveLength(5);
    expect(after[1]).toBe(before[1]);

    await headerButton(page, "Undo Colors").click();
    await waitForPalette(page, 6);
    expect(await hexes(page)).toEqual(before);
  });
});

/** A manual swatch with no marker, from the "+" tile's "Type a color" (it is selected). */
async function addTyped(page: Page) {
  await page.locator("[data-testid=swatch-strip]:visible [data-testid=add-swatch]").click();
  await page.getByRole("menuitem", { name: "Type a color" }).click();
  await waitForPalette(page, 7);
}

async function openSwatchRow(page: Page, info: TestInfo) {
  if (isPhoneProject(info)) {
    await page.getByRole("button", { name: "Swatch", exact: true }).tap();
    await sheetSettled(page);
  } else {
    await page.getByRole("button", { name: "Swatch", exact: true }).click();
  }
}

test.describe("Place on image (spec 3.7)", () => {
  test("a typed swatch has no marker; Place on image gives it one, and Undo takes it back", async ({
    page,
  }, info) => {
    await load(page, info);
    await addTyped(page);
    await openSwatchRow(page, info);
    const details = page.locator("[data-testid=swatch-details]:visible");
    const place = details.getByTestId("place-on-image");
    await expect(place).toBeEnabled();
    await place.click();
    await expect(place).toHaveCount(0);

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("Control+z");
    await expect(details.getByTestId("place-on-image")).toBeVisible();
  });

  test("an extracted swatch has its marker, so no Place on image", async ({ page }, info) => {
    await load(page, info);
    await strip(page).nth(0).click();
    await openSwatchRow(page, info);
    await expect(
      page.locator("[data-testid=swatch-details]:visible").getByTestId("place-on-image"),
    ).toHaveCount(0);
  });

  test("Place on image is enabled in the demo (decision 31): the fixture is on screen", async ({
    page,
  }, info) => {
    await page.goto("./?demo=mockup&tab=palette");
    await addTyped(page);
    await openSwatchRow(page, info);
    const place = page
      .locator("[data-testid=swatch-details]:visible")
      .getByTestId("place-on-image");
    await expect(place).toBeEnabled();
    await place.click();
    await expect(place).toHaveCount(0);
    // On a phone the image is on the other tab.
    if (!isPhoneProject(info)) await expect(page.locator("[data-marker]")).toHaveCount(7);
  });
});
