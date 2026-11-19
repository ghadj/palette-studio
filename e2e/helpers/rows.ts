import type { Page } from "@playwright/test";

export interface RowBoxes {
  name: string;
  row: DOMRect;
  group: DOMRect;
  value: DOMRect | null;
  tallest: DOMRect | null;
}

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
