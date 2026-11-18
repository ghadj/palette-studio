import { expect, test } from "@playwright/test";
import { demo, isPhoneProject, tokenColor } from "./helpers/app";

const HEXES = ["#E8693A", "#1DB07A", "#14386B", "#D4527F", "#1E8A2E", "#5039B0"];
const rgb = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

test.describe("mockup state (mockup-state.md)", () => {
  test("swatch strip shows the six fixture colors (computed background equals each hex)", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "desktop viewport");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(demo());
    const swatches = page.locator("[data-column=palette] [data-testid=swatch-strip] [data-swatch]");
    await expect(swatches).toHaveCount(6);
    const colors = await swatches.evaluateAll((els) =>
      els.map((el) => getComputedStyle(el).backgroundColor),
    );
    expect(colors).toEqual(HEXES.map(rgb));
    for (const [i, hex] of HEXES.entries()) {
      await expect(swatches.nth(i)).toHaveAttribute("aria-label", `Swatch ${i + 1}, ${hex}`);
      await expect(swatches.nth(i)).toHaveAttribute("data-user-content", "");
    }
  });

  test("Algorithm shows Balanced, enabled", async ({ page }) => {
    await page.goto(demo());
    const select = page.locator("#setting-algorithm:visible");
    await expect(select).toHaveValue("balanced");
    await expect(select).toBeEnabled();
    await expect(select.locator("option:checked")).toHaveText("Balanced");
    await expect(select.locator("option:checked")).toBeEnabled();
  });

  test("swatch 3 has the selected outline", async ({ page }) => {
    await page.goto(demo());
    for (const theme of ["light", "dark"] as const) {
      await page.goto(demo(`theme=${theme}`));
      const strip = page.locator("[data-testid=swatch-strip]:visible").first();
      const swatches = strip.locator("[data-swatch]");
      await expect(swatches.nth(2)).toHaveAttribute("aria-pressed", "true");
      for (const i of [0, 1, 3, 4, 5]) {
        await expect(swatches.nth(i)).toHaveAttribute("aria-pressed", "false");
      }
      const style = await swatches.nth(2).evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          width: s.outlineWidth,
          style: s.outlineStyle,
          color: s.outlineColor,
          offset: s.outlineOffset,
        };
      });
      expect(style.width).toBe("2px");
      expect(style.style).toBe("solid");
      expect(style.color).toBe(await tokenColor(page, "--color-text"));
      expect(Number.parseFloat(style.offset)).toBeGreaterThan(0);
      const other = await swatches.nth(0).evaluate((el) => getComputedStyle(el).outlineStyle);
      expect(other).toBe("none");
    }
    // The label names the selection; tapping another swatch moves the selection.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(demo());
    const column = page.locator("[data-column=palette]");
    await expect(column.getByTestId("selection-label")).toHaveText("Swatch 3");
    await column.locator("[data-swatch]").nth(4).click();
    await expect(column.locator("[data-swatch]").nth(4)).toHaveAttribute("aria-pressed", "true");
    await expect(column.getByTestId("selection-label")).toHaveText("Swatch 5");
  });

  test("title ends with (demo)", async ({ page }) => {
    await page.goto(demo());
    await expect(page).toHaveTitle(/\(demo\)$/);
    await page.goto("./");
    await expect(page).toHaveTitle("Palette Studio");
  });

  test("tab=palette opens the Palette tab on phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(demo("tab=palette"));
    await expect(page.getByTestId("tabbar").getByRole("tab", { name: "Palette" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.locator("[data-panel=palette]")).toBeVisible();
    await expect(page.locator("[data-panel=palette] [data-swatch]")).toHaveCount(6);
    await expect(page.getByTestId("selection-label")).toHaveText("Swatch 3");
  });

  test("never reads or writes localStorage or IndexedDB", async ({ page }) => {
    await page.addInitScript(() => {
      const calls: string[] = [];
      (window as unknown as { __calls: string[] }).__calls = calls;
      for (const name of ["getItem", "setItem", "removeItem", "clear", "key"] as const) {
        const original = Storage.prototype[name] as (...args: unknown[]) => unknown;
        Object.defineProperty(Storage.prototype, name, {
          configurable: true,
          value(this: Storage, ...args: unknown[]) {
            calls.push(`storage.${name}`);
            return original.apply(this, args);
          },
        });
      }
      const open = indexedDB.open.bind(indexedDB);
      indexedDB.open = (...args: Parameters<IDBFactory["open"]>) => {
        calls.push("indexedDB.open");
        return open(...args);
      };
    });
    for (const query of [
      "",
      "tab=palette&theme=dark",
      "tab=gradient&theme=light",
      "view=materials",
    ]) {
      await page.goto(demo(query));
      await expect(page.locator("#app-root")).toBeVisible();
      // Use the page: select swatches, switch tabs, change the theme.
      const swatch = page.locator("[data-swatch]:visible").first();
      if (await swatch.count()) await swatch.click();
      await page.getByRole("button", { name: /^Theme/ }).click();
      await page.getByRole("menuitemradio", { name: "Dark" }).click();
      await page.reload();
    }
    expect(await page.evaluate(() => (window as unknown as { __calls: string[] }).__calls)).toEqual(
      [],
    );
  });

  test("image well shows mockup-scene.png loaded from BASE_URL", async ({ page, baseURL }) => {
    await page.goto(demo());
    const image = page.locator("[data-testid=image-well] img:visible").first();
    await expect(image).toHaveAttribute(
      "src",
      `${new URL(baseURL ?? "").pathname}samples/mockup-scene.png`,
    );
    await expect(image).toHaveAttribute("data-user-content", "");
    await expect
      .poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBe(1600);
    expect(await image.evaluate((el) => (el as HTMLImageElement).naturalHeight)).toBe(800);
    const style = await image.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        touchAction: s.touchAction,
        userSelect: s.userSelect || s.getPropertyValue("-webkit-user-select"),
      };
    });
    expect(style.touchAction).toBe("none");
    expect(style.userSelect).toBe("none");
  });

  test("zoom=2 opens at 200%", async ({ page }) => {
    await page.goto(demo("zoom=2"));
    const well = page.locator("[data-testid=image-well]:visible").first();
    await expect(well.getByTestId("zoom-level")).toHaveText("200%");
    await expect(well).toHaveAttribute("data-scale", "2");
    // Centered: the image's center sits at the well's center.
    const image = well.locator("img");
    await expect.poll(() => image.evaluate((el) => (el as HTMLImageElement).complete)).toBe(true);
    const [w, i] = [await well.boundingBox(), await image.boundingBox()];
    if (!w || !i) throw new Error("no boxes");
    expect(i.width).toBeCloseTo((w.width - 2) * 2, 0);
    expect(i.x + i.width / 2).toBeCloseTo(w.x + w.width / 2, 0);
    expect(i.y + i.height / 2).toBeCloseTo(w.y + w.height / 2, 0);
    await page.goto(demo("zoom=4"));
    await expect(well.getByTestId("zoom-level")).toHaveText("400%");
    await page.goto(demo("zoom=8"));
    await expect(well.getByTestId("zoom-level")).toHaveText("800%");
  });
});
