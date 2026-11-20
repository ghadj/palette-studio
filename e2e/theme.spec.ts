import { expect, type Page, test } from "@playwright/test";

const LIGHT_SURFACE = "rgb(255, 255, 255)";
const DARK_SURFACE = "rgb(23, 23, 23)";

const bodyBackground = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const dataTheme = (page: Page) =>
  page.evaluate(() => document.documentElement.getAttribute("data-theme"));

async function chooseTheme(page: Page, name: "System" | "Light" | "Dark") {
  await page.getByRole("button", { name: /^Theme/ }).click();
  await page.getByRole("menuitemradio", { name }).click();
}

test.describe("themes (spec 6.2)", () => {
  test("first visit follows the emulated device scheme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("./");
    expect(await dataTheme(page)).toBeNull();
    expect(await bodyBackground(page)).toBe(DARK_SURFACE);

    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("./");
    expect(await bodyBackground(page)).toBe(LIGHT_SURFACE);
  });

  test("choosing Dark survives a reload", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("./");
    await chooseTheme(page, "Dark");
    expect(await dataTheme(page)).toBe("dark");
    expect(await bodyBackground(page)).toBe(DARK_SURFACE);

    await page.reload();
    expect(await dataTheme(page)).toBe("dark");
    expect(await bodyBackground(page)).toBe(DARK_SURFACE);
    await expect(page.getByRole("button", { name: "Theme: Dark" })).toBeVisible();

    await chooseTheme(page, "System");
    expect(await dataTheme(page)).toBeNull();
    await page.reload();
    expect(await bodyBackground(page)).toBe(LIGHT_SURFACE);
  });

  test("in System, changing the emulated scheme updates colors without a reload", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("./");
    expect(await bodyBackground(page)).toBe(LIGHT_SURFACE);
    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(() => bodyBackground(page)).toBe(DARK_SURFACE);
    await page.emulateMedia({ colorScheme: "light" });
    await expect.poll(() => bodyBackground(page)).toBe(LIGHT_SURFACE);
  });

  test("no flash: with the app bundle delayed 2 s, html already has data-theme dark and the dark surface color", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.addInitScript(() => {
      try {
        localStorage.setItem("palette-studio:theme", "dark");
      } catch {
        // ignore
      }
    });
    let released = false;
    await page.route(/\/assets\/.*\.js$/, async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      released = true;
      await route.continue();
    });
    await page.goto("./", { waitUntil: "commit" });
    await page.waitForSelector("body", { state: "attached" });
    await page.waitForFunction(() => document.styleSheets.length > 0);
    expect(released).toBe(false);
    expect(await page.locator("#app-root").count()).toBe(0);
    expect(await dataTheme(page)).toBe("dark");
    expect(await bodyBackground(page)).toBe(DARK_SURFACE);
  });

  test("demo mode with theme=dark writes nothing to localStorage", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.addInitScript(() => {
      const calls: string[] = [];
      (window as unknown as { __storageCalls: string[] }).__storageCalls = calls;
      for (const name of ["getItem", "setItem", "removeItem", "clear", "key"] as const) {
        const original = Storage.prototype[name] as (...args: unknown[]) => unknown;
        Object.defineProperty(Storage.prototype, name, {
          configurable: true,
          value(this: Storage, ...args: unknown[]) {
            calls.push(`${name}:${String(args[0])}`);
            return original.apply(this, args);
          },
        });
      }
    });
    await page.goto("./?demo=mockup&theme=dark");
    expect(await dataTheme(page)).toBe("dark");
    expect(await bodyBackground(page)).toBe(DARK_SURFACE);
    await chooseTheme(page, "Light");
    expect(await dataTheme(page)).toBe("light");
    const calls = await page.evaluate(
      () => (window as unknown as { __storageCalls: string[] }).__storageCalls,
    );
    expect(calls).toEqual([]);
  });

  test("theme-color metas exist for light and dark", async ({ page }) => {
    await page.goto("./");
    const light = page.locator('meta[name="theme-color"][media="(prefers-color-scheme: light)"]');
    const dark = page.locator('meta[name="theme-color"][media="(prefers-color-scheme: dark)"]');
    await expect(light).toHaveAttribute("content", "#ffffff");
    await expect(dark).toHaveAttribute("content", "#171717");
    await chooseTheme(page, "Dark");
    await expect(light).toHaveAttribute("content", "#171717");
    await chooseTheme(page, "System");
    await expect(light).toHaveAttribute("content", "#ffffff");
  });

  test("the theme menu is keyboard operable: Enter opens, arrows move, Esc closes", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("./");
    const button = page.getByRole("button", { name: /^Theme/ });
    await expect(button).toHaveAttribute("aria-haspopup", "menu");
    await button.focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    // Focus starts on the current choice (System), then the arrows move it.
    await expect(page.getByRole("menuitemradio", { name: "System" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitemradio", { name: "Light" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitemradio", { name: "Dark" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitemradio", { name: "System" })).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(page.getByRole("menuitemradio", { name: "Dark" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(button).toBeFocused();
    expect(await dataTheme(page)).toBeNull();

    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await expect(menu).toBeHidden();
    expect(await dataTheme(page)).toBe("dark");
    await expect(page.getByRole("menuitemradio", { name: "Dark" })).toHaveCount(0);
  });

  test("every theme option is at least 44 px at phone width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("./");
    const button = page.getByRole("button", { name: /^Theme/ });
    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await button.click();
    const items = page.getByRole("menuitemradio");
    await expect(items).toHaveCount(3);
    for (const item of await items.all()) {
      const b = await item.boundingBox();
      expect(b?.height).toBeGreaterThanOrEqual(44);
      expect(b?.width).toBeGreaterThanOrEqual(44);
    }
  });
});
