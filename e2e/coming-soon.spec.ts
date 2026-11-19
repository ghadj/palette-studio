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

/** Every visible control marked `data-coming-soon` (M1 decision 6), checked one by one. */
async function expectAllComingSoon(page: Page, minSize: number): Promise<number> {
  const controls = page.locator("[data-coming-soon]:visible");
  const count = await controls.count();
  for (let i = 0; i < count; i += 1) {
    await expectComingSoon(page, controls.nth(i), minSize);
  }
  return count;
}

test.describe("controls for later features (M1 decision 6)", () => {
  test("every visible [data-coming-soon] control is enabled, ≥ 44 px on phones (≥ 32 px on desktop), and each tap shows the 'Coming in a later version' toast in a live region", async ({
    page,
  }, info) => {
    // Phone width: every control is a 44 px touch target.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(demo());
    expect(await expectAllComingSoon(page, 44)).toBeGreaterThan(0);
    // The project name and Share are still to come; the view bar keeps Image as the current view.
    const header = page.locator("header");
    await expect(header.getByRole("button", { name: "Share" })).toHaveAttribute(
      "data-coming-soon",
      "",
    );
    await expect(header.getByRole("button", { name: /Harbor mural/ })).toHaveAttribute(
      "data-coming-soon",
      "",
    );
    await expect(
      page.getByTestId("view-bar").getByRole("button", { name: "Image" }),
    ).toHaveAttribute("aria-pressed", "true");

    // The Studio and Materials view tabs exist only in the desktop header.
    if (isPhoneProject(info)) return;
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(demo());
    expect(await expectAllComingSoon(page, 32)).toBeGreaterThan(0);
    const views = page.getByRole("navigation", { name: "Views" });
    await expect(views.getByRole("button", { name: "Studio" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(views.getByRole("button", { name: "Materials" })).toHaveAttribute(
      "data-coming-soon",
      "",
    );
  });

  test("Undo and Redo are built, so they aren't marked coming soon (spec 3.6)", async ({
    page,
  }) => {
    await page.goto(demo());
    const header = page.locator("header");
    for (const name of [/^Undo/, /^Redo/]) {
      await expect(header.getByRole("button", { name })).not.toHaveAttribute("data-coming-soon");
    }
  });
});
