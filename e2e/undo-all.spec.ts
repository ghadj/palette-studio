/**
 * One long session, undone and redone in full (M3-T17; plan v1 acceptance 3; decisions 3a, 3d).
 * It edits a color, adjusts, adds a ramp step, reorders, drags a marker, picks with the
 * eyedropper and re-extracts, then undoes every step back to the start and redoes them all. After
 * each step the palette matches what it was then: hexes, order, origins, lock flags and markers.
 */
import { expect, type Page, test } from "@playwright/test";
import { isPhoneProject } from "./helpers/app";
import { fixture } from "./helpers/files";

const strip = (page: Page) =>
  page.locator("[data-testid=swatch-strip]:visible").first().locator("[data-swatch]");
const header = (page: Page, name: string | RegExp) =>
  page.locator("header").getByRole("button", { name });
const palette = (page: Page) => page.locator("[data-panel=palette]");
const image = (page: Page) => page.locator(".image-well__image:visible").first();

interface Snapshot {
  swatches: Array<{ id: string | null; label: string | null; origin: string | null; lock: string }>;
  markers: Array<{ n: string | null; left: string; top: string }>;
}

/** Hexes, order, origins, lock flags and marker points, read from the page. */
async function snapshot(page: Page): Promise<Snapshot> {
  await expect(page.locator("[data-testid=swatch-strip][data-busy]")).toHaveCount(0);
  const count = await strip(page).count();
  const swatches: Snapshot["swatches"] = [];
  for (let i = 0; i < count; i += 1) {
    const s = strip(page).nth(i);
    await s.click();
    const lock = palette(page)
      .locator("[data-testid=swatch-editor]:visible")
      .getByRole("button", { name: "Lock", exact: true });
    swatches.push({
      id: await s.getAttribute("data-swatch-id"),
      label: await s.getAttribute("aria-label"),
      origin: await s.getAttribute("data-origin"),
      lock: (await lock.getAttribute("aria-pressed")) ?? "",
    });
  }
  const markers = await page.locator("[data-marker]").evaluateAll((els) =>
    els.map((el) => ({
      n: el.getAttribute("data-marker"),
      left: (el as HTMLElement).style.left,
      top: (el as HTMLElement).style.top,
    })),
  );
  return { swatches, markers };
}

test("edit, adjust, ramp, reorder, drag, pick and re-extract; undo all, redo all", async ({
  page,
}, info) => {
  test.skip(isPhoneProject(info), "the desktop panels and the mouse drag");
  test.setTimeout(120_000);
  await page.goto("./");
  await page.getByTestId("file-input").setInputFiles(fixture("twelve-colors.png"));
  await expect(strip(page)).toHaveCount(6);
  await expect(page.locator("[data-marker]")).toHaveCount(6);

  const states: Snapshot[] = [await snapshot(page)];
  const steps: string[] = [];
  const record = async (name: string) => {
    steps.push(name);
    states.push(await snapshot(page));
    // Each step really changed something.
    expect(states.at(-1), name).not.toEqual(states.at(-2));
  };

  // 1. Edit swatch 1's color in the Swatch row (locks it).
  await strip(page).first().click();
  await palette(page).getByRole("button", { name: "Swatch", exact: true }).click();
  const hex = page.locator("[data-testid=swatch-details]:visible").getByLabel("HEX", {
    exact: true,
  });
  await hex.fill("#123456");
  await hex.press("Enter");
  await expect(strip(page).first()).toHaveAttribute("aria-label", /#123456$/);
  await record("edit");

  // 2. Adjust: Lightness +0.05.
  await palette(page).getByRole("button", { name: "Adjustments", exact: true }).click();
  const lightness = page
    .locator("[data-testid=adjustments-panel]:visible")
    .getByRole("spinbutton", { name: /^Lightness$/ })
    .first();
  await lightness.fill("0.05");
  await lightness.press("Enter");
  await expect(lightness).toHaveValue("0.05");
  await record("adjust");

  // 3. Ramp: add the 700 step of swatch 1.
  await palette(page).getByRole("button", { name: "Ramp", exact: true }).click();
  await page.locator("[data-testid=ramp-tiles] [data-step='700']:visible").click();
  await expect(strip(page)).toHaveCount(7);
  await record("ramp");

  // 4. Reorder: swatch 2 one place right.
  await strip(page).nth(1).focus();
  await page.keyboard.press("ArrowRight");
  await record("reorder");

  // 5. Drag a marker that nothing covers (the image is wide and short, so rings overlap).
  const n = await page.evaluate(() => {
    for (const el of document.querySelectorAll("[data-marker]")) {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (hit?.closest("[data-marker]") === el) return Number(el.getAttribute("data-marker"));
    }
    return 0;
  });
  expect(n).toBeGreaterThan(0);
  const ring = await page.locator(`[data-marker="${n}"] .marker__ring`).boundingBox();
  const box = await image(page).boundingBox();
  if (!ring || !box) throw new Error("no boxes");
  const from = { x: ring.x + ring.width / 2, y: ring.y + ring.height / 2 };
  const to = { x: Math.min(box.x + box.width * 0.95, from.x + box.width * 0.25), y: from.y };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, to.y, { steps: 6 });
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByTestId("loupe")).toHaveCount(0);
  await record("drag");

  // 6. Eyedropper: add a color from the image.
  await page.getByRole("button", { name: "Eyedropper" }).click();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await expect(strip(page)).toHaveCount(8);
  await page.getByRole("button", { name: "Eyedropper" }).click();
  await record("pick");

  // 7. Re-extract: Colors 6 -> 5 keeps the locked swatches.
  await page
    .locator(".slider:visible")
    .first()
    .evaluate((el) => {
      (el as HTMLInputElement).value = "5";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  await expect(page.locator("[data-testid=swatch-strip][data-busy]")).toHaveCount(0);
  await expect.poll(() => strip(page).count()).not.toBe(8);
  await record("re-extract");

  // Undo everything, one step at a time.
  const undo = header(page, /^Undo/).first();
  const redo = header(page, /^Redo/).first();
  for (let i = steps.length; i > 0; i -= 1) {
    await expect(undo).not.toHaveAttribute("aria-disabled", "true");
    await undo.click();
    expect(await snapshot(page), `undo ${steps[i - 1]}`).toEqual(states[i - 1]);
  }
  await expect(undo).toHaveAttribute("aria-disabled", "true");

  // Redo everything.
  for (let i = 1; i <= steps.length; i += 1) {
    await expect(redo).not.toHaveAttribute("aria-disabled", "true");
    await redo.click();
    expect(await snapshot(page), `redo ${steps[i - 1]}`).toEqual(states[i]);
  }
  await expect(redo).toHaveAttribute("aria-disabled", "true");
});
