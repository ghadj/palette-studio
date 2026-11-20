import { expect, type Page } from "@playwright/test";
import type { Shot } from "./shots";

/** Phones and tablets are touch devices, so they get coarse-pointer sizing (spec 6.1). */
export const touchDevice = (shot: Shot): boolean => shot.viewport.width < 1024;

/** Waits until the screen is stable: app rendered, images decoded, fonts ready, no animations. */
export async function ready(page: Page): Promise<void> {
  await expect(page.locator("#app-root")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() =>
    Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0),
  );
  await page.evaluate(() => document.fonts.ready);
  // Content the worker draws after load, such as the cluster overlay (M2-T14), marks itself
  // data-settling until it is on screen.
  if (new URL(page.url()).searchParams.has("cluster")) {
    await expect(page.locator("[data-testid=cluster-overlay]:visible")).toHaveCount(1, {
      timeout: 15_000,
    });
  }
  await page.waitForFunction(() => document.querySelector("[data-settling]") === null);
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running"),
  );
}
