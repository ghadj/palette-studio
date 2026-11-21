import { expect, type Page, test } from "@playwright/test";
import { demo, hasHorizontalScroll, isPhoneProject } from "./helpers/app";

/** The stop bar (M4-T7; spec 4.3 "Stops", 6.1 "Gestures"; plan Q1a, D4, D5). */

async function open(page: Page, info: { project: { name: string } }, query = "") {
  if (isPhoneProject(info as never)) await page.goto(demo(`tab=gradient${query && `&${query}`}`));
  else {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(demo(query));
  }
  await expect(page.getByTestId("stop-handle")).toHaveCount(3);
}

const stopsOf = (page: Page) => page.getByTestId("gradient-preview").getAttribute("data-stops");
const handle = (page: Page, n: number) => page.getByTestId("stop-handle").nth(n - 1);
const undo = (page: Page, label: string) =>
  page.locator("header").getByRole("button", { name: `Undo ${label}` });
const technique = (page: Page) => page.getByTestId("technique-value");

async function barBox(page: Page) {
  const b = await page.getByTestId("stop-bar").boundingBox();
  if (!b) throw new Error("no bar");
  return b;
}

/** Drags a handle to a position (0 to 1) along the bar with the mouse. */
async function dragTo(page: Page, n: number, to: number, release = true) {
  const h = await handle(page, n).boundingBox();
  const bar = await barBox(page);
  if (!h) throw new Error("no handle");
  const y = h.y + h.height / 2;
  await page.mouse.move(h.x + h.width / 2, y);
  await page.mouse.down();
  const x = bar.x + bar.width * to;
  await page.mouse.move(x, y, { steps: 6 });
  if (release) await page.mouse.up();
}

