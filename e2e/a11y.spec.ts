import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
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

  test("no axe violations with the Advanced settings open", async ({ page }) => {
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto("./");
      await page.locator("details.chevron-row:visible summary").click();
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
