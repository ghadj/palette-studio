import { expect, type Page } from "@playwright/test";
import { sheetSettled } from "./sheet";

export interface RowBoxes {
  name: string;
  row: DOMRect;
  group: DOMRect;
  value: DOMRect | null;
  tallest: DOMRect | null;
}

/**
 * Opens the Source tab's Filters and Advanced rows in place. Only for the desktop layout: below
 * 1024 px they are bottom sheets (M3 decision 34), and only one is open at a time, so use
 * `inRowScopes`.
 */
export async function openRows(page: Page): Promise<void> {
  for (const id of ["filters-row", "advanced"]) {
    const d = page
      .locator(
        id === "filters-row" ? "[data-testid=filters-row]:visible" : "details.chevron-row:visible",
      )
      .filter({ hasText: id === "filters-row" ? "Filters" : "Advanced" })
      .first();
    if ((await d.getAttribute("open")) === null) await d.locator("summary").click();
  }
}

export const measure = (page: Page): Promise<RowBoxes[]> =>
  page.evaluate(() => {
    const union = (el: Element): DOMRect => {
      let { left, top, right, bottom } = el.getBoundingClientRect();
      for (const d of el.querySelectorAll("*")) {
        const r = d.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        left = Math.min(left, r.left);
        top = Math.min(top, r.top);
        right = Math.max(right, r.right);
        bottom = Math.max(bottom, r.bottom);
      }
      return new DOMRect(left, top, right - left, bottom - top);
    };
    const visible = (el: Element) => (el as HTMLElement).getClientRects().length > 0;
    return [...document.querySelectorAll(".setting-row")].filter(visible).map((row) => {
      const label = row.querySelector(".setting-row__label-group, .setting-row__label");
      const value = row.querySelector(".setting-row__value");
      const controls = [...row.querySelectorAll("input, select, button, [role=switch]")].filter(
        visible,
      );
      const tallest = controls.sort(
        (a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height,
      )[0];
      return {
        name: label?.textContent?.trim() ?? "",
        row: row.getBoundingClientRect(),
        group: (label as Element).getBoundingClientRect(),
        // The value box can shrink below its content, so use the union of its descendants too.
        value: value ? union(value) : null,
        tallest: tallest ? tallest.getBoundingClientRect() : null,
      };
    });
  });

/** True in the sheet layout, below 1024 px. */
export const isSheetLayout = async (page: Page): Promise<boolean> =>
  (await page.locator(".app--phone").count()) > 0;

/**
 * Runs `fn` where the Source tab's collapsed rows are open. From 1024 px both rows open in place
 * and `fn` runs once with "all". Below that each row is a bottom sheet (M3 decision 34): `fn` runs
 * once per sheet, with "Filters" and then "Advanced", and the sheet is closed after.
 */
export async function inRowScopes(
  page: Page,
  fn: (scope: "all" | "Filters" | "Advanced") => Promise<void>,
): Promise<void> {
  if (!(await isSheetLayout(page))) {
    await openRows(page);
    await fn("all");
    return;
  }
  for (const name of ["Filters", "Advanced"] as const) {
    await page.getByRole("button", { name, exact: true }).click();
    await sheetSettled(page);
    await fn(name);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
}

/**
 * Opens the Source tab's "Filters" or "Advanced" row: it expands in place from 1024 px and opens a
 * bottom sheet below that (M3 decision 34). Resolves once the content can be used.
 */
export async function openRow(page: Page, name: "Filters" | "Advanced"): Promise<void> {
  if (await isSheetLayout(page)) {
    await page.getByRole("button", { name, exact: true }).click();
    await sheetSettled(page);
    return;
  }
  const row =
    name === "Filters"
      ? page.locator("[data-testid=filters-row]:visible")
      : page.locator("details.chevron-row:visible").filter({ hasText: "Advanced" });
  if ((await row.first().getAttribute("open")) === null)
    await row.first().locator("summary").click();
}

/** The open Filters or Advanced row's box: the details element, or the sheet's row below 1024 px. */
export const rowBox = (page: Page, name: "Filters" | "Advanced") =>
  name === "Filters"
    ? page.locator("[data-testid=filters-row]:visible")
    : page.locator("details.chevron-row:visible, [data-row=advanced]:visible").filter({
        hasText: "Advanced",
      });
