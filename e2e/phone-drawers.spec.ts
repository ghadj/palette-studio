/**
 * M3 decisions 32 to 35 (user request 2026-11-20), below 1024 px:
 * 32. the Source tab's strip shows only swatches; "+" and the close-pair mark are on the Palette tab
 * 33. the Palette tab's strip is pinned under the header like the Source tab's
 * 34. the Source tab's Filters and Advanced rows open as bottom-sheet drawers
 * 35. an open drawer stops below the pinned strip, so the palette stays visible above it
 * 59. with a space-2 gap between the strip and the drawer; the scrim covers the gap
 */
import { expect, type Page, test } from "@playwright/test";
import { demo, hasHorizontalScroll, isPhoneProject } from "./helpers/app";
import { sheetSettled } from "./helpers/sheet";

const strip = (page: Page) => page.locator("[data-testid=swatch-strip]:visible").first();
const dock = (page: Page) => page.getByTestId("strip-dock");
const sheet = (page: Page) => page.getByRole("dialog");

async function expectBelowDock(page: Page, label: string) {
  await sheetSettled(page);
  const d = await dock(page).boundingBox();
  const panel = await sheet(page).locator(".bottom-sheet__panel").boundingBox();
  const scrim = await sheet(page).getByTestId("sheet-scrim").boundingBox();
  const viewport = page.viewportSize();
  if (!d || !panel || !scrim || !viewport) throw new Error("no boxes");
  // Decision 59: the drawer starts one space-2 (8 px) below the dock's bottom border, and the
  // scrim, which starts at the dock's bottom, covers the gap.
  const gap = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.height = "var(--space-2)";
    document.body.append(probe);
    const h = probe.getBoundingClientRect().height;
    probe.remove();
    return h;
  });
  expect(gap).toBeGreaterThan(0);
  expect(panel.y, `${label}: sheet top a gap below the strip`).toBeGreaterThanOrEqual(
    d.y + d.height + gap - 1,
  );
  expect(
    Math.abs(scrim.y - (d.y + d.height)),
    `${label}: the scrim starts at the strip`,
  ).toBeLessThanOrEqual(1);
  expect(scrim.y, `${label}: the scrim covers the gap`).toBeLessThan(panel.y - gap + 1);
  expect(panel.y + panel.height, `${label}: sheet inside the viewport`).toBeLessThanOrEqual(
    viewport.height + 0.5,
  );
  // Every swatch stays visible and uncovered above the sheet.
  const swatches = await strip(page)
    .locator("[data-swatch]")
    .evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          bottom: r.bottom,
          // The strip is inert under a modal sheet, so the point may hit the page; it must not
          // hit the sheet or its scrim.
          hit:
            document
              .elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
              ?.closest(".bottom-sheet__panel, .bottom-sheet__scrim") === null,
        };
      }),
    );
  expect(swatches.length).toBeGreaterThan(0);
  for (const s of swatches) {
    expect(s.hit, `${label}: swatch not under the sheet or its scrim`).toBe(true);
    expect(s.bottom).toBeLessThanOrEqual(panel.y + 0.5);
  }
  expect(await hasHorizontalScroll(page), `${label}: horizontal scroll`).toBe(false);
}

test.describe("phone Source tab: swatches only (decision 32)", () => {
  test("no add tile and no close-pair mark below 1024 px; both are on the Palette tab", async ({
    page,
  }, info) => {
    test.skip(!isPhoneProject(info), "phone projects");
    await page.goto(demo("tab=source"));
    await expect(strip(page).locator("[data-swatch]")).toHaveCount(6);
    await expect(page.getByTestId("add-swatch")).toHaveCount(0);
    await expect(page.getByTestId("close-legend")).toHaveCount(0);
    await page.goto(demo("tab=palette"));
    await expect(page.getByTestId("add-swatch")).toBeVisible();
  });

  test("the Values view keeps its Close in value legend and dots on the Source tab", async ({
    page,
  }, info) => {
    test.skip(!isPhoneProject(info), "phone projects");
    await page.goto(demo("tab=source&image=values"));
    await expect(page.getByTestId("add-swatch")).toHaveCount(0);
    await expect(page.getByTestId("strip-dock")).toBeVisible();
    // Decision 51: the legend sits inside the dock with the strip, and swatches 1 and 2 have dots.
    await expect(page.getByTestId("strip-dock").getByTestId("close-legend")).toHaveText(
      "Close in value",
    );
    await expect(page.getByTestId("close-flag")).toHaveCount(2);
  });

  test("desktop: the Palette column keeps the add tile", async ({ page }, info) => {
    test.skip(isPhoneProject(info), "desktop layout");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(demo());
    await expect(page.getByTestId("add-swatch")).toBeVisible();
  });
});

