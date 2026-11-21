import { expect, test } from "@playwright/test";
import { demo, hasHorizontalScroll, PHONE_SIZES } from "./helpers/app";
import { sheetSettled } from "./helpers/sheet";
import { checkTokens, describeFailures } from "./helpers/tokens";

/**
 * M4-T14: the Gradient tab and every M4 sheet at 320, 375, 390 and 430 px, in both themes: no
 * horizontal scroll, and every control is at least 44 px (spec 6.1). The M3 sheets are in
 * layout.spec.ts.
 */
test("320, 375, 390, 430 px, light and dark: the Gradient tab and its sheets don't scroll sideways and every control is at least 44 px", async ({
  page,
}, info) => {
  test.skip(!info.project.name.startsWith("phone"), "phone sizes");
  test.setTimeout(120_000);
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const size of PHONE_SIZES) {
      await page.setViewportSize(size);
      for (const row of [null, "interpolation", "stop", "geometry"]) {
        const at = `${theme} ${size.width} ${row ?? "tab"}`;
        await page.goto(demo(`tab=gradient${row ? `&rows=${row}` : ""}`));
        if (row) {
          await expect(page.getByRole("dialog")).toBeVisible();
          await sheetSettled(page);
        } else await expect(page.getByTestId("gradient-preview")).toBeVisible();
        expect(await hasHorizontalScroll(page), `${at}: scroll`).toBe(false);
        const failures = await checkTokens(page, { touchTargets: true });
        expect(failures, `${at}: ${describeFailures(failures)}`).toEqual([]);
      }
    }
  }
});
