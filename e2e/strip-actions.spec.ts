/**
 * Strip actions (M3-T5; spec 3.2, 3.7, 6, 6.1; plan decisions 4a, 5b, D10, D12): the "+" tile, drag
 * to reorder, and the arrow keys. Each move is one undo step.
 */
import { expect, type Locator, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";
import { fixture } from "./helpers/files";

const strip = (page: Page) => page.locator("[data-testid=swatch-strip]:visible").first();
const swatches = (page: Page) => strip(page).locator("[data-swatch]");
const addTile = (page: Page) => page.locator("[data-testid=add-swatch]:visible").first();

/** The hex of each swatch, in strip order. */
async function order(page: Page): Promise<string[]> {
  const labels = await swatches(page).evaluateAll((els) =>
    els.map((e) => e.getAttribute("aria-label") ?? ""),
  );
  return labels.map((l) => l.split(", ").pop() ?? "");
}

async function center(el: Locator): Promise<{ x: number; y: number }> {
  const b = await el.boundingBox();
  if (!b) throw new Error("no box");
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

const undoButton = (page: Page) => page.locator("header").getByRole("button", { name: /^Undo/ });

/** Dispatches a touch pointer event, since Playwright's touchscreen can't press and drag. */
async function touch(page: Page, type: string, at: { x: number; y: number }) {
  await page.evaluate(
    ({ type, x, y }) => {
      const target = type === "pointerdown" ? document.elementFromPoint(x, y) : document.body;
      target?.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 7,
          pointerType: "touch",
          isPrimary: true,
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          button: 0,
          buttons: type === "pointerup" ? 0 : 1,
        }),
      );
    },
    { type, ...at },
  );
}

test.describe("strip reorder (spec 3.2; D10)", () => {
  test("mouse drag of swatch 1 onto swatch 3 gives the order 2, 3, 1, 4, 5, 6; Undo restores it", async ({
    page,
  }) => {
    await page.goto(demo());
    await expect(swatches(page)).toHaveCount(6);
    const before = await order(page);
    const from = await center(swatches(page).nth(0));
    const to = await center(swatches(page).nth(2));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move((from.x + to.x) / 2, to.y, { steps: 4 });
    await page.mouse.move(to.x, to.y, { steps: 4 });
    await page.mouse.up();
    const [a, b, c, d, e, f] = before;
    expect(await order(page)).toEqual([b, c, a, d, e, f]);
    await expect(undoButton(page)).toBeEnabled();
    await undoButton(page).click();
    expect(await order(page)).toEqual(before);
  });

  test("a drag doesn't select by its click", async ({ page }) => {
    await page.goto(demo());
    await swatches(page).nth(1).click();
    await expect(swatches(page).nth(1)).toHaveAttribute("aria-pressed", "true");
    const from = await center(swatches(page).nth(0));
    const to = await center(swatches(page).nth(3));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await page.mouse.up();
    const pressed = await swatches(page).evaluateAll(
      (els) => els.filter((e) => e.getAttribute("aria-pressed") === "true").length,
    );
    expect(pressed).toBe(1);
    // The selected swatch is the same one, which moved up a place.
    await expect(swatches(page).nth(0)).toHaveAttribute("aria-pressed", "true");
  });

  test("ArrowRight on focused swatch 2 swaps it with 3 and keeps focus on it", async ({ page }) => {
    await page.goto(demo());
    const before = await order(page);
    const [a, b, c, d, e, f] = before;
    await swatches(page).nth(1).focus();
    await page.keyboard.press("ArrowRight");
    expect(await order(page)).toEqual([a, c, b, d, e, f]);
    await expect(swatches(page).nth(2)).toBeFocused();
    await expect(swatches(page).nth(2)).toHaveAttribute("aria-label", new RegExp(`${b}$`));
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    expect(await order(page)).toEqual([b, a, c, d, e, f]);
    await expect(swatches(page).nth(0)).toBeFocused();
    // The first swatch has no place to its left.
    await page.keyboard.press("ArrowLeft");
    expect(await order(page)).toEqual([b, a, c, d, e, f]);
    // Each move was one undo step.
    await undoButton(page).click();
    expect(await order(page)).toEqual([a, b, c, d, e, f]);
  });

  test("Tab moves focus between swatches and a move is announced", async ({
    page,
    browserName,
  }) => {
    await page.goto(demo());
    await swatches(page).nth(0).focus();
    if (browserName === "webkit") {
      // Safari's Tab skips buttons unless the user turns that on; focus the next one directly.
      await swatches(page).nth(1).focus();
    } else {
      await page.keyboard.press("Tab");
    }
    await expect(swatches(page).nth(1)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("strip-announce")).toHaveText(/moved to position 3 of 6/);
  });

  test("phone: a quick swipe on the strip scrolls the page", async ({
    page,
    browserName,
  }, info) => {
    test.skip(!isPhoneProject(info), "phone only");
    test.skip(browserName !== "chromium", "WebKit has no scripted touch scroll");
    await page.goto(demo());
    const before = await order(page);
    const at = await center(swatches(page).nth(1));
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.synthesizeScrollGesture", {
      x: at.x,
      y: at.y,
      yDistance: -300,
      speed: 2000,
      gestureSourceType: "touch",
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    expect(await order(page)).toEqual(before);
  });

  test("phone: a movement before 300 ms cancels the press, so nothing reorders", async ({
    page,
  }, info) => {
    test.skip(!isPhoneProject(info), "phone only");
    await page.goto(demo());
    const before = await order(page);
    const from = await center(swatches(page).nth(0));
    const to = await center(swatches(page).nth(2));
    await touch(page, "pointerdown", from);
    await touch(page, "pointermove", { x: from.x + 20, y: from.y + 20 });
    await page.waitForTimeout(400);
    await touch(page, "pointermove", to);
    await touch(page, "pointerup", to);
    expect(await order(page)).toEqual(before);
  });

  test("phone: a 300 ms press, then a drag, reorders", async ({ page }, info) => {
    test.skip(!isPhoneProject(info), "phone only");
    await page.goto(demo());
    const before = await order(page);
    const from = await center(swatches(page).nth(0));
    const to = await center(swatches(page).nth(2));
    await touch(page, "pointerdown", from);
    await page.waitForTimeout(400);
    await touch(page, "pointermove", { x: (from.x + to.x) / 2, y: to.y });
    await touch(page, "pointermove", to);
    await touch(page, "pointerup", to);
    const [a, b, c, d, e, f] = before;
    expect(await order(page)).toEqual([b, c, a, d, e, f]);
    await expect(undoButton(page)).toBeEnabled();
  });
});

