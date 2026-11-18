import { expect, type Page, test } from "@playwright/test";
import { encodePng } from "../tools/png";
import { fixture } from "./helpers/files";

const strip = (page: Page) =>
  page.locator("[data-testid=swatch-strip]:visible").first().locator("[data-swatch]");

async function hexes(page: Page): Promise<string[]> {
  const labels = await strip(page).evaluateAll((els) =>
    els.map((e) => e.getAttribute("aria-label") ?? ""),
  );
  return labels.map((l) => l.split(", ")[1] ?? "");
}

async function waitForPalette(page: Page, count?: number) {
  if (count === undefined) await expect(strip(page).first()).toBeVisible();
  else await expect(strip(page)).toHaveCount(count);
  await expect(page.locator("[data-testid=swatch-strip][data-busy]")).toHaveCount(0);
}

async function loadSample(page: Page, name: string) {
  await page.getByRole("button", { name: `Load the ${name} sample` }).click();
  await expect(page.locator("[data-testid=image-well] canvas:visible")).toHaveAttribute(
    "aria-label",
    `Source image, ${name}.png`,
  );
}

test.describe("extraction with live settings (spec 2.1, 2.4, 7.4, 8)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
  });

  test("two-color.png yields two swatches with the exact hexes", async ({ page }) => {
    await page.getByTestId("file-input").setInputFiles(fixture("two-color.png"));
    await waitForPalette(page, 2);
    // Sorted by population: 75% first (spec 2.4 Sort).
    expect(await hexes(page)).toEqual(["#1DB07A", "#5039B0"]);
  });

  test("changing Colors to 3 re-extracts and the strip updates", async ({ page }) => {
    await loadSample(page, "Tiles");
    await waitForPalette(page, 6);
    await page.locator("#setting-colors:visible").fill("3");
    await waitForPalette(page, 3);
    // The slider follows the number field.
    await expect(page.locator(".slider:visible").first()).toHaveValue("3");
  });

  test("switching to Median cut updates the strip", async ({ page }) => {
    await loadSample(page, "Orbits");
    await waitForPalette(page, 6);
    const before = await hexes(page);
    await page.locator("#setting-algorithm:visible").selectOption({ label: "Median cut" });
    await expect.poll(() => hexes(page)).not.toEqual(before);
    await waitForPalette(page);
    expect((await hexes(page)).length).toBeGreaterThan(1);
  });

  test("working space, sample size, resampling and seed all re-extract", async ({ page }) => {
    await loadSample(page, "Orbits");
    await waitForPalette(page, 6);
    let previous = await hexes(page);
    const changed = async () => {
      await expect.poll(() => hexes(page)).not.toEqual(previous);
      await waitForPalette(page);
      previous = await hexes(page);
    };
    await page.locator("#setting-space:visible").selectOption({ label: "sRGB" });
    await changed();
    const advanced = page.locator("details.chevron-row:visible");
    await expect(advanced).not.toHaveAttribute("open", "");
    await advanced.locator("summary").click();
    await page.locator("#setting-sample-size:visible").selectOption({ label: "64 px" });
    await changed();
    await page.locator("#setting-resampling:visible").selectOption({ label: "Nearest" });
    await changed();
    await page.locator("#setting-seed:visible").fill("12345");
    await changed();
  });

  test("reloading and loading the same image with the same seed gives the same hexes", async ({
    page,
  }) => {
    await loadSample(page, "Orbits");
    await waitForPalette(page, 6);
    const first = await hexes(page);
    await page.reload();
    await loadSample(page, "Orbits");
    await waitForPalette(page, 6);
    expect(await hexes(page)).toEqual(first);
  });

  test("the main-thread fallback gives the same palette as the worker", async ({ page }) => {
    await loadSample(page, "Dunes");
    await waitForPalette(page, 6);
    const viaWorker = await hexes(page);
    await expect(page.locator("[data-testid=image-well]:visible")).toHaveAttribute(
      "data-master-thread",
      "worker",
    );
    await page.addInitScript(() => {
      (window as unknown as { __paletteStudioMainThread: boolean }).__paletteStudioMainThread =
        true;
    });
    await page.reload();
    await loadSample(page, "Dunes");
    await waitForPalette(page, 6);
    await expect(page.locator("[data-testid=image-well]:visible")).toHaveAttribute(
      "data-master-thread",
      "main",
    );
    expect(await hexes(page)).toEqual(viaWorker);
  });

  test("a new image keeps the previous palette visible and dimmed until its extraction lands", async ({
    page,
  }) => {
    await page.getByTestId("file-input").setInputFiles(fixture("two-color.png"));
    await waitForPalette(page, 2);
    // Record the swatch count on every change of the strip, so a moment with no palette shows up.
    await page.evaluate(() => {
      const counts: number[] = [];
      (window as unknown as { __counts: number[] }).__counts = counts;
      new MutationObserver(() => {
        const strip = Array.from(document.querySelectorAll("[data-testid=swatch-strip]")).find(
          (el) => (el as HTMLElement).offsetParent !== null,
        );
        counts.push(strip ? strip.querySelectorAll("[data-swatch]").length : 0);
      }).observe(document.body, { subtree: true, childList: true, attributes: true });
    });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/sample-tiles\.png$/, async (route) => {
      await gate;
      await route.continue();
    });
    await page.locator("header").getByRole("button", { name: "Replace image" }).click();
    await page.getByRole("menuitem", { name: "Tiles sample" }).click();
    // While the new image loads, the old palette stays, dimmed.
    await expect(page.locator("[data-testid=swatch-strip][data-busy]:visible")).toHaveCount(1);
    await expect(strip(page)).toHaveCount(2);
    release();
    await waitForPalette(page, 6);
    const counts = await page.evaluate(
      () => (window as unknown as { __counts: number[] }).__counts,
    );
    expect(counts.length).toBeGreaterThan(0);
    expect(Math.min(...counts)).toBeGreaterThan(0);
  });

  test("Colors field has inputmode=decimal and 16 px type at phone width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("./");
    const field = page.locator("#setting-colors:visible");
    await expect(field).toHaveAttribute("inputmode", "decimal");
    expect(await field.evaluate((el) => getComputedStyle(el).fontSize)).toBe("16px");
    const seed = page.locator("#setting-seed");
    await expect(seed).toHaveAttribute("inputmode", "decimal");
    for (const id of ["#setting-algorithm", "#setting-space"]) {
      expect(
        await page.locator(`${id}:visible`).evaluate((el) => getComputedStyle(el).fontSize),
      ).toBe("16px");
    }
  });

  test("the mockup state shows its fixture without running extraction", async ({ page }) => {
    await page.goto("./?demo=mockup");
    await expect(strip(page)).toHaveCount(6);
    await expect(page.locator("#setting-algorithm:visible")).toHaveValue("balanced");
    await page.locator("#setting-colors:visible").fill("3");
    await page.waitForTimeout(400);
    await expect(strip(page)).toHaveCount(6);
    expect(page.workers()).toHaveLength(0);
  });

  test("time to first palette for a generated 12 MP image is logged", async ({ page }, info) => {
    test.slow();
    const width = 4000;
    const height = 3000;
    const data = new Uint8Array(width * height * 3);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 3;
        data[i] = (x * 255) / width;
        data[i + 1] = (y * 255) / height;
        data[i + 2] = ((x + y) * 127) / (width + height);
      }
    }
    const buffer = encodePng(width, height, data, 3);
    const start = Date.now();
    await page
      .getByTestId("file-input")
      .setInputFiles({ name: "twelve.png", mimeType: "image/png", buffer });
    await waitForPalette(page);
    const ms = Date.now() - start;
    info.annotations.push({ type: "time to first palette (12 MP)", description: `${ms} ms` });
    console.log(`[${info.project.name}] time to first palette for 12 MP: ${ms} ms`);
  });
});
