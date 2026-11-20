/**
 * Setting-row layout (M2 fix F3; evaluator failure 1): a row's label group (label and
 * note) and its value never intersect, and nothing scrolls sideways.
 */
import { expect, test } from "@playwright/test";
import { demo, hasHorizontalScroll } from "./helpers/app";
import { inRowScopes, measure } from "./helpers/rows";
import { sheetSettled } from "./helpers/sheet";

const ALGORITHMS = ["balanced", "exact", "swatch-roles", "kmeans"] as const;
const WIDTHS = [1280, 1024, 820, 390, 320] as const;

for (const width of WIDTHS) {
  for (const algorithm of ALGORITHMS) {
    test(`label groups and values never intersect: ${algorithm} at ${width} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(demo());
      await page.locator("#setting-algorithm:visible").selectOption(algorithm);
      let count = 0;
      // Below 1024 px Filters and Advanced are sheets, checked one after the other.
      await inRowScopes(page, async (scope) => {
        if (algorithm === "exact" || algorithm === "swatch-roles") {
          if (scope !== "Filters") {
            await expect(page.locator("#setting-seed-note:visible")).not.toBeEmpty();
            await expect(page.locator(".setting-row[data-disabled]:visible").first()).toBeVisible();
          }
        }
        const rows = await measure(page);
        count += rows.length;
        for (const r of rows) {
          if (!r.value) continue;
          const apart =
            r.group.right <= r.value.left + 0.5 ||
            r.value.right <= r.group.left + 0.5 ||
            r.group.bottom <= r.value.top + 0.5 ||
            r.value.bottom <= r.group.top + 0.5;
          expect(apart, `${r.name}: label group overlaps its value`).toBe(true);
        }
        expect(await hasHorizontalScroll(page)).toBe(false);
        // No text is clipped, and a wrapped row's value sits fully below its label group.
        const clipped = await page.evaluate(() =>
          [...document.querySelectorAll(".setting-row__label, .setting-row__note")]
            .filter((el) => (el as HTMLElement).getClientRects().length > 0)
            .filter((el) => el.scrollWidth > el.clientWidth + 1)
            .map((el) => el.textContent),
        );
        expect(clipped).toEqual([]);
        // The value wraps below only as a fallback (M2 decision 23), and then it is right-aligned.
        for (const r of rows) {
          if (!r.value || r.value.top < r.group.bottom - 0.5) continue;
          expect(r.value.right, `${r.name}: wrapped value is right-aligned`).toBeGreaterThanOrEqual(
            r.row.right - 1,
          );
        }
      });
      expect(count).toBeGreaterThan(8);
    });
  }
}

// M3-T2: the setting rows in the Palette tab's bottom sheets never overlap either.
for (const width of [820, 390, 320] as const) {
  test(`sheet rows never intersect and nothing scrolls sideways at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(demo("tab=palette&rows=swatch"));
    await sheetSettled(page);
    const rows = await measure(page);
    // The swatch fields are setting rows now, so they are measured too (M3-T17).
    expect(rows.map((r) => r.name)).toEqual([
      "Format",
      "HEX",
      "Name",
      "Suggested",
      "Sample radius (px)",
      "Sample statistic",
    ]);
    for (const r of rows) {
      if (!r.value) continue;
      const apart =
        r.group.right <= r.value.left + 0.5 ||
        r.value.right <= r.group.left + 0.5 ||
        r.group.bottom <= r.value.top + 0.5 ||
        r.value.bottom <= r.group.top + 0.5;
      expect(apart, `${r.name}: label group overlaps its value`).toBe(true);
    }
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
}

// M2 decision 23: label group and value share one line, vertically centered, at every width.
const ONE_LINE_WIDTHS = [320, 360, 375, 390, 820, 1024, 1280] as const;
const SLIDER_MIN = 64; // calc(var(--space-8) * 2)

for (const width of ONE_LINE_WIDTHS) {
  for (const algorithm of ALGORITHMS) {
    test(`label group and value share one line: ${algorithm} at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(demo());
      await page.locator("#setting-algorithm:visible").selectOption(algorithm);
      let count = 0;
      let sliderCount = 0;
      await inRowScopes(page, async (scope) => {
        if ((algorithm === "exact" || algorithm === "swatch-roles") && scope !== "Filters") {
          await expect(page.locator("#setting-seed-note:visible")).not.toBeEmpty();
        }
        const rows = await measure(page);
        count += rows.length;
        for (const r of rows) {
          if (!r.value) continue;
          const overlap =
            Math.min(r.group.bottom, r.value.bottom) - Math.max(r.group.top, r.value.top);
          expect(overlap, `${r.name}: ranges overlap`).toBeGreaterThan(0);
          const gc = (r.group.top + r.group.bottom) / 2;
          const vc = (r.value.top + r.value.bottom) / 2;
          expect(Math.abs(gc - vc), `${r.name}: centers`).toBeLessThanOrEqual(2);
          expect(r.group.right, `${r.name}: group left of value`).toBeLessThanOrEqual(
            r.value.left + 0.5,
          );
        }
        expect(await hasHorizontalScroll(page)).toBe(false);
        const sliders = await page.evaluate(() =>
          [...document.querySelectorAll(".setting-row .slider")]
            .filter((el) => (el as HTMLElement).getClientRects().length > 0)
            .map((el) => el.getBoundingClientRect().width),
        );
        sliderCount += sliders.length;
        for (const w of sliders) expect(w).toBeGreaterThanOrEqual(SLIDER_MIN - 0.5);
      });
      expect(count).toBeGreaterThan(8);
      expect(sliderCount).toBeGreaterThan(3);
    });
  }
}
