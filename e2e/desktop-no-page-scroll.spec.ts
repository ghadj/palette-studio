/**
 * From 1024 px the document never scrolls; each column scrolls on its own (M3 decision 37,
 * F30), and a vertical wheel over the Contrast matrix or CVD strips still scrolls column 2.
 */
import { expect, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";
import { sheetSettled } from "./helpers/sheet";

const ROWS = "rows=swatch,adjustments,ramp,contrast,cvd";
const SIZES = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
];
const col2 = "[data-column=palette] .column__scroll";

async function center(page: Page, selector: string) {
  const el = page.locator(`${selector}:visible`).first();
  await el.scrollIntoViewIfNeeded();
  const b = await el.boundingBox();
  if (!b) throw new Error(`no box for ${selector}`);
  return { x: b.x + b.width / 2, y: b.y + Math.min(b.height / 2, 30) };
}

for (const size of SIZES) {
  test.describe(`${size.width} x ${size.height}`, () => {
    test.beforeEach(async ({ page }, info) => {
      test.skip(isPhoneProject(info), "desktop layout only");
      await page.setViewportSize(size);
      await page.goto(demo(ROWS));
      await expect(page.locator(col2)).toBeVisible();
      await expect(page.locator(`${col2} .contrast-scroll`)).toBeVisible();
    });

    test("the document can't scroll, and the footer sits at the bottom", async ({ page }) => {
      const m = await page.evaluate(() => ({
        scroll: (document.scrollingElement as Element).scrollHeight,
        inner: innerHeight,
        footer: (document.querySelector("footer") as HTMLElement).getBoundingClientRect().bottom,
      }));
      expect(m.scroll).toBeLessThanOrEqual(m.inner + 1);
      expect(Math.abs(m.footer - m.inner)).toBeLessThanOrEqual(1);
    });

    test("a wheel over column 2 scrolls it, not the window; over column 1 scrolls column 1", async ({
      page,
    }) => {
      const box = await page.locator(col2).boundingBox();
      if (!box) throw new Error("no column box");
      await page.mouse.move(box.x + box.width / 2, box.y + 200);
      await page.mouse.wheel(0, 600);
      await expect.poll(() => page.locator(col2).evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);

      const c1 = page.locator("[data-column=source] .column__scroll");
      const b1 = await c1.boundingBox();
      if (!b1) throw new Error("no column 1 box");
      const room = await c1.evaluate((el) => el.scrollHeight - el.clientHeight);
      await page.mouse.move(b1.x + b1.width / 2, b1.y + 60);
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(200);
      if (room > 0) expect(await c1.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
    });

    for (const [name, selector] of [
      ["the Contrast matrix", ".contrast-scroll"],
      ["the CVD strips", ".cvd-strip__swatches"],
    ] as const) {
      test(`a wheel up over ${name} scrolls column 2 back up`, async ({ page }) => {
        const scroller = page.locator(col2);
        const at = await center(page, `${col2} ${selector}`);
        const before = await scroller.evaluate((el) => el.scrollTop);
        expect(before, "the target is below the top").toBeGreaterThan(0);
        await page.mouse.move(at.x, at.y);
        await page.mouse.wheel(0, -200);
        await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeLessThan(before);
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
      });
    }
  });
}

test("phone: a vertical wheel over the Contrast matrix scrolls the sheet body", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "phone-chromium",
    "phone drawer; mobile WebKit has no mouse wheel",
  );
  await page.setViewportSize({ width: 390, height: 500 });
  await page.goto(demo("tab=palette&rows=contrast"));
  await sheetSettled(page);
  const body = page.locator("dialog .bottom-sheet__body");
  const room = await body.evaluate((el) => el.scrollHeight - el.clientHeight);
  test.skip(room < 40, "the matrix fits the sheet");
  await body.evaluate((el) => {
    el.scrollTop = 40;
  });
  // A point on the matrix that is inside the sheet body's visible area.
  const at = await page.evaluate(() => {
    const m = (
      document.querySelector("dialog .contrast-scroll") as HTMLElement
    ).getBoundingClientRect();
    const v = (
      document.querySelector("dialog .bottom-sheet__body") as HTMLElement
    ).getBoundingClientRect();
    const top = Math.max(m.top, v.top);
    const bottom = Math.min(m.bottom, v.bottom);
    return { x: m.left + m.width / 2, y: (top + bottom) / 2, ok: bottom - top > 4 };
  });
  expect(at.ok, "the matrix is visible in the sheet").toBe(true);
  await page.mouse.move(at.x, at.y);
  await page.mouse.wheel(0, -30);
  await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeLessThan(40);
});
