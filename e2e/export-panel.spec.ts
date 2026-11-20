/**
 * The central Export panel (M3 decision 56; ui-contract D10). A header button opens a right-side
 * drawer from 1024 px and a bottom sheet below. Sections: Palette, Gradient, Image, Project.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { box, demo, isPhoneProject } from "./helpers/app";
import { THEMES } from "./helpers/screens";
import { openExport } from "./helpers/sheet";
import { checkTokens, describeFailures } from "./helpers/tokens";

const HEX = "#E8693A\n#1DB07A\n#14386B\n#D4527F\n#1E8A2E\n#5039B0";

test.describe("desktop 1280", () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(isPhoneProject(info), "desktop viewport");
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("there is no bottom export bar and the columns reach the footer", async ({ page }) => {
    await page.goto(demo());
    await expect(page.getByTestId("export-drawer")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Palette export|Gradient export/ })).toHaveCount(
      0,
    );
    const footer = await box(page, "footer");
    const columns = await box(page, ".columns");
    expect(columns.y + columns.height).toBeCloseTo(footer.y, 0);
    for (const name of ["source", "palette", "gradient"]) {
      const column = await box(page, `[data-column=${name}]`);
      expect(column.y + column.height, name).toBeLessThanOrEqual(footer.y + 0.5);
      expect(footer.y - (column.y + column.height), name).toBeLessThan(40);
    }
  });

  test("Export in the header opens a drawer that overlays column 3 without moving the columns", async ({
    page,
  }) => {
    await page.goto(demo());
    const before = await box(page, "[data-column=gradient]");
    const panel = await openExport(page);
    await expect(panel.getByRole("heading", { name: "Export" })).toBeVisible();
    const header = await box(page, "header");
    const drawer = await box(page, ".export-drawer__panel");
    expect(drawer.y).toBeCloseTo(header.y + header.height, 0);
    expect(drawer.x + drawer.width).toBeCloseTo(1280, 0);
    expect(drawer.x).toBeGreaterThanOrEqual(before.x - 40);
    expect(await box(page, "[data-column=gradient]")).toEqual(before);
    await expect(panel.getByRole("tab")).toHaveText(["Palette", "Gradient", "Image", "Project"]);
    await expect(panel.getByRole("tab", { name: "Palette" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("Copy HEX in the Palette section copies the hexes; Esc closes and focus returns", async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "Playwright grants clipboard permissions in Chromium only",
    );
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(demo());
    const panel = await openExport(page);
    await panel.getByRole("button", { name: "Copy HEX", exact: true }).click();
    await expect(page.getByTestId("toast-region")).toHaveText("Copied HEX");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(HEX);
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(
      page.locator("header").getByRole("button", { name: "Export", exact: true }),
    ).toBeFocused();
  });

  test("the close button closes it; the sections are keyboard operable", async ({ page }) => {
    await page.goto(demo());
    const panel = await openExport(page);
    await page.getByRole("tab", { name: "Palette" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(panel.getByRole("tab", { name: "Gradient" })).toBeFocused();
    await expect(panel.getByRole("tab", { name: "Gradient" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.keyboard.press("End");
    await expect(panel.getByRole("tab", { name: "Project" })).toBeFocused();
    // Focus stays inside the drawer.
    for (let i = 0; i < 6; i += 1) await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => !!document.activeElement?.closest("[data-testid=export-panel]")),
    ).toBe(true);
    await panel.getByRole("button", { name: "Close" }).click();
    await expect(panel).toHaveCount(0);
  });

  test("Gradient, Image and Project say Coming in a later version; the last section is remembered", async ({
    page,
  }) => {
    await page.goto(demo());
    let panel = await openExport(page, "Gradient");
    await expect(panel).toContainText("Coming in a later version");
    await panel.getByRole("tab", { name: "Image" }).click();
    await expect(panel).toContainText("PNG or PDF");
    await expect(panel).toContainText("Coming in a later version");
    await panel.getByRole("tab", { name: "Project" }).click();
    await expect(panel.getByText("Project file")).toBeVisible();
    await expect(panel.getByText("Share link")).toBeVisible();
    await expect(panel.getByText("Coming in a later version")).toHaveCount(2);
    await page.keyboard.press("Escape");
    panel = await openExport(page);
    await expect(panel.getByRole("tab", { name: "Project" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("opened from column 2 it starts on Palette; from the Values view in column 1 on Image", async ({
    page,
  }) => {
    await page.goto(demo("image=values"));
    await page.getByTestId("export-panel").count();
    await page.locator("[data-column=source] button").first().focus();
    let panel = await openExport(page);
    await expect(panel.getByRole("tab", { name: "Image" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.keyboard.press("Escape");
    await page.locator("[data-column=palette] button").first().focus();
    panel = await openExport(page);
    await expect(panel.getByRole("tab", { name: "Palette" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("the panel uses tokens and has no axe violations in both themes", async ({ page }) => {
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(demo());
      const panel = await openExport(page);
      const failures = await checkTokens(page, { touchTargets: false });
      expect(failures, `${theme}\n${describeFailures(failures)}`).toEqual([]);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.map((v) => `${theme} ${v.id}: ${v.help}`)).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
    }
  });
});

for (const [width, height] of [
  [390, 844],
  [820, 1180],
] as const) {
  test.describe(`${width} x ${height}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height });
    });

    test("the header Export icon is 44 px and opens a bottom sheet titled Export; the dock has no Export button", async ({
      page,
      context,
      browserName,
    }) => {
      if (browserName === "chromium")
        await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.goto(demo("tab=palette"));
      await expect(page.getByRole("button", { name: "Export palette" })).toHaveCount(0);
      await expect(
        page.getByTestId("strip-dock").getByRole("button", { name: /Export/ }),
      ).toHaveCount(0);
      const button = page.locator("header").getByRole("button", { name: "Export", exact: true });
      const b = await button.boundingBox();
      expect(b?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(b?.height ?? 0).toBeGreaterThanOrEqual(44);
      const panel = await openExport(page);
      await expect(panel.getByRole("heading", { name: "Export" })).toBeVisible();
      await expect(panel.locator(".bottom-sheet__panel, .export-tabs").first()).toBeVisible();
      await expect(panel.getByRole("tab", { name: "Palette" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await panel.getByRole("button", { name: "Copy CSS", exact: true }).click();
      await expect(page.getByTestId("toast-region")).toHaveText("Copied CSS");
      await panel.getByRole("button", { name: "Close" }).click();
      await expect(panel).toHaveCount(0);
      await expect(button).toBeFocused();
    });

    test("from the Source tab in the Values view it opens on Image; from the Palette tab on Palette", async ({
      page,
    }) => {
      await page.goto(demo("tab=source&image=values"));
      let panel = await openExport(page);
      await expect(panel.getByRole("tab", { name: "Image" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await panel.getByRole("button", { name: "Close" }).click();
      await page.getByTestId("tabbar").getByRole("tab", { name: "Palette" }).click();
      panel = await openExport(page);
      await expect(panel.getByRole("tab", { name: "Palette" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    test("the sheet uses tokens with 44 px targets and has no axe violations in both themes", async ({
      page,
    }) => {
      for (const theme of THEMES) {
        await page.emulateMedia({ colorScheme: theme });
        await page.goto(demo("tab=palette"));
        await openExport(page);
        const failures = await checkTokens(page, { touchTargets: true });
        expect(failures, `${theme}\n${describeFailures(failures)}`).toEqual([]);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations.map((v) => `${theme} ${v.id}: ${v.help}`)).toEqual([]);
      }
    });
  });
}
