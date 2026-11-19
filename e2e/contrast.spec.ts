import { expect, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";
import { closePairImage } from "./helpers/close-pair";

// Contrast matrix and close-pair warnings (spec 3.5; M3-T8; decision 6c).

const panel = (page: Page) => page.locator("[data-testid=contrast-panel]:visible");
const contrastUrl = (info: { project: { name: string } }) =>
  demo(info.project.name.startsWith("phone") ? "tab=palette&rows=contrast" : "rows=contrast");
const mark = (page: Page) => page.locator("[data-testid=close-pairs-mark]:visible");

test.describe("contrast matrix (spec 3.5)", () => {
  test("demo: the Contrast row shows a 6 × 6 matrix and the diagonal reads 1.00", async ({
    page,
  }, info) => {
    await page.goto(contrastUrl(info));
    await expect(panel(page)).toBeVisible();
    const cells = panel(page).locator("[data-testid=contrast-cell]");
    await expect(cells).toHaveCount(36);
    await expect(panel(page).locator("tbody tr")).toHaveCount(6);
    for (let i = 0; i < 6; i += 1) {
      await expect(cells.nth(i * 6 + i).locator("[data-testid=contrast-ratio]")).toHaveText("1.00");
    }
    // The mockup palette has no close pairs.
    await expect(panel(page).getByTestId("close-pairs")).toContainText(
      "No swatches are very close",
    );
  });

  test("badges are text, not only color", async ({ page }, info) => {
    await page.goto(contrastUrl(info));
    const cells = panel(page).locator("[data-testid=contrast-cell]");
    await expect(cells).toHaveCount(36);
    await expect(panel(page).locator("[data-testid=contrast-badge]")).toHaveCount(30);
    for (let i = 0; i < 36; i += 1) {
      if (Math.floor(i / 6) === i % 6) continue;
      const cell = cells.nth(i);
      const ratio = Number.parseFloat(
        (await cell.locator("[data-testid=contrast-ratio]").textContent()) ?? "0",
      );
      const label = (await cell.locator("[data-testid=contrast-badge]").textContent()) ?? "";
      expect(["AAA", "AA", "AA large", "Fail"]).toContain(label);
      // The printed ratio is rounded to 2 decimals, so skip a ratio on a threshold itself.
      const nearEdge = [3, 4.5, 7].some((edge) => Math.abs(ratio - edge) < 0.006);
      if (!nearEdge) {
        const expected =
          ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA large" : "Fail";
        expect(label).toBe(expected);
      }
    }
  });

  test("the matrix cells are identical in light and dark", async ({ page }, info) => {
    await page.goto(contrastUrl(info));
    const samples = panel(page).locator("[data-testid=contrast-sample]");
    await expect(samples).toHaveCount(36);
    const read = () =>
      samples.evaluateAll((els) =>
        els.map((el) => [
          getComputedStyle(el).backgroundColor,
          getComputedStyle(el.firstElementChild as Element).backgroundColor,
        ]),
      );
    await page.emulateMedia({ colorScheme: "light" });
    const light = await read();
    await page.emulateMedia({ colorScheme: "dark" });
    const dark = await read();
    expect(dark).toEqual(light);
  });

  test("the sample cells are user content", async ({ page }, info) => {
    await page.goto(contrastUrl(info));
    await expect(
      panel(page).locator("[data-testid=contrast-sample][data-user-content]"),
    ).toHaveCount(36);
  });

  test("at 320 px the page doesn't scroll sideways", async ({ page }, info) => {
    test.skip(!isPhoneProject(info), "phone layout");
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(contrastUrl(info));
    await expect(panel(page)).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});

test.describe("close pairs (spec 3.5)", () => {
  test("a runtime-generated #E8693A/#F0693A image with merge threshold 0 keeps two swatches, and no warning at 0", async ({
    page,
  }) => {
    await page.goto("./");
    await page.getByTestId("file-input").setInputFiles(closePairImage());
    const strip = page
      .locator("[data-testid=swatch-strip]:visible")
      .first()
      .locator("[data-swatch]");
    await expect(strip.first()).toBeVisible();
    await page.locator('details.chevron-row:visible summary:has-text("Advanced")').click();
    await page.locator("#setting-merge:visible").fill("0");
    await expect(page.locator("[data-testid=swatch-strip][data-busy]")).toHaveCount(0);
    await expect(strip).toHaveCount(2);
    // Nothing is closer than a threshold of 0, so nothing is flagged.
    await expect(mark(page)).toHaveCount(0);
  });

  test("a swatch edited close to another shows 'Swatches 1 and 3 are very close' on the strip and in the row", async ({
    page,
  }, info) => {
    const phone = isPhoneProject(info);
    await page.goto(demo(phone ? "tab=palette" : ""));
    await expect(mark(page)).toHaveCount(0);
    // Swatch 1 is #E8693A; make the selected Swatch 3 #EA6B3B (ΔE00 0.64).
    const hex = page.locator("[data-testid=swatch-editor]:visible").getByLabel("HEX", {
      exact: true,
    });
    await hex.fill("#EA6B3B");
    await hex.press("Enter");
    await expect(mark(page)).toContainText("Swatches 1 and 3 are very close");
    // The demo never saves, so a reload starts from the pair-free mockup palette again.
    await page.reload();
    await expect(mark(page)).toHaveCount(0);
  });

  test("the warning shows in the Contrast row's close pairs list", async ({ page }, info) => {
    const phone = isPhoneProject(info);
    await page.goto(demo(phone ? "tab=palette" : ""));
    const hex = page.locator("[data-testid=swatch-editor]:visible").getByLabel("HEX", {
      exact: true,
    });
    await hex.fill("#EA6B3B");
    await hex.press("Enter");
    await page.locator("[data-panel=palette]").getByRole("button", { name: "Contrast" }).click();
    await expect(panel(page).getByTestId("close-pairs")).toContainText(
      "Swatches 1 and 3 are very close",
    );
  });
});
