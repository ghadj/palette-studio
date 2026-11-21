import { expect, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";
import { sheetSettled } from "./helpers/sheet";

/**
 * An expanded settings group ends with its last row's divider and nothing else: no gap below it and
 * no second line before the next row (user report, M4-T14). Applies to every chevron row that
 * expands in place and to the rows of the phone drawers. Contrast and CVD are left out: they end in
 * a chart, not a row.
 */

interface Measure {
  where: string;
  gap: number;
  lines: number;
}

/** Runs in the page: the gap and dividers after the last setting row of a group (see below). */
async function measureAfterLastRow(page: Page, scope: string): Promise<Measure[]> {
  return page.evaluate((selector) => {
    const px = (v: string) => Number.parseFloat(v) || 0;
    const out: Array<{ where: string; gap: number; lines: number }> = [];
    for (const group of document.querySelectorAll<HTMLElement>(selector)) {
      const rows = [...group.querySelectorAll<HTMLElement>(".setting-row")].filter(
        (r) => r.getBoundingClientRect().height > 0,
      );
      const a = rows[rows.length - 1];
      if (!a) continue;
      const where = group.dataset.row ?? group.dataset.testid ?? group.className;
      // What follows the group: the next sibling's first row or summary, if any.
      let next: HTMLElement | null = null;
      for (let el: HTMLElement | null = group; el && !next; el = el.parentElement) {
        const sib = el.nextElementSibling as HTMLElement | null;
        if (sib && sib.getBoundingClientRect().height > 0) {
          next = sib.querySelector<HTMLElement>(".setting-row, .chevron-row__summary") ?? sib;
          if (sib.matches(".setting-row, .chevron-row__summary")) next = sib;
        }
        if (el.matches("[data-panel], .shell, main")) break;
      }
      const ar = a.getBoundingClientRect();
      let lines = px(getComputedStyle(a).borderBottomWidth);
      const edge = next ? next.getBoundingClientRect().top : group.getBoundingClientRect().bottom;
      for (let el = a.parentElement; el && !(next && el.contains(next)); el = el.parentElement) {
        lines += px(getComputedStyle(el).borderBottomWidth);
        if (el === group) break;
      }
      if (next) {
        lines += px(getComputedStyle(next).borderTopWidth);
        for (let el = next.parentElement; el && !el.contains(a); el = el.parentElement) {
          lines += px(getComputedStyle(el).borderTopWidth);
        }
      }
      out.push({ where, gap: edge - ar.bottom, lines });
    }
    return out;
  }, scope);
}

const THEMES = ["light", "dark"] as const;
const DESKTOP_ROWS = [
  "filters",
  "advanced",
  "swatch",
  "adjustments",
  "interpolation",
  "stop",
  "geometry",
];

for (const theme of THEMES) {
  test(`${theme}: desktop groups end with one divider and no gap`, async ({ page }, info) => {
    test.skip(isPhoneProject(info), "desktop only");
    await page.setViewportSize({ width: 1280, height: 1100 });
    await page.goto(demo(`theme=${theme}&rows=${DESKTOP_ROWS.join(",")}&technique=palette-order`));
    await expect(page.getByTestId("row-stop")).toBeVisible();
    await page.waitForTimeout(300);
    const found = await measureAfterLastRow(page, ".chevron-row");
    expect(found.length).toBeGreaterThanOrEqual(DESKTOP_ROWS.length);
    for (const m of found) {
      expect(m.gap, `${m.where}: gap after the last row`).toBeLessThanOrEqual(1);
      expect(m.lines, `${m.where}: dividers after the last row`).toBe(1);
    }
  });

  test(`${theme}: Custom easing ends Interpolation options flush with one divider`, async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "desktop only");
    await page.setViewportSize({ width: 1280, height: 1100 });
    await page.goto(demo(`theme=${theme}&rows=interpolation`));
    await expect(page.getByTestId("row-interpolation")).toBeVisible();
    await page.locator("#interp-easing").selectOption("cubic-bezier");
    await expect(page.getByTestId("bezier-field")).toHaveCount(4);
    const m = await page.evaluate(() => {
      const px = (v: string) => Number.parseFloat(v) || 0;
      const group = document.querySelector<HTMLElement>("[data-testid=row-interpolation]");
      const bezier = document.querySelector<HTMLElement>("[data-testid=bezier-fields]");
      if (!group || !bezier) return null;
      const g = getComputedStyle(group);
      return {
        gap: group.getBoundingClientRect().bottom - bezier.getBoundingClientRect().bottom,
        lines: px(getComputedStyle(bezier).borderBottomWidth) + px(g.borderBottomWidth),
        lastIsBezier: bezier.parentElement?.lastElementChild === bezier,
      };
    });
    expect(m).not.toBeNull();
    expect(m?.lastIsBezier).toBe(true);
    expect(m?.gap).toBeLessThanOrEqual(1);
    expect(m?.lines).toBe(1);
  });

  test(`${theme}: inline Technique rows sit flush with one divider`, async ({ page }, info) => {
    test.skip(isPhoneProject(info), "desktop only");
    await page.setViewportSize({ width: 1280, height: 1100 });
    for (const technique of [
      "sorted",
      "smooth-path",
      "image-sample",
      "derived",
      "random",
      "population",
    ]) {
      await page.goto(demo(`theme=${theme}&technique=${technique}`));
      await expect(page.getByTestId("gradient-rows")).toBeVisible();
      const pairs = await page.evaluate(() => {
        const px = (v: string) => Number.parseFloat(v) || 0;
        const rows = [
          ...document.querySelectorAll<HTMLElement>("[data-testid=gradient-rows] .setting-row"),
        ];
        return rows.flatMap((a, i) => {
          const b = rows[i + 1];
          if (!b || a.nextElementSibling !== b) return [];
          return [
            {
              gap: b.getBoundingClientRect().top - a.getBoundingClientRect().bottom,
              lines:
                px(getComputedStyle(a).borderBottomWidth) + px(getComputedStyle(b).borderTopWidth),
            },
          ];
        });
      });
      for (const p of pairs) {
        expect(p.gap, technique).toBeLessThanOrEqual(1);
        expect(p.lines, technique).toBe(1);
      }
    }
  });

  test(`${theme}: phone drawers end with one divider and no gap below the last row`, async ({
    page,
  }, info) => {
    test.skip(!isPhoneProject(info), "phone only");
    const sheets: Array<[string, string]> = [
      ["source", "filters"],
      ["source", "advanced"],
      ["palette", "swatch"],
      ["palette", "adjustments"],
      ["gradient", "interpolation"],
      ["gradient", "stop"],
      ["gradient", "geometry"],
    ];
    for (const [tab, row] of sheets) {
      await page.goto(demo(`theme=${theme}&tab=${tab}&rows=${row}`));
      await sheetSettled(page);
      const found = await measureAfterLastRow(page, ".bottom-sheet__body");
      expect(found.length, row).toBeGreaterThan(0);
      for (const m of found) {
        expect(m.lines, `${row}: dividers after the last row`).toBe(1);
      }
    }
  });
}