test.describe("phone Palette tab: sticky strip (decision 33)", () => {
  test("the strip pins under the header while the page scrolls, in the dock", async ({
    page,
  }, info) => {
    test.skip(!isPhoneProject(info), "phone projects");
    await page.setViewportSize({ width: 320, height: 480 });
    await page.goto(demo("tab=palette"));
    await expect(dock(page)).toBeVisible();
    expect(await dock(page).evaluate((el) => getComputedStyle(el).position)).toBe("sticky");
    // Make the page scroll, then check the strip stays right under the header.
    await page.evaluate(() => {
      const spacer = document.createElement("div");
      spacer.style.height = "1200px";
      document.querySelector("[data-panel=palette]")?.append(spacer);
    });
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForFunction(() => window.scrollY >= 600);
    const header = await page.locator("header").first().boundingBox();
    const bar = await strip(page).boundingBox();
    if (!header || !bar) throw new Error("no header or strip");
    expect(bar.y).toBeGreaterThanOrEqual(header.y + header.height - 0.5);
    expect(bar.y).toBeLessThanOrEqual(header.y + header.height + 16);
    await expect(dock(page)).toHaveAttribute("data-stuck", "");
  });
});

test.describe("phone drawers (decisions 34, 35)", () => {
  for (const row of ["Filters", "Advanced"] as const) {
    test(`Source tab: ${row} opens a bottom sheet under the strip, and closes with focus back`, async ({
      page,
    }, info) => {
      test.skip(!isPhoneProject(info), "phone projects");
      await page.goto(demo("tab=source"));
      const trigger = page.getByRole("button", { name: row, exact: true });
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await trigger.click();
      await expect(sheet(page)).toHaveAccessibleName(row);
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expectBelowDock(page, `Source ${row}`);
      await page.keyboard.press("Escape");
      await expect(sheet(page)).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });
  }

  test("Source tab: the always-visible rows stay inline", async ({ page }, info) => {
    test.skip(!isPhoneProject(info), "phone projects");
    await page.goto(demo("tab=source"));
    for (const id of ["preset", "algorithm", "colors", "space"]) {
      await expect(page.locator(`#setting-${id}`).first()).toBeVisible();
    }
  });

  test("Palette tab: a drawer stops below the pinned strip", async ({ page }, info) => {
    test.skip(!isPhoneProject(info), "phone projects");
    await page.goto(demo("tab=palette"));
    await page.getByRole("button", { name: "Adjustments", exact: true }).click();
    await expectBelowDock(page, "Palette Adjustments");
  });

  test("the six swatches stay shown while a drawer is open", async ({ page }, info) => {
    test.skip(!isPhoneProject(info), "phone projects");
    await page.goto(demo("tab=source"));
    const count = () => strip(page).locator("[data-swatch]").count();
    expect(await count()).toBe(6);
    await page.getByRole("button", { name: "Advanced", exact: true }).click();
    await sheetSettled(page);
    await expectBelowDock(page, "before");
    // The Colors row is inline and behind the modal; the sheet itself still keeps the strip shown.
    await expect(strip(page)).toBeVisible();
  });

  test("320 px: a drawer opened from a scrolled page keeps the strip visible", async ({
    page,
  }, info) => {
    test.skip(!isPhoneProject(info), "phone projects");
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(demo("tab=source"));
    await page.evaluate(() => window.scrollTo(0, 120));
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await expectBelowDock(page, "320 Filters");
    // A tall drawer starts exactly one space-2 below the strip's bottom border (decision 59).
    const d = await dock(page).boundingBox();
    const panel = await sheet(page).locator(".bottom-sheet__panel").boundingBox();
    if (!d || !panel) throw new Error("no boxes");
    expect(Math.abs(panel.y - (d.y + d.height + 8))).toBeLessThanOrEqual(1);
  });
});
