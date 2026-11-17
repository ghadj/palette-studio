/**
 * Project `visual-review` (visual-testing.md 2): saves a screenshot of every shot in light and dark
 * to artifacts/visual-review/ for the review page. It asserts nothing.
 */
import { resolve } from "node:path";
import { test } from "@playwright/test";
import { ready, touchDevice } from "./ready";
import { M1_SHOTS, SHOT_THEMES, shotFile } from "./shots";

const OUT = resolve(process.cwd(), "artifacts/visual-review");

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
        await page.screenshot({
          path: `${OUT}/${shotFile(shot, theme)}`,
          animations: "disabled",
          caret: "hide",
        });
      });
    });
  }
}