test.describe('the "+" tile (decisions 4a, 5b; D12)', () => {
  test("'+' then 'Type a color' adds swatch 7, origin manual, and focuses the HEX field", async ({
    page,
  }, info) => {
    await page.goto(demo());
    await addTile(page).click();
    await expect(addTile(page)).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("menuitem", { name: "Pick from image" }).waitFor();
    await page.getByRole("menuitem", { name: "Type a color" }).click();
    await expect(swatches(page)).toHaveCount(7);
    const added = swatches(page).nth(6);
    await expect(added).toHaveAttribute("data-origin", "manual");
    await expect(added).toHaveAttribute("aria-pressed", "true");
    await expect(added).toHaveAttribute("aria-label", /Swatch 7, #636363/);
    // On phones the editor is in the Palette tab, so the field isn't on screen to focus.
    if (!isPhoneProject(info)) {
      await expect(page.getByRole("textbox", { name: "HEX" })).toBeFocused();
      await expect(page.getByRole("textbox", { name: "HEX" })).toHaveValue("#636363");
    }
    await expect(page.getByRole("menuitem")).toHaveCount(0);
    await undoButton(page).click();
    await expect(swatches(page)).toHaveCount(6);
  });

  test("'Pick from image' starts the eyedropper (M3-T16)", async ({ page }) => {
    await page.goto(demo());
    await addTile(page).click();
    const item = page.getByRole("menuitem", { name: "Pick from image" });
    await expect(item).not.toHaveAttribute("data-coming-soon");
    await item.click();
    await expect(page.getByRole("button", { name: "Eyedropper" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(swatches(page)).toHaveCount(6);
  });

  test("Escape closes the menu and returns focus to the tile", async ({ page }) => {
    await page.goto(demo());
    await addTile(page).click();
    await expect(page.getByRole("menuitem", { name: "Pick from image" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "Type a color" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menuitem")).toHaveCount(0);
    await expect(addTile(page)).toBeFocused();
  });

  test("the '+' tile is disabled at 12, with a note", async ({ page }) => {
    await page.goto("./");
    await page.getByTestId("file-input").setInputFiles(fixture("twelve-colors.png"));
    await expect(swatches(page)).toHaveCount(6);
    await page.locator("#setting-colors:visible").fill("12");
    await expect(swatches(page)).toHaveCount(12);
    await expect(page.locator("[data-testid=swatch-strip][data-busy]")).toHaveCount(0);
    await expect(addTile(page)).toBeDisabled();
    await expect(page.getByTestId("strip-full-note")).toHaveText(/at most 12/i);
  });

  test("the '+' tile is at least 44 × 44 at 320 px, and nothing overflows", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(demo());
    const box = await addTile(page).boundingBox();
    if (!box) throw new Error("no tile");
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    await addTile(page).click();
    for (const item of await page.getByRole("menuitem").all()) {
      const b = await item.boundingBox();
      if (!b) throw new Error("no item");
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(320);
    }
  });

  test("the '+' tile works in the sticky strip dock after scrolling (phone and tablet)", async ({
    page,
  }, info) => {
    test.skip(!isPhoneProject(info), "phone only");
    await page.goto(demo());
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForFunction(
      () =>
        Math.abs(window.scrollY + window.innerHeight - document.documentElement.scrollHeight) <= 1,
    );
    await expect(addTile(page)).toBeInViewport();
    await addTile(page).click();
    await page.getByRole("menuitem", { name: "Type a color" }).click();
    await expect(swatches(page)).toHaveCount(7);
  });
});
