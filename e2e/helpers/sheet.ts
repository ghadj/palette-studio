import { expect, type Page } from "@playwright/test";

/**
 * Waits until a bottom sheet is open and its slide-in has finished (M3-T2), so measurements see
 * its resting geometry.
 */
export async function sheetSettled(page: Page): Promise<void> {
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running"),
  );
}

/**
 * Opens the central Export panel from the header (M3 decision 56), on a section when given, and
 * returns the panel. The desktop drawer and the phone sheet share the `export-panel` test id.
 */
export async function openExport(
  page: Page,
  section?: "Palette" | "Gradient" | "Image" | "Project",
) {
  await page.locator("header").getByRole("button", { name: "Export", exact: true }).click();
  const panel = page.getByTestId("export-panel");
  await expect(panel).toBeVisible();
  if (section) await panel.getByRole("tab", { name: section }).click();
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running"),
  );
  return panel;
}
