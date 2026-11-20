/**
 * Sticky swatch strip on phone and tablet (M2 decision 19, user request 2026-11-19; ui-contract
 * Phone "Source tab" item 4 and intended deviation D4). Below 1024 px the strip on the Source tab
 * pins under the header while the setting rows scroll, so the result of a change stays visible.
 * Desktop is unchanged: the strip is in column 2 and isn't sticky.
 */
import { expect, type Page, test } from "@playwright/test";
import { addScrollSpace, demo, hasHorizontalScroll, isPhoneProject } from "./helpers/app";

const strip = (page: Page) => page.locator("[data-testid=swatch-strip]:visible").first();

/** Scrolls the page to the bottom and waits for the scroll to settle. */
async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForFunction(
    () =>
      Math.abs(window.scrollY + window.innerHeight - document.documentElement.scrollHeight) <= 1,
  );
}

/**
 * Asserts the strip is pinned: inside the viewport, just below the header, with every swatch
 * visible and uncovered at its center, at least 44 px tall, and no horizontal scroll.
 */
async function expectPinned(page: Page, label: string): Promise<void> {
  const header = await page.locator("header").first().boundingBox();
  const bar = await strip(page).boundingBox();
  if (!header || !bar) throw new Error("no header or strip");
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("no viewport");
  const headerBottom = header.y + header.height;
  expect(bar.y, `${label}: strip below the header`).toBeGreaterThanOrEqual(headerBottom - 0.5);
  expect(bar.y, `${label}: strip just below the header`).toBeLessThanOrEqual(headerBottom + 16);
  expect(bar.y + bar.height, `${label}: strip inside the viewport`).toBeLessThanOrEqual(
    viewport.height,
  );
  const swatches = await strip(page)
    .locator("[data-swatch]")
    .evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { top: r.y, bottom: r.bottom, height: r.height, uncovered: hit === el };
      }),
    );
  expect(swatches.length, `${label}: swatches`).toBeGreaterThan(0);
  for (const [i, s] of swatches.entries()) {
    expect(s.uncovered, `${label}: swatch ${i + 1} uncovered`).toBe(true);
    expect(s.height, `${label}: swatch ${i + 1} height`).toBeGreaterThanOrEqual(44);
    expect(s.top, `${label}: swatch ${i + 1} top`).toBeGreaterThanOrEqual(headerBottom);
    expect(s.bottom, `${label}: swatch ${i + 1} bottom`).toBeLessThanOrEqual(viewport.height);
  }
  expect(await hasHorizontalScroll(page), `${label}: horizontal scroll`).toBe(false);
}

/** The strip's top in page coordinates before scrolling, to prove the scroll would hide it. */
async function naturalTop(page: Page): Promise<number> {
  return strip(page).evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
}

test.describe("sticky swatch strip below 1024 px (M2 decision 19; ui-contract D4)", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`phone 320 × 640, ${theme}: the strip stays pinned under the header while the page scrolls`, async ({
      page,
    }, info) => {
      test.skip(!isPhoneProject(info), "phone projects");
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(demo(`theme=${theme}`));
      await addScrollSpace(page);
      await expect(strip(page).locator("[data-swatch]")).toHaveCount(6);
      const top = await naturalTop(page);
      await scrollToBottom(page);
      // Without pinning, this scroll would carry the strip above the header.
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(top);
      await expectPinned(page, `320 × 640 ${theme}`);
    });

    test(`tablet 820 × 1180, ${theme}: the strip stays pinned under the header while the page scrolls`, async ({
      page,
    }, info) => {
      test.skip(info.project.name !== "chromium", "tablet width in chromium");
      await page.setViewportSize({ width: 820, height: 1180 });
      await page.goto(demo(`theme=${theme}`));
      await addScrollSpace(page);
      await expect(page.locator(".app--phone")).toHaveCount(1);
      await expect(strip(page).locator("[data-swatch]")).toHaveCount(6);
      const top = await naturalTop(page);
      await scrollToBottom(page);
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(top);
      await expectPinned(page, `820 × 1180 ${theme}`);
    });
  }

  test("at the top of the page the strip sits in its place under the view bar", async ({
    page,
  }, info) => {
    test.skip(!isPhoneProject(info), "phone projects");
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(demo());
    const viewBar = await page.getByTestId("view-bar").boundingBox();
    const bar = await strip(page).boundingBox();
    if (!viewBar || !bar) throw new Error("no view bar or strip");
    // The panel's 12 px gap, unchanged by the pinned container. The hint (ui-contract phone
    // "Source tab" item 3, M3-T12) sits between the view bar and the strip.
    const hint = await page.getByTestId("marker-hint").boundingBox();
    const above = hint ?? viewBar;
    expect(bar.y - (above.y + above.height)).toBeCloseTo(12, 0);
  });

  test("desktop 1280 × 800: the strip is in column 2 and pins inside its scroll container (M3 decision 45)", async ({ page }, info) => {
    test.skip(isPhoneProject(info), "desktop viewport");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(demo("rows=filters,advanced"));
    await expect(page.locator("[data-column=source] [data-testid=swatch-strip]")).toHaveCount(0);
    const inPalette = page.locator("[data-column=palette] [data-testid=swatch-strip]");
    await expect(inPalette).toHaveCount(1);
    const positions = await inPalette.evaluate((el) => {
      const out: string[] = [];
      for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
        out.push(getComputedStyle(n).position);
      }
      return out;
    });
    // Decision 45 supersedes M2 decision 19 here: column 2's strip pins in its own scroll container.
    expect(positions).toContain("sticky");
    expect(positions).not.toContain("fixed");
  });
});
