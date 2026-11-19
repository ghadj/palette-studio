/**
 * Strip actions (M3-T5; spec 3.2, 3.7, 6, 6.1; plan decisions 4a, 5b, D10, D12): the "+" tile, drag
 * to reorder, and the arrow keys. Each move is one undo step.
 */
import { expect, type Locator, type Page, test } from "@playwright/test";
import { demo, isPhoneProject, showTab } from "./helpers/app";
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
    await page.goto(demo("tab=palette"));
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
    await page.goto(demo("tab=palette"));
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
    await page.goto(demo("tab=palette"));
    const before = await order(page);
    const [a, b, c, d, e, f] = before;
    await swatches(page).nth(1).focus();
    await page.keyboard.press("ArrowRight");
    // Focus follows the moved swatch after a re-render: wait for it before the next key, or the
    // key lands on the old position.
    await expect.poll(() => order(page)).toEqual([a, c, b, d, e, f]);
    await expect(swatches(page).nth(2)).toBeFocused();
    await expect(swatches(page).nth(2)).toHaveAttribute("aria-label", new RegExp(`${b}$`));
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => order(page)).toEqual([a, b, c, d, e, f]);
    await expect(swatches(page).nth(1)).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => order(page)).toEqual([b, a, c, d, e, f]);
    await expect(swatches(page).nth(0)).toBeFocused();
    // The first swatch has no place to its left.
    await page.keyboard.press("ArrowLeft");
    expect(await order(page)).toEqual([b, a, c, d, e, f]);
    // Each move was one undo step.
    await undoButton(page).click();
    await expect.poll(() => order(page)).toEqual([a, b, c, d, e, f]);
  });

  test("Tab moves focus between swatches and a move is announced", async ({
    page,
    browserName,
  }) => {
    await page.goto(demo("tab=palette"));
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
    // A short viewport, so the page scrolls now that the "+" tile shares the swatches' row (decision 29).
    await page.setViewportSize({ width: 390, height: 520 });
    await page.goto(demo("tab=palette"));
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
    await page.goto(demo("tab=palette"));
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
    await page.goto(demo("tab=palette"));
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

test.describe('the "+" tile (decisions 4a, 40; D12)', () => {
  test("one press adds a 7th swatch that is distinct from all six, has a marker, is selected and manual; Undo removes it", async ({
    page,
  }, info) => {
    await page.goto(demo("tab=palette"));
    const before = await order(page);
    // A single button: no menu, no prompt.
    await expect(addTile(page)).toHaveAccessibleName("Add color");
    await expect(addTile(page)).not.toHaveAttribute("aria-haspopup", /.*/);
    if (isPhoneProject(info)) await addTile(page).tap();
    else await addTile(page).click();
    await expect(swatches(page)).toHaveCount(7);
    await expect(page.getByRole("menuitem")).toHaveCount(0);
    const added = swatches(page).nth(6);
    await expect(added).toHaveAttribute("data-origin", "manual");
    await expect(added).toHaveAttribute("aria-pressed", "true");
    const hex = (await order(page))[6] ?? "";
    expect(before).not.toContain(hex);
    // More than the merge threshold (0.03 ΔE OK) from each of the six.
    const far = await page.evaluate(
      ({ others, mine }) => {
        const toLab = (h: string) => {
          const c = [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255);
          const lin = c.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
          const [r, g, b] = lin as [number, number, number];
          const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
          const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
          const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
          return [
            0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
          ] as [number, number, number];
        };
        const a = toLab(mine);
        return others.map((o) => {
          const b = toLab(o);
          return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        });
      },
      { others: before, mine: hex },
    );
    for (const d of far) expect(d).toBeGreaterThan(0.03);
    // The image is on the Source tab below 1024 px (decision 32): the new swatch has a marker there.
    await showTab(page, "Source");
    await expect(page.locator("[data-marker]:visible")).toHaveCount(7);
    await expect(page.locator('[data-marker="7"]')).toHaveCount(1);
    await undoButton(page).click();
    await expect(swatches(page)).toHaveCount(6);
  });

  test("keyboard: Enter and Space on the focused tile each add a color", async ({ page }, info) => {
    test.skip(isPhoneProject(info), "keyboard");
    await page.goto(demo("tab=palette"));
    await addTile(page).focus();
    await page.keyboard.press("Enter");
    await expect(swatches(page)).toHaveCount(7);
    await expect(addTile(page)).toBeFocused();
    await page.keyboard.press("Space");
    await expect(swatches(page)).toHaveCount(8);
  });

  test("the '+' tile is disabled at 12, with the live note", async ({ page }) => {
    await page.goto("./");
    await page.getByTestId("file-input").setInputFiles(fixture("twelve-colors.png"));
    await expect(swatches(page)).toHaveCount(6);
    await page.locator("#setting-colors:visible").fill("12");
    await expect(swatches(page)).toHaveCount(12);
    await expect(page.locator("[data-testid=swatch-strip][data-busy]")).toHaveCount(0);
    // The "+" tile and its note are on the Palette tab below 1024 px (M3 decision 32).
    await showTab(page, "Palette");
    await expect(addTile(page)).toBeDisabled();
    await expect(page.getByTestId("strip-full-note")).toHaveText(
      "A palette holds at most 12 colors.",
    );
    await expect(
      page.locator("[role=status]").filter({ has: page.getByTestId("strip-full-note") }),
    ).toHaveCount(1);
  });

  test("six presses reach 12, then it is disabled", async ({ page }) => {
    await page.goto(demo("tab=palette"));
    for (let i = 0; i < 6; i += 1) {
      await expect(addTile(page)).toBeEnabled();
      await addTile(page).click();
      await expect(swatches(page)).toHaveCount(7 + i);
    }
    await expect(addTile(page)).toBeDisabled();
  });

  test("with 6 swatches the '+' tile is on the swatches' row, desktop and the phone Palette tab's dock (decision 29)", async ({
    page,
  }, info) => {
    await page.setViewportSize(
      isPhoneProject(info) ? { width: 390, height: 844 } : { width: 1280, height: 800 },
    );
    await page.goto(demo("tab=palette"));
    const tile = await addTile(page).boundingBox();
    const first = await swatches(page).first().boundingBox();
    const last = await swatches(page).nth(5).boundingBox();
    if (!tile || !first || !last) throw new Error("no boxes");
    expect(Math.abs(tile.y - first.y)).toBeLessThanOrEqual(1);
    expect(tile.x).toBeGreaterThan(last.x);
    expect(tile.width).toBeGreaterThanOrEqual(44);
    expect(last.width).toBeGreaterThanOrEqual(44);
  });

  test("the '+' tile is at least 44 × 44 at 320 px, and nothing overflows", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(demo("tab=palette"));
    const box = await addTile(page).boundingBox();
    if (!box) throw new Error("no tile");
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  });

  test("the '+' tile works in the sticky strip dock after scrolling (phone and tablet)", async ({
    page,
  }, info) => {
    test.skip(!isPhoneProject(info), "phone only");
    await page.goto(demo("tab=palette"));
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForFunction(
      () =>
        Math.abs(window.scrollY + window.innerHeight - document.documentElement.scrollHeight) <= 1,
    );
    await expect(addTile(page)).toBeInViewport();
    await addTile(page).tap();
    await expect(swatches(page)).toHaveCount(7);
  });
});

test.describe("Remove button on the selected swatch (M3 decision 38)", () => {
  const remove = (page: Page) => strip(page).getByTestId("remove-swatch");
  const undoKey = (page: Page) => page.keyboard.press("Control+z");
  const labelAt = (page: Page, point: { x: number; y: number }) =>
    page.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.closest("[data-swatch]")?.getAttribute("aria-label"),
      point,
    );

  test("the X shows on the selected swatch only; removing it deletes it, selects the neighbour, and Undo restores it", async ({
    page,
  }) => {
    await page.goto(demo());
    await expect(remove(page)).toHaveCount(1);
    // Swatch 3 is selected in the demo.
    await expect(remove(page)).toHaveAccessibleName("Remove swatch 3");
    const before = await order(page);
    await remove(page).click();
    await expect(swatches(page)).toHaveCount(5);
    expect(await order(page)).toEqual(before.filter((_, i) => i !== 2));
    // The swatch that took its place (the old 4) is selected and carries the X.
    await expect(swatches(page).nth(2)).toHaveAttribute("aria-pressed", "true");
    await expect(remove(page)).toHaveAccessibleName("Remove swatch 3");
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await undoKey(page);
    await expect(swatches(page)).toHaveCount(6);
    expect(await order(page)).toEqual(before);
  });

  test("selecting another swatch moves the X to it", async ({ page }, info) => {
    await page.goto(demo());
    if (isPhoneProject(info)) await swatches(page).nth(0).tap();
    else await swatches(page).nth(0).click();
    await expect(remove(page)).toHaveCount(1);
    await expect(remove(page)).toHaveAccessibleName("Remove swatch 1");
  });

  test("a phone tap removes the swatch", async ({ page }, info) => {
    test.skip(!isPhoneProject(info), "touch");
    await page.goto(demo());
    await remove(page).tap();
    await expect(swatches(page)).toHaveCount(5);
  });

  test("keyboard: Tab from the selected swatch reaches the X; Enter removes; Delete and Backspace on a swatch remove it", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "keyboard");
    await page.goto(demo());
    await swatches(page).nth(2).focus();
    await page.keyboard.press("Tab");
    await expect(remove(page)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(swatches(page)).toHaveCount(5);
    // Focus moves to the selected neighbour; Delete removes it, and so does Backspace.
    await expect(swatches(page).nth(2)).toBeFocused();
    await page.keyboard.press("Delete");
    await expect(swatches(page)).toHaveCount(4);
    await swatches(page).nth(1).focus();
    await page.keyboard.press("Backspace");
    await expect(swatches(page)).toHaveCount(3);
  });

  test("Backspace in the HEX field edits text and doesn't remove a swatch", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "the editor is in the Palette tab on a phone");
    await page.goto(demo());
    const hex = page.getByRole("textbox", { name: "HEX" });
    await hex.focus();
    await page.keyboard.press("Backspace");
    await expect(swatches(page)).toHaveCount(6);
  });

  test("the hit area is at least 44 px on phones and --hit on desktop, and it leaves the neighbours and a reorder press reachable", async ({
    page,
  }, info) => {
    await page.goto(demo());
    const phone = isPhoneProject(info);
    const box = await remove(page).boundingBox();
    if (!box) throw new Error("no X");
    const min = phone ? 44 : 32;
    expect(box.width).toBeGreaterThanOrEqual(min);
    expect(box.height).toBeGreaterThanOrEqual(min);
    for (const i of [1, 3]) {
      const c = await center(swatches(page).nth(i));
      expect(await labelAt(page, c)).toBe(await swatches(page).nth(i).getAttribute("aria-label"));
    }
    // The selected swatch's lower-left area still reaches it, for a reorder press.
    const own = await swatches(page).nth(2).boundingBox();
    if (!own) throw new Error("no swatch");
    const lowerLeft = await labelAt(page, {
      x: own.x + own.width * 0.3,
      y: own.y + own.height * 0.8,
    });
    expect(lowerLeft).toBe(await swatches(page).nth(2).getAttribute("aria-label"));
  });

  test("the X works in the Palette tab's strip on a phone too", async ({ page }, info) => {
    test.skip(!isPhoneProject(info), "phone tabs");
    await page.goto(demo("tab=palette"));
    await expect(remove(page)).toHaveCount(1);
    await remove(page).tap();
    await expect(swatches(page)).toHaveCount(5);
  });
});
