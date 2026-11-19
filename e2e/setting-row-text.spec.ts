/**
 * Setting-row text size on touch (M2 fix F7, decision 22): below 1024 px or with a coarse pointer
 * labels step up to 15 px beside the 16 px fields (spec 6.1). A fine pointer keeps 13 px.
 */
import { expect, test } from "@playwright/test";
import { demo } from "./helpers/app";

const sizes = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const px = (el: Element | null) => (el ? getComputedStyle(el).fontSize : "");
    const vis = (sel: string) =>
      [...document.querySelectorAll(sel)].find((e) => (e as HTMLElement).getClientRects().length);
    return {
      label: px(vis(".setting-row__label") ?? null),
      summary: px(vis(".chevron-row__summary") ?? null),
      field: px(vis("#setting-colors") ?? null),
      select: px(vis("#setting-algorithm") ?? null),
    };
  });

for (const width of [390, 820] as const) {
  test(`labels are 15 px and fields 16 px at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(demo());
    expect(await sizes(page)).toEqual({
      label: "15px",
      summary: "15px",
      field: "16px",
      select: "16px",
    });
  });
}

// M3-T2: the Palette tab's chevron rows and the rows in its sheets step up too.
for (const width of [390, 820] as const) {
  test(`Palette-tab chevron rows and sheet rows are 15 px at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(demo("tab=palette&rows=swatch"));
    await expect(page.getByRole("dialog")).toBeVisible();
    const s = await page.evaluate(() => {
      const px = (sel: string) =>
        [...document.querySelectorAll(sel)]
          .filter((e) => (e as HTMLElement).getClientRects().length)
          .map((e) => getComputedStyle(e).fontSize);
      return {
        rows: px("[data-testid=palette-rows] .chevron-row__summary"),
        sheet: px("dialog .setting-row__label"),
      };
    });
    expect(s.rows).toEqual(["15px", "15px", "15px", "15px"]);
    // The sheet holds the swatch fields (Format, HEX, Name, ...) and the Cluster map row.
    expect(s.sheet.length).toBeGreaterThan(1);
    for (const size of s.sheet) expect(size).toBe("15px");
  });
}

test("labels stay 13 px at 1280 px with a fine pointer", async ({ page, hasTouch }) => {
  test.skip(hasTouch, "needs a fine pointer");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(demo());
  const s = await sizes(page);
  expect(s.label).toBe("13px");
  expect(s.summary).toBe("13px");
});
