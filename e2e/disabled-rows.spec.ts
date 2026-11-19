/**
 * Clearly dimmed disabled setting rows (M2 decision 20, user request 2026-11-19; M1 decision 14:
 * disabled, not hidden). A row whose control is disabled carries `data-disabled`: its label keeps
 * the muted token at reduced emphasis, and so do its controls. Its "Used by" note stays readable.
 */
import { expect, type Locator, type Page, test } from "@playwright/test";
import { demo, tokenColor } from "./helpers/app";

const row = (page: Page, id: string): Locator =>
  page.locator(".setting-row:visible", { has: page.locator(`#${id}`) });

/** The label's color and its effective opacity (the product of its and its ancestors'). */
async function labelLook(r: Locator): Promise<{ color: string; opacity: number }> {
  return r.locator(".setting-row__label").evaluate((el) => {
    let opacity = 1;
    for (let n: Element | null = el; n; n = n.parentElement) {
      opacity *= Number(getComputedStyle(n).opacity);
    }
    return { color: getComputedStyle(el).color, opacity };
  });
}

for (const [toggle, threshold, name] of [
  ["setting-ignore-dark", "setting-dark-threshold", "Dark threshold"],
  ["setting-ignore-light", "setting-light-threshold", "Light threshold"],
] as const) {
  test(`${name}: dimmed and disabled while its Ignore toggle is off, restored when it's on (decision 20)`, async ({
    page,
  }) => {
    await page.goto(demo("rows=filters"));
    const muted = await tokenColor(page, "--color-text-muted");
    const r = row(page, threshold);
    const range = page.getByRole("slider", { name: `${name} slider` }).locator("visible=true");
    const field = page.locator(`#${threshold}:visible`);

    await expect(page.locator(`#${toggle}:visible`)).toHaveAttribute("aria-checked", "false");
    await expect(r).toHaveAttribute("data-disabled", "");
    await expect(range).toBeDisabled();
    await expect(field).toBeDisabled();
    const off = await labelLook(r);
    expect(off.color).toBe(muted);
    expect(off.opacity).toBeLessThanOrEqual(0.6);

    await page.locator(`#${toggle}:visible`).click();
    await expect(page.locator(`#${toggle}:visible`)).toHaveAttribute("aria-checked", "true");
    await expect(r).not.toHaveAttribute("data-disabled");
    await expect(range).toBeEnabled();
    await expect(field).toBeEnabled();
    // Back to a normal row: the muted label at full emphasis, like its enabled neighbours.
    const on = await labelLook(r);
    expect(on.color).toBe(muted);
    expect(on.opacity).toBe(1);
    expect(on).toEqual(await labelLook(row(page, toggle)));
  });
}

test("every setting row with a disabled control is marked and dimmed, and only those (decision 20)", async ({
  page,
}) => {
  await page.goto(demo("rows=filters,advanced"));
  await expect(page.locator("#setting-ignore-dark:visible")).toBeVisible();
  const rows = await page.locator(".setting-row:visible").evaluateAll((els) =>
    els.map((el) => ({
      label: el.querySelector(".setting-row__label")?.textContent ?? "",
      marked: el.hasAttribute("data-disabled"),
      hasDisabled:
        el.querySelector(".setting-row__value :is(input, select, button):disabled") !== null,
      labelOpacity: Number(
        getComputedStyle(el.querySelector(".setting-row__label") as Element).opacity,
      ),
      // Effective opacity, the product of the note's and its ancestors' up to the row.
      noteOpacity: (() => {
        let opacity = 1;
        for (
          let n: Element | null = el.querySelector(".setting-row__note");
          n && n !== el.parentElement;
          n = n.parentElement
        ) {
          opacity *= Number(getComputedStyle(n).opacity);
        }
        return opacity;
      })(),
    })),
  );
  // The mockup state (Balanced) disables the thresholds and the k-means++ rows at least.
  expect(rows.filter((r) => r.marked).map((r) => r.label)).toEqual(
    expect.arrayContaining(["Dark threshold", "Light threshold", "Seed", "Restarts"]),
  );
  for (const r of rows) {
    expect(r.marked, r.label).toBe(r.hasDisabled);
    expect(r.labelOpacity < 1, r.label).toBe(r.marked);
    // The "Used by" note keeps its style and stays readable.
    expect(r.noteOpacity, r.label).toBe(1);
  }
});
