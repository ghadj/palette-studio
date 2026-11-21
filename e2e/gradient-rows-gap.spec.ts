import { expect, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";

/**
 * The Gradient column's rows sit one under another with a single divider between them: no gap and
 * no doubled line where the setting rows end and the chevron rows begin (user report, M4-T14).
 */
test("consecutive rows in the Gradient column have no gap and exactly one divider", async ({
  page,
}, info) => {
  if (isPhoneProject(info)) await page.goto(demo("tab=gradient&technique=palette-order"));
  else {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(demo("technique=palette-order"));
  }
  await expect(page.getByTestId("gradient-chevron-rows")).toBeVisible();
  const pairs = await page.evaluate(() => {
    const panel = document.querySelector("[data-panel=gradient]");
    if (!panel) throw new Error("no gradient panel");
    const rows = [...panel.querySelectorAll<HTMLElement>(".setting-row, .chevron-row__summary")];
    const px = (v: string) => Number.parseFloat(v) || 0;
    // The lines between two rows: a's bottom border, b's top border, and the borders of any
    // wrapper that ends with a or starts with b.
    const between = (a: HTMLElement, b: HTMLElement) => {
      let lines =
        px(getComputedStyle(a).borderBottomWidth) + px(getComputedStyle(b).borderTopWidth);
      for (let el = a.parentElement; el && !el.contains(b); el = el.parentElement) {
        lines += px(getComputedStyle(el).borderBottomWidth);
      }
      for (let el = b.parentElement; el && !el.contains(a); el = el.parentElement) {
        lines += px(getComputedStyle(el).borderTopWidth);
      }
      return lines;
    };
    return rows.slice(1).map((b, i) => {
      const a = rows[i] as HTMLElement;
      return {
        a: a.textContent?.trim().slice(0, 24) ?? "",
        b: b.textContent?.trim().slice(0, 24) ?? "",
        gap: b.getBoundingClientRect().top - a.getBoundingClientRect().bottom,
        lines: between(a, b),
        stroke: px(getComputedStyle(document.documentElement).getPropertyValue("--stroke")) || 1,
      };
    });
  });
  expect(pairs.length).toBeGreaterThanOrEqual(5);
  for (const p of pairs) {
    expect(Math.abs(p.gap), `gap between "${p.a}" and "${p.b}"`).toBeLessThanOrEqual(0.5);
    expect(p.lines, `dividers between "${p.a}" and "${p.b}"`).toBe(1);
  }
});
