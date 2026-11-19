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
