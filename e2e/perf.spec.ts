import { expect, type Page, test } from "@playwright/test";
import { demo } from "./helpers/app";

/**
 * Frame-budget checks (spec 7.7): no long task over 50 ms while a drag runs. They run alone, in the
 * `perf` project with one worker, because a long task is a timing measurement and other tests
 * running beside it on the same machine fail it for reasons that have nothing to do with the app.
 * `npm run e2e:perf` runs them; the main `e2e` script leaves them out.
 */

const preview = (page: Page) => page.getByTestId("gradient-preview");

async function watchLongTasks(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __long: number[] };
    w.__long = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__long.push(e.duration);
    }).observe({ entryTypes: ["longtask"] });
  });
}

const longTasks = (page: Page) =>
  page.evaluate(() => (window as unknown as { __long: number[] }).__long);

test.describe.configure({ mode: "serial" });

test("a 1 s stop-bar drag has no long task over 50 ms (M4-T7)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(demo());
  await expect(page.getByTestId("stop-handle")).toHaveCount(3);
  await watchLongTasks(page);
  const h = await page.getByTestId("stop-handle").nth(1).boundingBox();
  const bar = await page.getByTestId("stop-bar").boundingBox();
  if (!h || !bar) throw new Error("no boxes");
  const y = h.y + h.height / 2;
  await page.mouse.move(h.x + h.width / 2, y);
  await page.mouse.down();
  for (let i = 0; i < 60; i++) {
    await page.mouse.move(bar.x + bar.width * (0.5 + 0.3 * Math.sin(i / 8)), y);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  expect((await longTasks(page)).filter((d) => d > 50)).toEqual([]);
});

test("dragging marker 4 changes the 50% stop's color in the preview with no long task over 50 ms (M4-T12)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(demo());
  await expect(preview(page)).toBeVisible();
  const stops = await preview(page).getAttribute("data-stops");
  await watchLongTasks(page);
  const ring = page.locator('[data-marker="4"] .marker__ring');
  const b = await ring.boundingBox();
  if (!b) throw new Error("no marker");
  const from = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 20; i += 1) {
    await page.mouse.move(from.x + i * 4, from.y + i * 6);
  }
  await expect(preview(page)).not.toHaveAttribute("data-stops", stops ?? "");
  await page.mouse.up();
  expect((await longTasks(page)).filter((d) => d > 50)).toEqual([]);
});
