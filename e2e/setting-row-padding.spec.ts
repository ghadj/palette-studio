/**
 * Setting-row padding on phone and tablet (M2 fix F4, decision 21, user request 2026-11-19): below
 * 1024 px a row is taller than its tallest control by twice --space-2, with space above and below.
 */
import { expect, test } from "@playwright/test";
import { demo, tokenPx } from "./helpers/app";
import { measure, openRows } from "./helpers/rows";
import { sheetSettled } from "./helpers/sheet";

for (const width of [320, 820] as const) {
  test(`rows have vertical padding around their controls at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(demo("rows=filters,advanced"));
    await openRows(page);
    const pad = await tokenPx(page, "--space-2");
    const rows = await measure(page);
    for (const r of rows) {
      if (!r.tallest) continue;
      expect(r.row.height, `${r.name}: row height`).toBeGreaterThanOrEqual(
        r.tallest.height + 2 * pad - 0.5,
      );
      expect(r.tallest.top - r.row.top, `${r.name}: space above`).toBeGreaterThanOrEqual(pad - 0.5);
      expect(r.row.bottom - r.tallest.bottom, `${r.name}: space below`).toBeGreaterThanOrEqual(
        pad - 0.5,
      );
    }
  });

  test(`chevron rows get the same padding at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(demo("rows=filters,advanced"));
    const pad = await tokenPx(page, "--space-2");
    const touch = await tokenPx(page, "--touch-target");
    const heights = await page
      .locator(".chevron-row__summary:visible")
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    expect(heights.length).toBe(2);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(touch + 2 * pad - 0.5);
  });
}

// M3-T2: the Palette tab's chevron rows and the rows in its bottom sheets follow the same rule.
for (const width of [320, 820] as const) {
  test(`Palette-tab chevron rows and the Swatch sheet's rows are padded at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(demo("tab=palette"));
    const pad = await tokenPx(page, "--space-2");
    const touch = await tokenPx(page, "--touch-target");
    const heights = await page
      .locator("[data-testid=palette-rows] .chevron-row__summary:visible")
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    expect(heights.length).toBe(4);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(touch + 2 * pad - 0.5);
    await page.getByTestId("palette-rows").getByRole("button", { name: "Swatch" }).click();
    await sheetSettled(page);
    const rows = await measure(page);
    // The swatch fields are setting rows too, so they get the same padding.
    expect(rows.map((r) => r.name)).toEqual(expect.arrayContaining(["Cluster map", "HEX", "Name"]));
    // Rows that stay on one line are vertically centered (user request, M2 F4).
    for (const r of rows) {
      if (!r.value || r.value.top >= r.group.bottom - 0.5) continue;
      const mid = (b: DOMRect) => b.top + b.height / 2;
      expect(Math.abs(mid(r.row) - mid(r.value)), `${r.name}: centered`).toBeLessThanOrEqual(1.5);
    }
    for (const r of rows) {
      if (!r.tallest) continue;
      expect(r.tallest.top - r.row.top, `${r.name}: space above`).toBeGreaterThanOrEqual(pad - 0.5);
      expect(r.row.bottom - r.tallest.bottom, `${r.name}: space below`).toBeGreaterThanOrEqual(
        pad - 0.5,
      );
    }
  });
}

for (const width of [320, 390, 820, 1280] as const) {
  for (const algorithm of ["balanced", "exact"] as const) {
    test(`Population vs. vividness is vertically centered (${algorithm}) at ${width} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(demo("rows=advanced"));
      await page.locator("#setting-algorithm:visible").selectOption(algorithm);
      const r = (await measure(page)).find((b) => b.name.startsWith("Population vs. vividness"));
      if (!r?.value) throw new Error("no vividness row");
      if (r.value.top >= r.group.bottom - 0.5) return; // wrapped onto two lines: nothing to center
      const mid = (b: DOMRect) => b.top + b.height / 2;
      expect(Math.abs(mid(r.group) - mid(r.value))).toBeLessThanOrEqual(1);
    });
  }
}
