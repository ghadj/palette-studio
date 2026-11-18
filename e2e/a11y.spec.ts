import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { grayscalePlusRed } from "./helpers/grayscale-plus-red";
import { M1_SCREENS, THEMES } from "./helpers/screens";

/** Axe judges contrast on what is painted, so let fades (such as the toast's) finish first. */
const settled = (page: Page) =>
  page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));

// axe-core checks each panel in light and dark themes, desktop and phone (spec 8).
test.describe("accessibility @a11y", () => {
  for (const screen of M1_SCREENS) {
    for (const theme of THEMES) {
      test(`no axe violations in each panel, light and dark, desktop and phone: ${screen.name} ${theme}`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: theme });
        await page.setViewportSize(screen.viewport);
        await page.goto(screen.path);
        await expect(page.locator("#app-root")).toBeVisible();
        await page.waitForLoadState("networkidle");
        await settled(page);
        const results = await new AxeBuilder({ page }).analyze();
        const summary = results.violations.map(
          (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`,
        );
        expect(summary).toEqual([]);
      });
    }
  }

  test("no axe violations with the Replace image menu open", async ({ page }) => {
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto("./?demo=mockup");
      await page.locator("header").getByRole("button", { name: "Replace image" }).click();
      await settled(page);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.map((v) => `${theme} ${v.id}: ${v.help}`)).toEqual([]);
    }
  });

  test("no axe violations with the copy-failure toast showing", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    });
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("./?demo=mockup");
      await page.getByRole("button", { name: "Copy HEX" }).click();
      await expect(page.getByRole("button", { name: "Dismiss" })).toBeVisible();
      await settled(page);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.map((v) => `${theme} ${v.id}: ${v.help}`)).toEqual([]);
    }
  });

  test("no axe violations with Median cut and Seed disabled", async ({ page }) => {
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto("./");
      await page.locator("#setting-algorithm:visible").selectOption({ label: "Median cut" });
      await page.locator('details.chevron-row:visible summary:has-text("Advanced")').click();
      await expect(page.locator("#setting-seed:visible")).toBeDisabled();
      await settled(page);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.map((v) => `${theme} ${v.id}: ${v.help}`)).toEqual([]);
    }
  });

  test("no axe violations with Swatch roles: Colors disabled and the empty-roles note", async ({
    page,
  }) => {
    for (const theme of THEMES) {
      for (const viewport of [
        { width: 1280, height: 800 },
        { width: 390, height: 844 },
      ]) {
        await page.emulateMedia({ colorScheme: theme });
        await page.setViewportSize(viewport);
        await page.goto("./");
        await page.getByTestId("file-input").setInputFiles(grayscalePlusRed());
        await page.locator("#setting-algorithm:visible").selectOption({ label: "Swatch roles" });
        await expect(page.locator("#setting-colors:visible")).toBeDisabled();
        await expect(page.locator("[data-testid=empty-roles]:visible")).toBeVisible();
        await expect(page.locator("[data-testid=swatch-strip][data-busy]")).toHaveCount(0);
        await settled(page);
        const results = await new AxeBuilder({ page }).analyze();
        expect(
          results.violations.map((v) => `${theme} ${viewport.width} ${v.id}: ${v.help}`),
        ).toEqual([]);
      }
    }
  });

  test("no axe violations with the Advanced settings open", async ({ page }) => {
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto("./");
      await page.locator('details.chevron-row:visible summary:has-text("Advanced")').click();
      // The M2-T7 rows, with the Keep one outlier toggle off, then on.
      const toggle = page.locator("#setting-outlier:visible");
      for (const state of ["false", "true"]) {
        if ((await toggle.getAttribute("aria-checked")) !== state) await toggle.click();
        await expect(toggle).toHaveAttribute("aria-checked", state);
        await settled(page);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations.map((v) => `${theme} ${state} ${v.id}: ${v.help}`)).toEqual([]);
      }
    }
  });

  test("no axe violations with the Advanced rows disabled under Swatch roles, at phone width", async ({
    page,
  }) => {
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto("./");
      await page.locator("#setting-algorithm:visible").selectOption({ label: "Swatch roles" });
      await page.locator('details.chevron-row:visible summary:has-text("Advanced")').click();
      await expect(page.locator("#setting-restarts:visible")).toBeDisabled();
      await expect(page.locator("#setting-outlier:visible")).toBeDisabled();
      await settled(page);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.map((v) => `${theme} ${v.id}: ${v.help}`)).toEqual([]);
    }
  });

  test("no axe violations with the theme menu open and a toast showing", async ({ page }) => {
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto("./?demo=mockup");
      await page.getByRole("button", { name: "Undo" }).first().click();
      await page.getByRole("button", { name: /^Theme/ }).click();
      await expect(page.getByRole("menu")).toBeVisible();
      await settled(page);
      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.violations.map(
          (v) =>
            `${theme} ${v.id}: ${v.nodes.map((n) => `${n.target.join(" ")} ${n.failureSummary}`).join("; ")}`,
        ),
      ).toEqual([]);
    }
  });
});