test.describe("Stop bar (M4-T7)", () => {
  test("a locked stop's handle is aria-disabled and its name says locked", async ({
    page,
  }, info) => {
    await open(page, info);
    await expect(handle(page, 2)).not.toHaveAttribute("aria-disabled", /.*/);
    await page.goto(demo(isPhoneProject(info) ? "tab=gradient&rows=stop" : "rows=stop"));
    await expect(page.getByTestId("stop-handle")).toHaveCount(3);
    const lock = page.getByRole("switch", { name: "Lock" });
    await lock.click();
    await expect(lock).toHaveAttribute("aria-checked", "true");
    await expect(handle(page, 2)).toHaveAttribute("aria-disabled", "true");
    await expect(handle(page, 2)).toHaveAttribute("aria-label", "Stop 2, Swatch 4, 50%, locked");
    await lock.click();
    await expect(handle(page, 2)).not.toHaveAttribute("aria-disabled", /.*/);
    await expect(handle(page, 2)).toHaveAttribute("aria-label", "Stop 2, Swatch 4, 50%");
  });

  test("fixture: 3 handles; the 50% one has the accent ring", async ({ page }, info) => {
    await open(page, info);
    await expect(page.locator(".stop-handle[data-selected]")).toHaveCount(1);
    await expect(handle(page, 2)).toHaveAttribute("data-selected", "");
    await expect(handle(page, 2)).toHaveAttribute("aria-label", "Stop 2, Swatch 4, 50%");
    await expect(handle(page, 2)).toHaveAttribute("role", "slider");
  });

  test("dragging the 50% stop to 30% gives #D4527F@30 and Custom; one undo step; Undo restores", async ({
    page,
  }, info) => {
    await open(page, info);
    await expect(technique(page)).toContainText("Smooth path");
    await dragTo(page, 2, 0.3);
    await expect(page.getByTestId("gradient-preview")).toHaveAttribute(
      "data-stops",
      /#D4527F@(29\.[5-9]\d*|30|30\.[0-4]\d*),/,
    );
    await expect(technique(page)).toContainText("Custom");
    await undo(page, "Move stop").click();
    expect(await stopsOf(page)).toBe("#1DB07A@0,#D4527F@50,#5039B0@100");
    await expect(technique(page)).toContainText("Smooth path");
    await expect(page.locator("header").getByRole("button", { name: /^Undo/ })).toBeDisabled();
  });

  test("Esc mid-drag restores", async ({ page }, info) => {
    await open(page, info);
    await dragTo(page, 2, 0.3, false);
    await expect(page.getByTestId("gradient-preview")).toHaveAttribute(
      "data-stops",
      /#D4527F@(29\.[5-9]\d*|30|30\.[0-4]\d*),/,
    );
    await page.keyboard.press("Escape");
    await page.mouse.up();
    expect(await stopsOf(page)).toBe("#1DB07A@0,#D4527F@50,#5039B0@100");
    await expect(technique(page)).toContainText("Smooth path");
    await expect(page.locator("header").getByRole("button", { name: /^Undo/ })).toBeDisabled();
  });

  test("a click at 75% adds a 4th stop at 75, as one step", async ({ page }, info) => {
    await open(page, info);
    const bar = await barBox(page);
    await page.mouse.click(bar.x + bar.width * 0.75, bar.y + 22);
    await expect(page.getByTestId("stop-handle")).toHaveCount(4);
    const stops = (await stopsOf(page)) ?? "";
    expect(stops.split(",")).toHaveLength(4);
    expect(stops).toMatch(/@(74\.[5-9]\d*|75|75\.[0-4]\d*),/);
    await undo(page, "Add stop").click();
    await expect(page.getByTestId("stop-handle")).toHaveCount(3);
  });

  test("Delete removes the selected stop; at 2 stops it is refused, with the live note", async ({
    page,
  }, info) => {
    await open(page, info);
    await handle(page, 2).focus();
    await page.keyboard.press("Delete");
    await expect(page.getByTestId("stop-handle")).toHaveCount(2);
    expect(await stopsOf(page)).toBe("#1DB07A@0,#5039B0@100");
    await handle(page, 1).focus();
    await page.keyboard.press("Delete");
    await expect(page.getByTestId("stop-handle")).toHaveCount(2);
    await expect(page.getByTestId("stop-bar-note")).toHaveText(
      "A gradient needs at least 2 stops.",
    );
  });

  test("ArrowRight x3 gives 53; Shift+ArrowRight gives 63", async ({ page }, info) => {
    await open(page, info);
    await handle(page, 2).focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
    await expect(handle(page, 2)).toHaveAttribute("aria-valuenow", "53");
    await page.keyboard.press("Shift+ArrowRight");
    await expect(handle(page, 2)).toHaveAttribute("aria-valuenow", "63");
    await page.keyboard.press("Shift+ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(handle(page, 2)).toHaveAttribute("aria-valuenow", "50");
    await expect(handle(page, 2)).toBeFocused();
    await page.keyboard.press("Home");
    await expect(page.locator("[data-stop-id]").first()).toHaveAttribute("aria-valuenow", "0");
  });

  test("+ adds a stop halfway to the next one", async ({ page }, info) => {
    await open(page, info);
    await handle(page, 2).focus();
    await page.keyboard.press("+");
    await expect(page.getByTestId("stop-handle")).toHaveCount(4);
    expect((await stopsOf(page)) ?? "").toMatch(/@75,/);
  });

  test("dragging a midpoint diamond adds ~H to data-stops", async ({ page }, info) => {
    await open(page, info);
    const d = await page.getByTestId("stop-midpoint").first().boundingBox();
    const bar = await barBox(page);
    if (!d) throw new Error("no diamond");
    const y = d.y + d.height / 2;
    await page.mouse.move(d.x + d.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(bar.x + bar.width * 0.2, y, { steps: 5 });
    await page.mouse.up();
    expect(await stopsOf(page)).toMatch(/~\d+/);
    await undo(page, "Move midpoint").click();
    expect(await stopsOf(page)).toBe("#1DB07A@0,#D4527F@50,#5039B0@100");
  });

  test("phone-chromium touch: a handle drag leaves window.scrollY unchanged", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "phone-chromium", "CDP touch");
    await open(page, info);
    const y0 = await page.evaluate(() => window.scrollY);
    const h = await handle(page, 2).boundingBox();
    const bar = await barBox(page);
    if (!h) throw new Error("no handle");
    const from = { x: h.x + h.width / 2, y: h.y + h.height / 2 };
    const cdp = await page.context().newCDPSession(page);
    const send = (type: string, pts: Array<{ x: number; y: number }>) =>
      cdp.send("Input.dispatchTouchEvent", {
        type: type as "touchStart",
        touchPoints: pts.map((p, id) => ({ x: p.x, y: p.y, id })),
      });
    await send("touchStart", [from]);
    for (let i = 1; i <= 6; i++) {
      await send("touchMove", [
        { x: from.x + ((bar.x + bar.width * 0.3 - from.x) * i) / 6, y: from.y + i * 6 },
      ]);
    }
    await send("touchEnd", []);
    expect(await page.evaluate(() => window.scrollY)).toBe(y0);
    await expect(page.getByTestId("gradient-preview")).toHaveAttribute(
      "data-stops",
      /#D4527F@(2\d|3\d)/,
    );
  });

  test("320 px: no horizontal scroll, and the end handles' hit areas are inside the viewport", async ({
    page,
  }, info) => {
    test.skip(!isPhoneProject(info), "phone projects");
    await page.setViewportSize({ width: 320, height: 700 });
    await open(page, info);
    expect(await hasHorizontalScroll(page)).toBe(false);
    for (const n of [1, 3]) {
      const area = await handle(page, n).evaluate((el) => {
        const w = Number.parseFloat(getComputedStyle(el, "::before").width);
        const b = el.getBoundingClientRect();
        return { left: b.left + b.width / 2 - w / 2, right: b.left + b.width / 2 + w / 2, w };
      });
      expect(area.w).toBeGreaterThanOrEqual(44);
      expect(area.left).toBeGreaterThanOrEqual(0);
      expect(area.right).toBeLessThanOrEqual(320);
    }
  });
});
