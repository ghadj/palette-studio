/**
 * Project `visual` (visual-testing.md 3): compares every shot with its approved baseline.
 * Run it only in CI's Playwright container; local runs are informational. Baselines change only
 * through .github/workflows/visual-baselines.yml after the review page is approved.
 */
import { expect, test } from "@playwright/test";
import { ready, touchDevice } from "./ready";
import { M1_SHOTS, SHOT_THEMES, shotFile } from "./shots";

for (const shot of M1_SHOTS) {
  for (const theme of SHOT_THEMES) {
    test.describe(() => {
      test.use({
        viewport: shot.viewport,
        colorScheme: theme,
        hasTouch: touchDevice(shot),
        isMobile: touchDevice(shot),
      });
      test(`${shot.name} ${theme}`, async ({ page }) => {
        await page.goto(shot.path);
        await ready(page);
        await expect(page).toHaveScreenshot(shotFile(shot, theme), {
          animations: "disabled",
          caret: "hide",
          maxDiffPixelRatio: 0.002,
        });
      });
    });
  }
}
