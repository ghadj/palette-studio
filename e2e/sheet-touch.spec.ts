/**
 * Touch gestures work inside an open sheet (M3-F20, final evaluation failure 1): the drawer lock
 * only cancels touches outside the sheet's panel, so the contrast matrix pans sideways and sliders
 * follow the finger. Real touch comes from CDP, so these run on phone-chromium only.
 */
import { expect, type Page, test } from "@playwright/test";
import { demo } from "./helpers/app";
import { sheetSettled } from "./helpers/sheet";

test.beforeEach(({ browserName: _browser }, info) => {
  test.skip(info.project.name !== "phone-chromium", "CDP touch gestures");
});

async function swipe(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 12,
): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(250);
}

test("a horizontal swipe on the contrast matrix pans it and leaves the page alone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(demo("tab=palette&rows=contrast"));
  await sheetSettled(page);
  const scroller = page.locator("dialog .contrast-scroll");
  const info = await scroller.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { room: el.scrollWidth - el.clientWidth, x: r.x + r.width / 2, y: r.y + 40 };
  });
  expect(info.room, "the matrix overflows sideways").toBeGreaterThan(0);
  const y0 = await page.evaluate(() => window.scrollY);
  await swipe(page, { x: info.x + 80, y: info.y }, { x: info.x - 80, y: info.y });
  expect(await scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(40);
  expect(await page.evaluate(() => window.scrollY)).toBe(y0);
});

for (const [query, label, name] of [
  ["tab=palette&rows=adjustments", "Lightness slider", "Adjustments Lightness"],
  ["rows=filters", "Dark threshold slider", "Filters Dark threshold"],
  ["rows=advanced", "Merge threshold slider", "Advanced Merge threshold"],
] as const) {
  test(`${name}: a touch drag at 820 px follows the finger`, async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto(demo(query));
    await sheetSettled(page);
    // The Filters thresholds are disabled until their toggle is on.
    if (label.startsWith("Dark")) await page.locator("#setting-ignore-dark:visible").click();
    const slider = page.locator(`dialog input[type=range][aria-label="${label}"]`);
    const g = await slider.evaluate((el: HTMLInputElement) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y + r.height / 2, w: r.width, min: +el.min, max: +el.max };
    });
    const at = (f: number) => ({ x: g.x + g.w * f, y: g.y });
    await swipe(page, at(0.2), at(0.8));
    const value = Number(await slider.inputValue());
    const expected = g.min + (g.max - g.min) * 0.8;
    const tolerance = (g.max - g.min) * 0.15;
    expect(Math.abs(value - expected), `value ${value} near ${expected}`).toBeLessThan(tolerance);
  });
}

test("a vertical swipe over the pinned strip leaves the page where it is", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(demo("rows=advanced"));
  await sheetSettled(page);
  const before = await page.evaluate(() => window.scrollY);
  const box = await page.locator("[data-testid=strip-dock]").boundingBox();
  if (!box) throw new Error("no dock");
  const x = box.x + box.width / 2;
  await swipe(page, { x, y: box.y + box.height / 2 + 10 }, { x, y: box.y - 10 });
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
});

test("inside the sheet only a vertical move that cannot scroll is cancelled (iOS chaining)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(demo("rows=advanced"));
  await sheetSettled(page);
  const result = await page.evaluate(() => {
    const move = (el: Element, from: [number, number], to: [number, number]) => {
      const mk = (type: string, [x, y]: [number, number]) => {
        const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
        return new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          touches: [t],
          targetTouches: [t],
          changedTouches: [t],
        });
      };
      el.dispatchEvent(mk("touchstart", from));
      const e = mk("touchmove", to);
      el.dispatchEvent(e);
      return e.defaultPrevented;
    };
    const body = document.querySelector(".bottom-sheet__body");
    const slider = document.querySelector("dialog input[type=range]");
    const canScroll = body ? body.scrollHeight > body.clientHeight : false;
    if (!body || !slider) throw new Error("missing");
    const heading = body.firstElementChild ?? body;
    return {
      canScroll,
      sliderVertical: move(slider, [100, 100], [100, 40]),
      sliderHorizontal: move(slider, [100, 100], [180, 100]),
      bodyHorizontal: move(heading, [100, 100], [180, 100]),
      bodyUpAtTop: move(heading, [100, 100], [100, 160]),
    };
  });
  expect(result.sliderVertical).toBe(false);
  expect(result.sliderHorizontal).toBe(false);
  expect(result.bodyHorizontal).toBe(false);
  // Dragging down at scrollTop 0 cannot scroll the body: iOS would chain to the page.
  expect(result.bodyUpAtTop).toBe(true);
});
