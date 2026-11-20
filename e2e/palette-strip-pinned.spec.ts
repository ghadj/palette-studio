/**
 * On desktop the swatch strip pins to the top of the palette column's own scroll container (M3
 * decision 45, user request 2026-11-20), so the palette stays visible while the editor rows scroll.
 */
import { expect, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";

const SIZES = [
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
];

const column = (page: Page) => page.locator("[data-column=palette] .column__scroll");

async function openLongContent(page: Page): Promise<void> {
  for (const name of ["Adjustments", "Ramp", "Contrast", "CVD"]) {
    const row = page
      .locator("[data-column=palette] details.chevron-row")
      .filter({ hasText: name })
      .first();
    if ((await row.count()) && (await row.getAttribute("open")) === null)
      await row.locator("summary").click();
  }
  // The Ramp pill opens the ramp panel when it isn't a row.
  const ramp = page.locator("[data-column=palette]").getByRole("button", { name: /^Ramp/ });
  if (await ramp.count()) await ramp.first().click();
}

for (const size of SIZES) {
  test.describe(`${size.width} x ${size.height}`, () => {
    test.beforeEach(async ({ page }, info) => {
      test.skip(isPhoneProject(info), "desktop layout only");
      await page.setViewportSize(size);
      await page.goto(demo());
      await expect(column(page)).toBeVisible();
    });

    test("the strip pins at the top of column 2 when it scrolls", async ({ page }) => {
      const before = await page.evaluate(() => {
        const dock = document.querySelector("[data-column=palette] [data-testid=strip-dock]");
        return dock ? dock.getBoundingClientRect().top : null;
      });
      expect(before, "strip dock in column 2").not.toBeNull();
      await openLongContent(page);
      const overflow = await column(page).evaluate((el) => el.scrollHeight - el.clientHeight);
      expect(overflow, "column 2 can scroll").toBeGreaterThan(100);
      await column(page).evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await page.evaluate(
        () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
      );
      const result = await page.evaluate(() => {
        const scroller = document.querySelector("[data-column=palette] .column__scroll");
        const dock = document.querySelector("[data-column=palette] [data-testid=strip-dock]");
        if (!scroller || !dock) throw new Error("missing");
        const s = scroller.getBoundingClientRect();
        const d = dock.getBoundingClientRect();
        const swatches = [...dock.querySelectorAll("[data-swatch]")].map((el) => {
          const r = el.getBoundingClientRect();
          return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el;
        });
        return {
          delta: d.top - s.top,
          swatches,
          stuck: dock.hasAttribute("data-stuck"),
          bg: getComputedStyle(dock).backgroundColor,
          surface: getComputedStyle(document.documentElement)
            .getPropertyValue("--color-surface")
            .trim(),
        };
      });
      expect(Math.abs(result.delta), `delta ${result.delta}`).toBeLessThanOrEqual(1);
      expect(result.swatches.length).toBeGreaterThan(0);
      expect(result.swatches.every(Boolean), "every swatch hit-testable").toBe(true);
      expect(result.stuck, `divider while pinned ${result.delta}`).toBe(true);
      expect(result.bg).not.toBe("rgba(0, 0, 0, 0)");
    });

    test("tabbing through column 2 never lands under the pinned strip", async ({ page }) => {
      await openLongContent(page);
      await column(page).evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      // WebKit doesn't Tab to buttons by default, so focus each control in order instead, down the
      // column and back up, and check where the browser leaves it.
      const SEL =
        "[data-column=palette] :is(button, input, summary, [tabindex='0'], a[href]):not([disabled])";
      const count = await page.evaluate(
        (sel) =>
          [...document.querySelectorAll<HTMLElement>(sel)].filter(
            (el) => el.getClientRects().length,
          ).length,
        SEL,
      );
      expect(count).toBeGreaterThan(10);
      const seen = new Set<string>();
      for (const order of ["down", "up"]) {
        for (let n = 0; n < count; n++) {
          const index = order === "down" ? n : count - 1 - n;
          const info = await page.evaluate(
            ([sel, i]) => {
              const all = [...document.querySelectorAll<HTMLElement>(sel as string)].filter(
                (el) => el.getClientRects().length > 0,
              );
              const el = all[i as number];
              const dock = document.querySelector("[data-column=palette] [data-testid=strip-dock]");
              if (!el || !dock) throw new Error("missing");
              el.focus();
              return new Promise<{ id: string; hit: boolean }>((done) =>
                requestAnimationFrame(() =>
                  requestAnimationFrame(() => {
                    const id = `${el.tagName}|${el.getAttribute("aria-label") ?? ""}|${(el.textContent ?? "").trim().slice(0, 20)}`;
                    if (dock.contains(el)) return done({ id, hit: false });
                    const f = el.getBoundingClientRect();
                    const o = dock.getBoundingClientRect();
                    const hit =
                      f.left < o.right && f.right > o.left && f.top < o.bottom && f.bottom > o.top;
                    done({ id, hit });
                  }),
                ),
              );
            },
            [SEL, index] as const,
          );
          expect(info.hit, `focus ${info.id} under the strip`).toBe(false);
          seen.add(`${info.id}${n}`);
        }
      }
      expect(seen.size).toBeGreaterThan(10);
    });

    test("unscrolled, the strip sits where it did and has no divider", async ({ page }) => {
      const r = await page.evaluate(() => {
        const dock = document.querySelector("[data-column=palette] [data-testid=strip-dock]");
        const label = document.querySelector("[data-column=palette] h2");
        if (!dock || !label) throw new Error("missing");
        return {
          stuck: dock.hasAttribute("data-stuck"),
          gap: dock.getBoundingClientRect().top - label.getBoundingClientRect().bottom,
        };
      });
      expect(r.stuck).toBe(false);
      expect(r.gap).toBeGreaterThanOrEqual(0);
    });
  });
}
