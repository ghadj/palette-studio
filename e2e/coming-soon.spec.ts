import { expect, type Locator, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";

const MESSAGE = "Coming in a later version";

async function expectComingSoon(page: Page, control: Locator, minSize: number) {
  await expect(control).toBeVisible();
  await expect(control).toBeEnabled();
  const b = await control.boundingBox();
  expect(b?.width ?? 0).toBeGreaterThanOrEqual(minSize);
  expect(b?.height ?? 0).toBeGreaterThanOrEqual(minSize);
  const live = page.locator("[data-testid=toast-region]");
  await expect(live).toHaveAttribute("aria-live", "polite");
  const before = Number((await live.getAttribute("data-count")) ?? "0");
  await control.click();
  await expect(live).toHaveAttribute("data-count", String(before + 1));
  await expect(live).toContainText(MESSAGE);
}

test.describe("controls for later features (M1 decision 6)", () => {
  test("Undo, Redo, Share, the project-name chevron, the Materials view tab and the view-bar chips are visible, enabled, ≥ 44 px, and each tap shows the 'Coming in a later version' toast in a live region", async ({
    page,
  }, info) => {
    // Phone width: every control is a 44 px touch target.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(demo());
    const header = page.locator("header");
    for (const name of ["Undo", "Redo", "Share"]) {
      await expectComingSoon(page, header.getByRole("button", { name }), 44);
    }
    await expectComingSoon(page, header.getByRole("button", { name: /Harbor mural/ }), 44);
    const viewBar = page.getByTestId("view-bar");
    await expect(viewBar.getByRole("button", { name: "Image" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    for (const name of ["Palette", "Values", "Grid"]) {
      await expectComingSoon(page, viewBar.getByRole("button", { name }), 44);
    }

    // The Studio and Materials view tabs exist only in the desktop header.
    if (isPhoneProject(info)) return;
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(demo());
    const views = page.getByRole("navigation", { name: "Views" });
    await expect(views.getByRole("button", { name: "Studio" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expectComingSoon(page, views.getByRole("button", { name: "Materials" }), 44);
    for (const name of ["Undo", "Redo", "Share"]) {
      await expectComingSoon(page, page.locator("header").getByRole("button", { name }), 32);
    }
    await expectComingSoon(
      page,
      page.locator("header").getByRole("button", { name: /Harbor mural/ }),
      32,
    );
    for (const name of ["Palette", "Values", "Grid"]) {
      await expectComingSoon(page, page.getByTestId("view-bar").getByRole("button", { name }), 32);
    }
  });
});
