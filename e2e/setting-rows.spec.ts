/**
 * Setting-row layout (M2 fix F3; evaluator failure 1): a row's label group (label and
 * note) and its value never intersect, and nothing scrolls sideways.
 */
import { expect, test } from "@playwright/test";
import { demo, hasHorizontalScroll } from "./helpers/app";
import { measure, openRows } from "./helpers/rows";

const ALGORITHMS = ["balanced", "exact", "swatch-roles", "kmeans"] as const;
const WIDTHS = [1280, 1024, 820, 320] as const;

for (const width of WIDTHS) {
  for (const algorithm of ALGORITHMS) {
    test(`label groups and values never intersect: ${algorithm} at ${width} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(demo("rows=filters,advanced"));
      await openRows(page);
      await page.locator("#setting-algorithm:visible").selectOption(algorithm);
      if (algorithm === "exact" || algorithm === "swatch-roles") {
        await expect(page.locator("#setting-seed-note:visible")).not.toBeEmpty();
        await expect(page.locator(".setting-row[data-disabled]:visible").first()).toBeVisible();
      }
      const rows = await measure(page);
      expect(rows.length).toBeGreaterThan(8);
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
}
