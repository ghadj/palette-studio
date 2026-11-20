import { expect, type Page, test } from "@playwright/test";
import { hexToOklab } from "../src/color/convert";
import { TWELVE_COLORS } from "../tools/fixture-colors";
import { encodePng } from "../tools/png";
import { hasHorizontalScroll, isPhoneProject, tokenColor } from "./helpers/app";
import { fixture } from "./helpers/files";
import { grayscalePlusRed } from "./helpers/grayscale-plus-red";
import { isSheetLayout, openRow, rowBox } from "./helpers/rows";
import { sheetSettled } from "./helpers/sheet";

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

test.describe("swatch roles (spec 2.2, 3.1; M2 decision 10)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
  });

  const labels = (page: Page) =>
    strip(page).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));

  async function swatchRolesOn(page: Page, file: Parameters<Page["setInputFiles"]>[1]) {
    await page.getByTestId("file-input").setInputFiles(file);
    await waitForPalette(page);
    await page.locator("#setting-algorithm:visible").selectOption({ label: "Swatch roles" });
    await expect(page.locator("#setting-algorithm:visible")).toHaveValue("swatch-roles");
    await expect
      .poll(async () => (await labels(page)).every((l) => !l.startsWith("Swatch ")))
      .toBe(true);
    await waitForPalette(page);
  }

  test("Swatch roles: Colors is disabled with 'Not used by swatch roles' (aria-describedby)", async ({
    page,
  }) => {
    await swatchRolesOn(page, fixture("two-color.png"));
    const field = page.locator("#setting-colors:visible");
    const slider = page.locator(".slider:visible").first();
    await expect(field).toBeDisabled();
    await expect(slider).toBeDisabled();
    const note = page.locator("#setting-colors-note");
    await expect(note).toHaveText("Not used by swatch roles");
    await expect(note).toBeVisible();
    await expect(field).toHaveAttribute("aria-describedby", "setting-colors-note");
    await expect(slider).toHaveAttribute("aria-describedby", "setting-colors-note");
    await expect(page.getByRole("spinbutton", { name: "Colors" })).toHaveAccessibleDescription(
      "Not used by swatch roles",
    );
    // The value is kept (M1 decision 14), and Colors comes back with another algorithm.
    await expect(field).toHaveValue("6");
    await page.locator("#setting-algorithm:visible").selectOption({ label: "Balanced" });
    await expect(field).toBeEnabled();
    await expect(slider).toBeEnabled();
    await expect(page.locator("#setting-colors-note")).toHaveCount(0);
    await expect(field).not.toHaveAttribute("aria-describedby", /./);
  });

  test("swatch aria-labels carry the role names", async ({ page }) => {
    await swatchRolesOn(page, grayscalePlusRed());
    const found = await labels(page);
    expect(found.map((l) => l.split(", ")[0]).sort()).toEqual([
      "Dark muted",
      "Light muted",
      "Muted",
      "Vibrant",
    ]);
    expect(found).toContain("Vibrant, #FF0000");
  });

  test("the selection label shows the role name, such as 'Vibrant'", async ({ page }, info) => {
    await swatchRolesOn(page, grayscalePlusRed());
    const vibrant = strip(page).and(page.locator('[aria-label^="Vibrant, "]'));
    await vibrant.click();
    await expect(vibrant).toHaveAttribute("aria-pressed", "true");
    // Off the strip, so the label names the selection rather than the hovered map (M2-T14).
    await page.mouse.move(0, 0);
    // On phones the label sits on the Palette tab (ui-contract "Phone").
    if (isPhoneProject(info))
      await page.getByTestId("tabbar").getByRole("tab", { name: "Palette" }).click();
    await expect(page.locator("[data-testid=selection-label]:visible")).toHaveText("Vibrant");
  });

  test("grayscale-plus-red.png names its empty roles in a muted note", async ({ page }, info) => {
    await swatchRolesOn(page, grayscalePlusRed());
    await expect(strip(page)).toHaveCount(4);
    const note = page.locator("[data-testid=empty-roles]:visible");
    await expect(note).toHaveText("No color fits the Dark vibrant or Light vibrant roles.");
    expect(await note.evaluate((el) => getComputedStyle(el).color)).toBe(
      await tokenColor(page, "--color-text-muted"),
    );
    if (isPhoneProject(info)) {
      // The note sits under the strip on the Palette tab too.
      await page.getByTestId("tabbar").getByRole("tab", { name: "Palette" }).click();
      await expect(page.locator("[data-testid=empty-roles]:visible")).toHaveText(
        "No color fits the Dark vibrant or Light vibrant roles.",
      );
      await page.getByTestId("tabbar").getByRole("tab", { name: "Source" }).click();
    }
    // Another algorithm fills the strip again and drops the note.
    await page.locator("#setting-algorithm:visible").selectOption({ label: "Balanced" });
    await waitForPalette(page, 6);
    await expect(page.locator("[data-testid=empty-roles]")).toHaveCount(0);
  });
});

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

  test("a new image extracts with Balanced and the Algorithm select shows Balanced", async ({
    page,
  }) => {
    const select = page.locator("#setting-algorithm:visible");
    await expect(select).toHaveValue("balanced");
    await expect(select.locator("option:checked")).toHaveText("Balanced");
    await expect(select.locator('option[value="balanced"]')).toBeEnabled();
    await page.getByTestId("file-input").setInputFiles(fixture("two-color.png"));
    await waitForPalette(page, 2);
    expect(await hexes(page)).toEqual(["#1DB07A", "#5039B0"]);
    await expect(select).toHaveValue("balanced");
  });

  test("with Balanced, Seed and Restarts are disabled with their notes", async ({ page }) => {
    // M2 decision 5b: Iterations apply to Balanced; Seed and Restarts don't.
    await loadSample(page, "Orbits");
    await waitForPalette(page, 6);
    await expect(page.locator("#setting-algorithm:visible")).toHaveValue("balanced");
    await openRow(page, "Advanced");
    const seed = page.locator("#setting-seed:visible");
    await expect(seed).toBeDisabled();
    await expect(page.getByRole("button", { name: "Randomize" })).toBeDisabled();
    await expect(page.locator("#setting-seed-note")).toHaveText("Used by k-means++ only");
    await expect(seed).toHaveAttribute("aria-describedby", "setting-seed-note");
    const restarts = page.locator("#setting-restarts:visible");
    await expect(restarts).toBeDisabled();
    await expect(page.locator("#setting-restarts-note:visible")).toHaveText(
      "Used by k-means++ only",
    );
    await expect(restarts).toHaveAttribute("aria-describedby", "setting-restarts-note");
    await expect(page.locator("#setting-iterations:visible")).toBeEnabled();
    // Seed and Restarts don't change a Balanced palette.
    const before = await hexes(page);
    await page.locator("#setting-algorithm:visible").selectOption({ label: "K-means++" });
    await seed.fill("777");
    await restarts.fill("7");
    await page.locator("#setting-algorithm:visible").selectOption({ label: "Balanced" });
    await expect.poll(() => hexes(page)).toEqual(before);
    await waitForPalette(page, 6);
    expect(await hexes(page)).toEqual(before);
  });

  test("re-extraction with Balanced at 256 px is logged (spec 7.7, informational)", async ({
    page,
  }, info) => {
    await loadSample(page, "Orbits");
    await waitForPalette(page, 6);
    const field = page.locator("#setting-colors:visible");
    const runs: number[] = [];
    for (const colors of ["5", "6", "5", "6"]) {
      const start = Date.now();
      await field.fill(colors);
      await waitForPalette(page, Number(colors));
      runs.push(Date.now() - start);
    }
    const ms = Math.min(...runs);
    // Wall time from the change to the updated strip, including the ~120 ms debounce (spec 7.4).
    info.annotations.push({
      type: "re-extraction with Balanced at 256 px",
      description: `${ms} ms including the 120 ms debounce`,
    });
    console.log(
      `[${info.project.name}] re-extraction with Balanced at 256 px: ${ms} ms (best of ${runs.length}, including the 120 ms debounce)`,
    );
  });

  test("switching to Wu re-extracts; two-color.png gives its two hexes", async ({ page }) => {
    await loadSample(page, "Orbits");
    await waitForPalette(page, 6);
    const before = await hexes(page);
    await page.locator("#setting-algorithm:visible").selectOption({ label: "Wu" });
    await expect.poll(() => hexes(page)).not.toEqual(before);
    await waitForPalette(page);
    await expect(page.locator("#setting-algorithm:visible")).toHaveValue("wu");
    await page.getByTestId("file-input").setInputFiles(fixture("two-color.png"));
    await waitForPalette(page, 2);
    expect(await hexes(page)).toEqual(["#1DB07A", "#5039B0"]);
  });

  test("Exact colors with Nearest resampling on twelve-colors.png gives all 12 hexes", async ({
    page,
  }) => {
    await page.getByTestId("file-input").setInputFiles(fixture("twelve-colors.png"));
    await waitForPalette(page);
    await page.locator("#setting-algorithm:visible").selectOption({ label: "Exact colors" });
    // Colors is inline, so it is set before the Advanced drawer opens over it (M3 decision 34).
    await page.locator("#setting-colors:visible").fill("12");
    await openRow(page, "Advanced");
    await page.locator("#setting-resampling:visible").selectOption({ label: "Nearest" });
    await waitForPalette(page, 12);
    await expect
      .poll(async () => [...(await hexes(page))].sort())
      .toEqual([...TWELVE_COLORS].sort());
    await expect(page.locator("#setting-algorithm:visible")).toHaveValue("exact");
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
    // Seed applies to k-means++ only, so this test runs under k-means++ (the default is Balanced).
    await page.locator("#setting-algorithm:visible").selectOption({ label: "K-means++" });
    await changed();
    await page.locator("#setting-space:visible").selectOption({ label: "sRGB" });
    await changed();
    await openRow(page, "Advanced");
    await page.locator("#setting-sample-size:visible").selectOption({ label: "64 px" });
    await changed();
    await page.locator("#setting-resampling:visible").selectOption({ label: "Nearest" });
    await changed();
    await page.locator("#setting-seed:visible").fill("12345");
    await changed();
  });

  test("Median cut disables Seed and Randomize with a note; k-means++ re-enables them with the same seed and hexes (decision 14)", async ({
    page,
  }) => {
    await loadSample(page, "Orbits");
    await waitForPalette(page, 6);
    // The default is Balanced, which doesn't use Seed: start from k-means++.
    await page.locator("#setting-algorithm:visible").selectOption({ label: "K-means++" });
    await openRow(page, "Advanced");
    const seed = page.locator("#setting-seed:visible");
    const randomize = page.getByRole("button", { name: "Randomize" });
    await expect(seed).toBeEnabled();
    await seed.fill("4242");
    // Let the debounced re-extraction for the new seed (120 ms) start and finish.
    await page.waitForTimeout(300);
    await waitForPalette(page);
    const kmeansHexes = await hexes(page);
    await expect(seed).toBeEnabled();
    await expect(randomize).toBeEnabled();
    // The note shows only while Seed is disabled (M2 decision 14c).
    await expect(page.locator("#setting-seed-note")).toHaveCount(0);
    await expect(seed).not.toHaveAttribute("aria-describedby");

    await page.locator("#setting-algorithm:visible").selectOption({ label: "Median cut" });
    await expect(seed).toBeDisabled();
    await expect(randomize).toBeDisabled();
    const note = page.locator("#setting-seed-note");
    await expect(note).toHaveText("Used by k-means++ only");
    await expect(note).toBeVisible();
    await expect(seed).toHaveAttribute("aria-describedby", "setting-seed-note");
    await expect(randomize).toHaveAttribute("aria-describedby", "setting-seed-note");
    await expect(seed).toHaveValue("4242");
    // The other settings stay enabled for Median cut.
    for (const id of [
      "#setting-colors",
      "#setting-space",
      "#setting-sample-size",
      "#setting-resampling",
    ]) {
      await expect(page.locator(`${id}:visible`)).toBeEnabled();
    }
    await expect.poll(() => hexes(page)).not.toEqual(kmeansHexes);
    await waitForPalette(page);

    await page.locator("#setting-algorithm:visible").selectOption({ label: "K-means++" });
    await expect(seed).toBeEnabled();
    await expect(randomize).toBeEnabled();
    await expect(page.locator("#setting-seed-note")).toHaveCount(0);
    await expect(seed).toHaveValue("4242");
    await expect.poll(() => hexes(page)).toEqual(kmeansHexes);
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
    for (const id of ["#setting-algorithm", "#setting-space"]) {
      expect(
        await page.locator(`${id}:visible`).evaluate((el) => getComputedStyle(el).fontSize),
      ).toBe("16px");
    }
    // Seed is in the Advanced drawer below 1024 px (M3 decision 34).
    await openRow(page, "Advanced");
    await expect(page.locator("#setting-seed")).toHaveAttribute("inputmode", "decimal");
  });

  test("the mockup state shows its fixture without running extraction", async ({ page }) => {
    // The demo's worker only prepares the fixture image and prepares the fixture master (M4-T15);
    // no extract job may ever be sent.
    await recordJobs(page);
    await page.goto("./?demo=mockup");
    await expect(strip(page)).toHaveCount(6);
    await expect(page.locator("#setting-algorithm:visible")).toHaveValue("balanced");
    await page.locator("#setting-colors:visible").fill("3");
    await page.waitForTimeout(400);
    await expect(strip(page)).toHaveCount(6);
    expect(await page.evaluate(() => (window as unknown as { __jobs: unknown[] }).__jobs)).toEqual(
      [],
    );
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

/** Records the settings of every extraction job sent to the worker. */
async function recordJobs(page: Page) {
  await page.addInitScript(() => {
    const jobs: unknown[] = [];
    (window as unknown as { __jobs: unknown[] }).__jobs = jobs;
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (this: Worker, message: unknown, ...rest: unknown[]) {
      const m = message as { type?: string; settings?: unknown };
      if (m?.type === "extract") jobs.push(m.settings);
      return (post as (...args: unknown[]) => void).call(this, message, ...rest);
    } as Worker["postMessage"];
  });
}

async function lastJob(page: Page): Promise<Record<string, unknown> | undefined> {
  return page.evaluate(() =>
    (window as unknown as { __jobs: Array<Record<string, unknown>> }).__jobs.at(-1),
  );
}

const advanced = (page: Page) => rowBox(page, "Advanced");

test.describe("Advanced settings (spec 2.4; M2-T7)", () => {
  test.beforeEach(async ({ page }) => {
    await recordJobs(page);
    await page.goto("./");
  });

  test("every Advanced control re-extracts", async ({ page }) => {
    await loadSample(page, "Orbits");
    await waitForPalette(page, 6);
    // K-means++ uses every Advanced setting.
    await page.locator("#setting-algorithm:visible").selectOption({ label: "K-means++" });
    await openRow(page, "Advanced");
    const changes: Array<[string, () => Promise<unknown>, unknown]> = [
      ["iterations", () => page.locator("#setting-iterations:visible").fill("10"), 10],
      ["restarts", () => page.locator("#setting-restarts:visible").fill("2"), 2],
      [
        "histogramBits",
        () => page.locator("#setting-histogram-bits:visible").selectOption({ label: "4" }),
        4,
      ],
      // Typed with a decimal comma (spec 6.1, 5).
      ["mergeThreshold", () => page.locator("#setting-merge:visible").fill("0,05"), 0.05],
      [
        "distanceMetric",
        () => page.locator("#setting-metric:visible").selectOption({ label: "CIEDE2000" }),
        "ciede2000",
      ],
      ["vividness", () => page.locator("#setting-vividness:visible").fill("0.5"), 0.5],
      // M2-T9: after Population vs. vividness.
      [
        "spatialWeighting",
        () =>
          page
            .locator("#setting-spatial-weighting:visible")
            .selectOption({ label: "Center-weighted" }),
        "center",
      ],
      ["keepOutlier", () => page.locator("#setting-outlier:visible").click(), true],
      [
        "sort",
        () => page.locator("#setting-sort:visible").selectOption({ label: "Lightness" }),
        "lightness",
      ],
    ];
    for (const [key, change, value] of changes) {
      await change();
      await expect.poll(async () => (await lastJob(page))?.[key], key).toEqual(value);
      await waitForPalette(page);
    }
    await expect(page.locator("#setting-outlier:visible")).toHaveAttribute("aria-checked", "true");
    // Sorted by lightness, dark to light (decision 16).
    await expect
      .poll(async () => {
        const ls = (await hexes(page)).map((hex) => hexToOklab(hex).l);
        return ls.every((l, i) => i === 0 || l >= (ls[i - 1] ?? 0));
      })
      .toBe(true);
    // The merge field shows the committed value with a period: 0.05 reads 5.0 in ΔE00 units.
    await expect(page.locator("#setting-merge:visible")).toHaveValue("5.0");
    await page.locator("#setting-metric:visible").selectOption({ label: "ΔE OK" });
    await expect(page.locator("#setting-merge:visible")).toHaveValue("0.050");
  });

  test("Merge threshold 0.15 on twelve-colors.png gives fewer swatches than 0", async ({
    page,
  }) => {
    await page.getByTestId("file-input").setInputFiles(fixture("twelve-colors.png"));
    await waitForPalette(page);
    await page.locator("#setting-colors:visible").fill("12");
    await openRow(page, "Advanced");
    const merge = page.locator("#setting-merge:visible");
    await merge.fill("0");
    await expect.poll(async () => (await lastJob(page))?.mergeThreshold).toBe(0);
    await waitForPalette(page);
    const atZero = await strip(page).count();
    await merge.fill("0.15");
    await expect.poll(async () => (await lastJob(page))?.mergeThreshold).toBe(0.15);
    await waitForPalette(page);
    const atMax = await strip(page).count();
    expect(atZero).toBeGreaterThan(1);
    expect(atMax).toBeLessThan(atZero);
    // The slider follows the field.
    await expect(page.locator("[aria-label='Merge threshold slider']:visible")).toHaveValue("0.15");
  });

  test("switching the metric to CIEDE2000 shows the threshold as 3.0", async ({ page }) => {
    await openRow(page, "Advanced");
    const merge = page.locator("#setting-merge:visible");
    const slider = page.locator("[aria-label='Merge threshold slider']:visible");
    await expect(merge).toHaveValue("0.030");
    await expect(slider).toHaveAttribute("max", "0.15");
    await page.locator("#setting-metric:visible").selectOption({ label: "CIEDE2000" });
    await expect(merge).toHaveValue("3.0");
    await expect(slider).toHaveAttribute("max", "15");
    await expect(slider).toHaveValue("3");
    await expect(merge).toHaveAttribute("aria-valuemax", "15");
    // Typing 4,5 in ΔE00 units stores 0.045 in ΔE OK units (decision 7).
    await merge.fill("4,5");
    await merge.press("Enter");
    await expect(merge).toHaveValue("4.5");
    await page.locator("#setting-metric:visible").selectOption({ label: "ΔE OK" });
    await expect(merge).toHaveValue("0.045");
  });

  test("iterations and restarts are disabled for algorithms that don't use them, with the note", async ({
    page,
  }) => {
    await openRow(page, "Advanced");
    const iterations = page.locator("#setting-iterations:visible");
    const restarts = page.locator("#setting-restarts:visible");
    const select = page.locator("#setting-algorithm:visible");
    const iterationsNote = page.locator("#setting-iterations-note:visible");
    const restartsNote = page.locator("#setting-restarts-note:visible");
    for (const label of ["Median cut", "Wu", "Exact colors", "Even spread", "Swatch roles"]) {
      await select.selectOption({ label });
      await expect(iterations, label).toBeDisabled();
      await expect(restarts, label).toBeDisabled();
      await expect(iterationsNote, label).toHaveText("Used by k-means++ and Balanced only");
      await expect(restartsNote, label).toHaveText("Used by k-means++ only");
      await expect(iterations).toHaveAttribute("aria-describedby", "setting-iterations-note");
      await expect(restarts).toHaveAttribute("aria-describedby", "setting-restarts-note");
    }
    // Notes show only while their control is disabled (M2 decision 14c).
    await select.selectOption({ label: "Balanced" });
    await expect(iterations).toBeEnabled();
    await expect(iterationsNote).toHaveCount(0);
    await expect(iterations).not.toHaveAttribute("aria-describedby");
    await expect(restarts).toBeDisabled();
    await expect(restartsNote).toHaveText("Used by k-means++ only");
    await select.selectOption({ label: "K-means++" });
    await expect(iterations).toBeEnabled();
    await expect(restarts).toBeEnabled();
    await expect(iterationsNote).toHaveCount(0);
    await expect(restartsNote).toHaveCount(0);
    // Values are kept while disabled.
    await iterations.fill("40");
    await select.selectOption({ label: "Median cut" });
    await expect(iterations).toHaveValue("40");
  });

  test("Swatch roles disables Merge threshold, Population vs. vividness and Keep one outlier, with notes only while disabled", async ({
    page,
  }) => {
    // M2 decisions 10c and 14b.
    await openRow(page, "Advanced");
    const select = page.locator("#setting-algorithm:visible");
    const rows = [
      ["#setting-merge", "#setting-merge-note", "Not used by swatch roles"],
      [
        "#setting-vividness",
        "#setting-vividness-note",
        "Not used by exact colors and swatch roles",
      ],
      ["#setting-outlier", "#setting-outlier-note", "Not used by swatch roles"],
    ] as const;
    for (const [id, noteId] of rows) {
      await expect(page.locator(`${id}:visible`)).toBeEnabled();
      await expect(page.locator(`${noteId}:visible`)).toHaveCount(0);
    }
    await select.selectOption({ label: "Swatch roles" });
    for (const [id, noteId, text] of rows) {
      const control = page.locator(`${id}:visible`);
      await expect(control).toBeDisabled();
      await expect(page.locator(`${noteId}:visible`)).toHaveText(text);
      await expect(control).toHaveAttribute("aria-describedby", noteId.slice(1));
    }
    await expect(page.locator("[aria-label='Merge threshold slider']:visible")).toBeDisabled();
    await expect(
      page.locator("[aria-label='Population vs. vividness slider']:visible"),
    ).toBeDisabled();
    await select.selectOption({ label: "Exact colors" });
    await expect(page.locator("#setting-vividness:visible")).toBeDisabled();
    await expect(page.locator("#setting-merge:visible")).toBeEnabled();
    await expect(page.locator("#setting-merge-note:visible")).toHaveCount(0);
  });

  test("Keep one outlier is a switch the keyboard can operate", async ({ page }) => {
    await openRow(page, "Advanced");
    const toggle = page.locator("#setting-outlier:visible");
    await expect(page.getByRole("switch", { name: "Keep one outlier" }).first()).toBeAttached();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  test("decimal fields step with the arrow keys and clamp on commit", async ({ page }) => {
    await openRow(page, "Advanced");
    const vividness = page.locator("#setting-vividness:visible");
    await expect(vividness).toHaveAttribute("inputmode", "decimal");
    await expect(vividness).toHaveAttribute("role", "spinbutton");
    await vividness.focus();
    await page.keyboard.press("ArrowUp");
    await expect(vividness).toHaveValue("0.05");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(vividness).toHaveValue("0.00");
    await vividness.fill("7");
    await vividness.press("Enter");
    await expect(vividness).toHaveValue("1.00");
  });

  test("all Advanced rows are at least 44 px tall and fit 320 px without sideways scroll", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("./?demo=mockup&rows=advanced");
    // Below 1024 px the row is a sheet: measure it at rest, not mid-slide.
    if (await isSheetLayout(page)) await sheetSettled(page);
    const rows = advanced(page).locator(".setting-row");
    expect(await rows.count()).toBeGreaterThanOrEqual(11);
    const boxes = (selector: string) =>
      advanced(page)
        .locator(selector)
        .evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect();
            return { id: el.id || el.className, width: r.width, height: r.height, right: r.right };
          }),
        );
    for (const box of await boxes(".setting-row")) {
      expect(box.height, box.id).toBeGreaterThanOrEqual(44);
      expect(box.right, box.id).toBeLessThanOrEqual(320);
    }
    for (const box of await boxes("input, select, button")) {
      expect(box.height, box.id).toBeGreaterThanOrEqual(44);
      expect(box.width, box.id).toBeGreaterThanOrEqual(44);
      expect(box.right, box.id).toBeLessThanOrEqual(320);
    }
    expect(await hasHorizontalScroll(page)).toBe(false);
    // The longest Spatial weighting option still fits (M2-T9).
    await page
      .locator("#setting-spatial-weighting:visible")
      .selectOption({ label: "Edge/contrast-weighted" });
    for (const box of await boxes("#setting-spatial-weighting")) {
      expect(box.right, box.id).toBeLessThanOrEqual(320);
    }
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});

test.describe("decimal fields under a German locale (spec 5)", () => {
  test.use({ locale: "de-DE" });

  test("the merge threshold and vividness show a period", async ({ page }) => {
    await page.goto("./?demo=mockup&rows=advanced");
    expect(await page.evaluate(() => (0.5).toLocaleString())).toBe("0,5");
    await expect(page.locator("#setting-merge:visible")).toHaveValue("0.030");
    await expect(page.locator("#setting-vividness:visible")).toHaveValue("0.00");
  });
});
