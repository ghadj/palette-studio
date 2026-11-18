import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("loads under the base path with no console errors", async ({ page, baseURL }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    const response = await page.goto("./");
    expect(response?.ok()).toBe(true);
    expect(new URL(page.url()).pathname).toBe(new URL(baseURL ?? "").pathname);
    await expect(page.locator("#app-root")).toBeVisible();
    await expect(page).toHaveTitle(/Palette Studio/);
    expect(errors).toEqual([]);
  });
});
