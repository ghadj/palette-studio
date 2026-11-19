/**
 * Setting-row layout (M2 fix F3; evaluator failure 1): a row's label group (label and
 * note) and its value never intersect, and nothing scrolls sideways.
 */
import { expect, test } from "@playwright/test";
import { demo, hasHorizontalScroll } from "./helpers/app";
import { measure, openRows } from "./helpers/rows";
import { sheetSettled } from "./helpers/sheet";

const ALGORITHMS = ["balanced", "exact", "swatch-roles", "kmeans"] as const;
const WIDTHS = [1280, 1024, 820, 390, 320] as const;

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
      // No text is clipped, and a wrapped row's value sits fully below its label group.
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll(".setting-row__label, .setting-row__note")]
          .filter((el) => (el as HTMLElement).getClientRects().length > 0)
          .filter((el) => el.scrollWidth > el.clientWidth + 1)
          .map((el) => el.textContent),
      );
      expect(clipped).toEqual([]);
      for (const r of rows) {
        if (!r.value || r.value.top < r.group.bottom - 0.5) continue; // one line, checked above
        expect(r.value.top, `${r.name}: wrapped value`).toBeGreaterThanOrEqual(
          r.group.bottom - 0.5,
        );
        expect(r.value.right, `${r.name}: wrapped value is right-aligned`).toBeGreaterThanOrEqual(
          r.row.right - 1,
        );
      }
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
      "Cluster map",
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
