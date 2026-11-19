/**
 * Pieces of M3 that touch each other (M3-T17): Reset to extracted after a marker drag, and the
 * cluster map going stale when a swatch leaves its extracted color (spec 2.6, 3.7).
 */
import { expect, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";

/** The fixture's marker points and patches (docs/design/mockup-state.md), 0-based by swatch. */
const POINT3 = { x: 0.769, y: 0.167 };
const PATCH5 = { x: 0.889, y: 0.778 };
const PATCH6 = { x: 0.102, y: 0.185 };

const strip = (page: Page) =>
  page.locator("[data-testid=swatch-strip]:visible").first().locator("[data-swatch]");
const marker = (page: Page, n: number) => page.locator(`[data-marker="${n}"]`);
const header = (page: Page, name: RegExp) => page.locator("header").getByRole("button", { name });
const details = (page: Page) => page.locator("[data-testid=swatch-details]:visible");

async function screenOf(page: Page, p: { x: number; y: number }) {
  const b = await page.locator(".image-well__image:visible").first().boundingBox();
  if (!b) throw new Error("no image box");
  return { x: b.x + p.x * b.width, y: b.y + p.y * b.height };
}

async function dragMarker3To(page: Page, to: { x: number; y: number }) {
  const ring = await marker(page, 3).locator(".marker__ring").boundingBox();
  if (!ring) throw new Error("no marker");
  const from = { x: ring.x + ring.width / 2, y: ring.y + ring.height / 2 };
  const at = await screenOf(page, to);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + at.x) / 2, (from.y + at.y) / 2, { steps: 6 });
  await page.mouse.move(at.x, at.y, { steps: 6 });
  await page.mouse.up();
}

const shares = (page: Page) =>
  strip(page).evaluateAll((els) => els.map((e) => e.hasAttribute("data-share")));
const hasMap = async (page: Page) => (await shares(page)).every(Boolean);
const noMap = async (page: Page) => (await shares(page)).every((s) => !s);

test.describe("palette sync (desktop)", () => {
  test.beforeEach(({ page: _page }, info) => {
    test.skip(isPhoneProject(info), "needs the image and the swatch row side by side");
  });

  test("Reset to extracted restores the marker position after a drag", async ({ page }) => {
    await page.goto(demo("rows=swatch"));
    await expect(marker(page, 3)).toHaveAttribute("aria-label", "Swatch 3 marker, 77%, 17%");
    await dragMarker3To(page, PATCH5);
    await expect(strip(page).nth(2)).toHaveAttribute("aria-label", /#1E8A2E$/);
    await expect(marker(page, 3)).toHaveAttribute("aria-label", /^Swatch 3 marker, 89%, (77|78)%$/);
    await details(page).getByRole("button", { name: "Reset to extracted" }).click();
    await expect(strip(page).nth(2)).toHaveAttribute("aria-label", /#14386B$/);
    await expect(marker(page, 3)).toHaveAttribute("aria-label", "Swatch 3 marker, 77%, 17%");
    expect(POINT3.x).toBeCloseTo(0.769, 3);
    await header(page, /^Undo/).first().click();
    await expect(marker(page, 3)).toHaveAttribute("aria-label", /^Swatch 3 marker, 89%, (77|78)%$/);
  });

  test("an edit, a drag and a Replace pick each drop the cluster map; Undo brings it back", async ({
    page,
  }) => {
    await page.goto(demo("rows=swatch"));
    await expect.poll(() => hasMap(page), { timeout: 15_000 }).toBe(true);
    const undo = header(page, /^Undo/).first();

    // An edit in the color fields.
    const hex = details(page).getByLabel("HEX", { exact: true });
    await hex.fill("#14386F");
    await hex.press("Enter");
    await expect(strip(page).nth(2)).toHaveAttribute("aria-label", /#14386F$/);
    expect(await noMap(page)).toBe(true);
    await undo.click();
    await expect.poll(() => hasMap(page)).toBe(true);

    // A marker drag.
    await dragMarker3To(page, PATCH5);
    await expect(strip(page).nth(2)).toHaveAttribute("aria-label", /#1E8A2E$/);
    expect(await noMap(page)).toBe(true);
    await undo.click();
    await expect.poll(() => hasMap(page)).toBe(true);

    // An eyedropper pick adds a swatch, so the map no longer fits.
    await page.getByRole("button", { name: "Eyedropper" }).click();
    const at = await screenOf(page, PATCH6);
    await page.mouse.click(at.x, at.y);
    await expect(strip(page).nth(6)).toHaveAttribute("aria-label", /#5039B0$/);
    expect(await noMap(page)).toBe(true);
    await undo.click();
    await expect.poll(() => hasMap(page)).toBe(true);
  });

  test("editing, dragging, picking and undoing in the demo touch no storage (spec 5.5)", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const calls: string[] = [];
      (window as unknown as { __calls: string[] }).__calls = calls;
      for (const name of ["getItem", "setItem", "removeItem", "clear", "key"] as const) {
        const original = Storage.prototype[name] as (...args: unknown[]) => unknown;
        Object.defineProperty(Storage.prototype, name, {
          configurable: true,
          value(this: Storage, ...args: unknown[]) {
            calls.push(`storage.${name}`);
            return original.apply(this, args);
          },
        });
      }
      const open = indexedDB.open.bind(indexedDB);
      indexedDB.open = (...args: Parameters<IDBFactory["open"]>) => {
        calls.push("indexedDB.open");
        return open(...args);
      };
    });
    await page.goto(demo("rows=swatch"));
    const hex = details(page).getByLabel("HEX", { exact: true });
    await hex.fill("#14386F");
    await hex.press("Enter");
    await expect(strip(page).nth(2)).toHaveAttribute("aria-label", /#14386F$/);
    await dragMarker3To(page, PATCH5);
    await expect(strip(page).nth(2)).toHaveAttribute("aria-label", /#1E8A2E$/);
    await page.getByRole("button", { name: "Eyedropper" }).click();
    const at = await screenOf(page, PATCH6);
    await page.mouse.click(at.x, at.y);
    await expect(strip(page)).toHaveCount(7);
    await header(page, /^Undo/).first().click();
    await header(page, /^Undo/).first().click();
    expect(await page.evaluate(() => (window as unknown as { __calls: string[] }).__calls)).toEqual(
      [],
    );
  });

  test("a marker keeps the image color while the strip shows the adjusted one (spec 3.7)", async ({
    page,
  }) => {
    await page.goto(demo("rows=adjustments"));
    const lightness = page
      .locator("[data-testid=adjustments-panel]:visible")
      .getByRole("spinbutton", { name: /^Lightness$/ })
      .first();
    await lightness.fill("0.2");
    await lightness.press("Enter");
    const fill = (selector: string) =>
      page.locator(selector).evaluate((el) => getComputedStyle(el).backgroundColor);
    await expect(strip(page).nth(2)).not.toHaveAttribute("aria-label", /#14386B$/);
    const markerFill = await fill('[data-marker="3"] .marker__ring');
    const stripFill = await strip(page)
      .nth(2)
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(markerFill).toBe("rgb(20, 56, 107)"); // #14386B, the base color
    expect(markerFill).not.toBe(stripFill);
  });
});
