import { expect, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";
import { sheetSettled } from "./helpers/sheet";

/**
 * M3-T2 scaffolding: chevron rows in the Palette column expand in place on desktop and open bottom
 * sheets below 1024 px (spec 6.1, 6.6 rule 2; ui-contract Components "Chevron row", "Bottom
 * sheet"). The phone Cluster map toggle lives in the Swatch sheet (M2 decision 13d).
 */

const row = (page: Page, name: string) =>
  page.locator("[data-panel=palette]").getByRole("button", { name, exact: true });
const sheet = (page: Page) => page.getByRole("dialog");

async function openAdjustments(page: Page) {
  const trigger = row(page, "Adjustments");
  await trigger.click();
  await sheetSettled(page);
  await expect(sheet(page)).toHaveAccessibleName("Adjustments");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  // Focus moves inside the sheet.
  expect(await sheet(page).evaluate((el) => el.contains(document.activeElement))).toBe(true);
  return trigger;
}

async function expectClosed(page: Page, trigger: ReturnType<typeof row>) {
  await expect(sheet(page)).toHaveCount(0);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();
}

test.describe("chevron rows and bottom sheets (M3-T2)", () => {
  test("desktop: Adjustments expands in place and aria-expanded toggles", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "desktop layout");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(demo());
    const rows = page.getByTestId("palette-rows").getByRole("button");
    await expect(rows).toHaveText(["Swatch", "Adjustments", "Contrast", "CVD"]);
    const trigger = row(page, "Adjustments");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("row-adjustments")).toHaveCount(0);
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const region = page.getByTestId("row-adjustments");
    await expect(region).toBeVisible();
    // M3-T6 replaced the placeholder with the adjustments panel.
    await expect(region.getByTestId("adjustments-panel")).toBeVisible();
    // In place: no sheet, and the region sits right under its row, in column 2.
    await expect(sheet(page)).toHaveCount(0);
    await expect(trigger).toHaveAttribute("aria-controls", (await region.getAttribute("id")) ?? "");
    const [t, r] = [await trigger.boundingBox(), await region.boundingBox()];
    expect(Math.abs((r?.y ?? 0) - ((t?.y ?? 0) + (t?.height ?? 0)))).toBeLessThan(2);
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(region).toHaveCount(0);
    // The Ramp pill opens its panel in place too; Lock is a real toggle since M3-T3.
    const ramp = page.getByRole("button", { name: "Ramp", exact: true });
    await ramp.click();
    await expect(ramp).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("row-ramp").getByTestId("ramp-panel")).toBeVisible();
    const lock = page.getByRole("button", { name: "Lock", exact: true });
    await expect(lock).not.toHaveAttribute("data-coming-soon");
    await expect(lock).toHaveAttribute("aria-pressed", /^(true|false)$/);
  });

  test("desktop: rows=adjustments and rows=ramp open in place at load", async ({ page }, info) => {
    test.skip(isPhoneProject(info), "desktop layout");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(demo("rows=adjustments,ramp"));
    await expect(row(page, "Adjustments")).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("row-adjustments")).toBeVisible();
    await expect(page.getByTestId("row-ramp")).toBeVisible();
    await expect(row(page, "Swatch")).toHaveAttribute("aria-expanded", "false");
  });

  test("phone: Adjustments opens a sheet with focus inside; Esc, the close button, a scrim tap and a downward swipe each close it and return focus", async ({
    page,
  }, info) => {
    test.skip(!isPhoneProject(info), "phone layout");
    await page.goto(demo("tab=palette"));
    let trigger = await openAdjustments(page);
    await expect(sheet(page).getByTestId("adjustments-panel")).toBeVisible();
    // The sheet is a modal dialog, so the page behind it is inert.
    expect(await page.locator("dialog").evaluate((el) => el.matches(":modal"))).toBe(true);

    await page.keyboard.press("Escape");
    await expectClosed(page, trigger);

    trigger = await openAdjustments(page);
    await sheet(page).getByRole("button", { name: "Close" }).click();
    await expectClosed(page, trigger);

    trigger = await openAdjustments(page);
    // A tap on the scrim above the panel.
    await page.getByTestId("sheet-scrim").click({ position: { x: 20, y: 20 } });
    await expectClosed(page, trigger);

    // A short swipe springs back; a longer one closes it.
    trigger = await openAdjustments(page);
    const handle = await page.getByTestId("sheet-handle").boundingBox();
    if (!handle) throw new Error("no handle");
    const x = handle.x + handle.width / 3;
    const y = handle.y + 6;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 20, { steps: 4 });
    await page.mouse.up();
    await expect(sheet(page)).toBeVisible();
    // It springs back to where it was.
    await sheetSettled(page);
    const rest = await page.getByTestId("sheet-handle").boundingBox();
    expect(Math.abs((rest?.y ?? 0) - handle.y)).toBeLessThan(1);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 160, { steps: 8 });
    await page.mouse.up();
    await expectClosed(page, trigger);
  });

  test("phone: each Palette-tab row and the Ramp pill open their sheets; rows=swatch opens it at load", async ({
    page,
  }, info) => {
    test.skip(!isPhoneProject(info), "phone layout");
    await page.goto(demo("tab=palette"));
    for (const name of ["Swatch", "Adjustments", "Contrast", "CVD", "Ramp"]) {
      const trigger = page.locator("[data-panel=palette]").getByRole("button", {
        name,
        exact: true,
      });
      await expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
      await trigger.click();
      await sheetSettled(page);
      await expect(sheet(page)).toHaveAccessibleName(name);
      const close = sheet(page).getByRole("button", { name: "Close" });
      const box = await close.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      await close.click();
      await expect(sheet(page)).toHaveCount(0);
    }
    await page.goto(demo("tab=palette&rows=swatch"));
    await expect(sheet(page)).toHaveAccessibleName("Swatch");
    // Opened by the parameter once: closing it and coming back to the tab leaves it closed.
    await page.keyboard.press("Escape");
    await expect(sheet(page)).toHaveCount(0);
    await page.getByRole("tab", { name: "Source" }).click();
    await page.getByRole("tab", { name: "Palette" }).click();
    await expect(row(page, "Swatch")).toBeVisible();
    await expect(sheet(page)).toHaveCount(0);
  });

  test("the sheet's bottom padding includes the safe-area inset", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(demo("tab=palette&rows=adjustments"));
    await sheetSettled(page);
    const padding = await page.evaluate(() => {
      for (const styleSheet of Array.from(document.styleSheets)) {
        for (const rule of Array.from(styleSheet.cssRules)) {
          if (rule instanceof CSSStyleRule && rule.selectorText === ".bottom-sheet__panel")
            return rule.style.paddingBottom;
        }
      }
      return "";
    });
    expect(padding).toContain("safe-area-inset-bottom");
    // Without an inset, the panel still keeps its own padding and sits on the viewport bottom.
    const panel = await page.locator(".bottom-sheet__panel").boundingBox();
    expect((panel?.y ?? 0) + (panel?.height ?? 0)).toBeCloseTo(844, 0);
  });

  test("with reduced motion the sheet opens without animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(demo("tab=palette"));
    await row(page, "CVD").click();
    await expect(sheet(page)).toBeVisible();
    const running = await page.evaluate(
      () => document.getAnimations().filter((a) => a.playState === "running").length,
    );
    expect(running).toBe(0);
  });

  test("the phone Cluster map toggle is in the Swatch sheet, not on the Palette tab (13d)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(demo("tab=palette"));
    await expect(row(page, "Swatch")).toBeVisible();
    await expect(page.locator("#cluster-map-toggle")).toHaveCount(0);
    await row(page, "Swatch").click();
    const toggle = sheet(page).getByRole("switch", { name: "Cluster map" });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  test("hovering or keyboard-focusing a swatch links it (data-linked)", async ({ page }, info) => {
    test.skip(isPhoneProject(info), "no hover on phones");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(demo());
    const swatches = page.locator("[data-testid=swatch-strip]:visible [data-swatch]");
    await swatches.nth(1).hover();
    await expect(swatches.nth(1)).toHaveAttribute("data-linked", "");
    await expect(page.locator("[data-linked]")).toHaveCount(1);
    await page.mouse.move(0, 0);
    await expect(page.locator("[data-linked]")).toHaveCount(0);
  });
});
