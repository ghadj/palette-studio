/**
 * A swatch whose color is changed by value loses its image marker (M3 decision 65; spec 3.7). The
 * swatch stays pinned. Place on image, Reset to extracted and Undo bring the marker back; colors
 * that come from the image (a marker drag, an eyedropper pick) keep theirs.
 */
import { expect, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";

/** The fixture's patches (docs/design/mockup-state.md): marker point and image color. */
const FIXTURE_PATCHES = [
  { x: 0.769, y: 0.167, hex: "#14386B" },
  { x: 0.889, y: 0.778, hex: "#1E8A2E" },
  { x: 0.102, y: 0.185, hex: "#5039B0" },
];

const marker = (page: Page, n: number) => page.locator(`[data-marker="${n}"]`);
const strip = (page: Page) =>
  page.locator("[data-testid=swatch-strip]:visible").first().locator("[data-swatch]");
const editor = (page: Page) => page.locator("[data-testid=swatch-editor]:visible");
const hexField = (page: Page) => editor(page).getByLabel("HEX", { exact: true });
const undo = (page: Page) => page.locator("header").getByRole("button", { name: /^Undo/ }).first();

/** Phone keeps the image on the Source tab and the editor on the Palette tab. */
async function tab(page: Page, phone: boolean, name: "Source" | "Palette") {
  if (phone) await page.getByRole("tab", { name }).click();
}

async function open(page: Page, phone: boolean, query = "") {
  await page.goto(demo(phone ? `tab=palette${query ? `&${query}` : ""}` : query));
}

test.describe("typed colors clear the marker (decision 65)", () => {
  test("a typed HEX removes marker 3, keeps the pin badge; Undo restores both", async ({
    page,
  }, info) => {
    const phone = isPhoneProject(info);
    await open(page, phone);
    await tab(page, phone, "Source");
    await expect(marker(page, 3)).toHaveCount(1);
    await tab(page, phone, "Palette");
    await hexField(page).fill("#1E8A2E");
    await hexField(page).press("Enter");
    await expect(strip(page).nth(2)).toHaveAttribute("aria-label", "Swatch 3, #1E8A2E");
    await expect(strip(page).nth(2).locator(".swatch__badge")).toHaveCount(1);
    await tab(page, phone, "Source");
    await expect(marker(page, 3)).toHaveCount(0);
    await expect(marker(page, 2)).toHaveCount(1);
    await tab(page, phone, "Palette");
    await undo(page).click();
    await expect(strip(page).nth(2)).toHaveAttribute("aria-label", "Swatch 3, #14386B");
    await tab(page, phone, "Source");
    await expect(marker(page, 3)).toHaveCount(1);
  });

  test("a Lightness slider drag removes the marker in one undo step", async ({ page }, info) => {
    test.skip(isPhoneProject(info), "mouse drag");
    await open(page, false);
    const slider = editor(page).getByLabel("Lightness slider");
    const box = await slider.boundingBox();
    if (!box) throw new Error("no slider box");
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.3, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.6, y, { steps: 5 });
    await page.mouse.move(box.x + box.width * 0.8, y, { steps: 5 });
    await page.mouse.up();
    await expect(marker(page, 3)).toHaveCount(0);
    await undo(page).click();
    await expect(marker(page, 3)).toHaveCount(1);
    await expect(strip(page).nth(2)).toHaveAttribute("aria-label", "Swatch 3, #14386B");
    await expect(undo(page)).toHaveAttribute("aria-disabled", "true");
  });

  test("Place on image and Reset to extracted bring a marker back (desktop)", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "needs the image and the swatch row side by side");
    await open(page, false, "rows=swatch");
    const details = page.locator("[data-testid=swatch-details]:visible");
    const place = details.getByRole("button", { name: "Place on image" });
    await expect(place).toHaveCount(0);
    const hex = details.getByLabel("HEX", { exact: true });
    await hex.fill("#1E8A2E");
    await hex.press("Enter");
    await expect(marker(page, 3)).toHaveCount(0);
    await expect(place).toHaveCount(1);

    // Place on image (decision 66): a point again, and the image color at that marker, one undo step.
    await place.click();
    await expect(marker(page, 3)).toHaveCount(1);
    await expect(place).toHaveCount(0);
    const label = (await marker(page, 3).getAttribute("aria-label")) ?? "";
    const [, px, py] = label.match(/(\d+)%, (\d+)%/) ?? [];
    const patch = FIXTURE_PATCHES.find(
      (p) => Math.abs(p.x * 100 - Number(px)) < 2 && Math.abs(p.y * 100 - Number(py)) < 2,
    );
    expect(patch, `marker at ${label} sits on a fixture patch`).toBeTruthy();
    await expect(strip(page).nth(2)).toHaveAttribute("aria-label", new RegExp(`${patch?.hex}$`));
    await undo(page).click();
    await expect(marker(page, 3)).toHaveCount(0);
    await expect(strip(page).nth(2)).toHaveAttribute("aria-label", /#1E8A2E$/);
    await expect(place).toHaveCount(1);
    await place.click();
    await expect(marker(page, 3)).toHaveCount(1);

    // Edit again, then reset.
    await hex.fill("#8A1E2E");
    await hex.press("Enter");
    await expect(marker(page, 3)).toHaveCount(0);
    await details.getByRole("button", { name: "Reset to extracted" }).click();
    await expect(strip(page).nth(2)).toHaveAttribute("aria-label", /#14386B$/);
    await expect(marker(page, 3)).toHaveAttribute("aria-label", "Swatch 3 marker, 77%, 17%");
  });

  test("a marker drag and an eyedropper pick keep their markers (desktop)", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "mouse drag");
    await open(page, false);
    const ring = await marker(page, 3).locator(".marker__ring").boundingBox();
    const img = await page.locator(".image-well__image:visible").first().boundingBox();
    if (!ring || !img) throw new Error("no boxes");
    await page.mouse.move(ring.x + ring.width / 2, ring.y + ring.height / 2);
    await page.mouse.down();
    await page.mouse.move(img.x + img.width * 0.889, img.y + img.height * 0.778, { steps: 8 });
    await page.mouse.up();
    await expect(strip(page).nth(2)).toHaveAttribute("aria-label", /#1E8A2E$/);
    await expect(marker(page, 3)).toHaveCount(1);
    await page.getByRole("button", { name: "Eyedropper" }).click();
    await page.mouse.click(img.x + img.width * 0.102, img.y + img.height * 0.185);
    await expect(strip(page)).toHaveCount(7);
    await expect(marker(page, 7)).toHaveCount(1);
    await expect(marker(page, 3)).toHaveCount(1);
  });
});
