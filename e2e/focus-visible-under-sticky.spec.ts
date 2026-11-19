/**
 * Keyboard focus never hides under the sticky header, the pinned swatch strip or the fixed tab bar
 * (spec 8 v1 acceptance 10; WCAG 2.2 SC 2.4.11; M2 re-evaluation failure 2).
 */
import { expect, type Page, test } from "@playwright/test";
import { demo } from "./helpers/app";

const SIZES = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
];

/** Returns a description of the focused element if its box meets a sticky surface, else null. */
async function obscured(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const f = el.getBoundingClientRect();
    const name = `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}"`;
    const covers = [
      ["header", document.querySelector("header")],
      ["strip-dock", document.querySelector("[data-testid=strip-dock]")],
      ["tab bar", document.querySelector(".tabbar")],
    ] as const;
    for (const [label, other] of covers) {
      if (!other || other.contains(el)) continue;
      const o = other.getBoundingClientRect();
      if (o.width === 0 || o.height === 0) continue;
      const hit = f.left < o.right && f.right > o.left && f.top < o.bottom && f.bottom > o.top;
      if (hit)
        return `${name} at y ${f.top.toFixed(0)}-${f.bottom.toFixed(0)} meets ${label} (${o.top.toFixed(0)}-${o.bottom.toFixed(0)})`;
    }
    return null;
  });
}

async function walk(page: Page, key: "Tab" | "Shift+Tab"): Promise<string[]> {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    await page.keyboard.press(key);
    // The focus handler nudges the scroll two frames after focus lands.
    await page.evaluate(
      () =>
        new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done))),
        ),
    );
    const id = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return "body";
      // Wait for smooth scrolling to settle before measuring is unnecessary: scroll is instant.
      return `${el.tagName}|${el.getAttribute("aria-label") ?? ""}|${(el.textContent ?? "").trim().slice(0, 30)}|${Math.round(el.getBoundingClientRect().left)}|${Math.round(el.getBoundingClientRect().top + window.scrollY)}`;
    });
    if (id === "body" || seen.has(id)) break;
    seen.add(id);
    const bad = await obscured(page);
    if (bad) problems.push(`${key}: ${bad}`);
  }
  return problems;
}

test.describe("focus is never hidden under sticky chrome (spec 8 v1 acceptance 10)", () => {
  for (const size of SIZES) {
    test(`${size.width} × ${size.height}: Tab forward and Shift+Tab back`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(demo("rows=filters,advanced"));
      await expect(page.locator("[data-testid=swatch-strip]:visible").first()).toBeVisible();
      await expect(page.locator(".tabbar")).toBeVisible();
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      const forward = await walk(page, "Tab");
      // Focus is on the last stop; walk back from there.
      const backward = await walk(page, "Shift+Tab");
      expect([...forward, ...backward]).toEqual([]);
    });
  }
});
