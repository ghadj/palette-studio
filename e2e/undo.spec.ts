import { expect, type Page, test } from "@playwright/test";
import { demo } from "./helpers/app";
import { fixture } from "./helpers/files";

/** Counts the extraction jobs posted to the image worker. */
async function countExtractJobs(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __extractJobs: number };
    w.__extractJobs = 0;
    const original = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (this: Worker, message: unknown, ...rest: unknown[]) {
      if ((message as { type?: string } | null)?.type === "extract") w.__extractJobs += 1;
      return (original as (...args: unknown[]) => void).call(this, message, ...rest);
    };
  });
}
const extractJobs = (page: Page) =>
  page.evaluate(() => (window as unknown as { __extractJobs: number }).__extractJobs);

const strip = (page: Page) =>
  page.locator("[data-testid=swatch-strip]:visible").first().locator("[data-swatch]");

async function hexes(page: Page): Promise<string[]> {
  const labels = await strip(page).evaluateAll((els) =>
    els.map((e) => e.getAttribute("aria-label") ?? ""),
  );
  return labels.map((l) => l.split(", ")[1] ?? "");
}

async function waitForPalette(page: Page, count: number) {
  await expect(strip(page)).toHaveCount(count);
  await expect(page.locator("[data-testid=swatch-strip][data-busy]")).toHaveCount(0);
}

const headerButton = (page: Page, name: string | RegExp) =>
  page.locator("header").getByRole("button", { name });

const colorsField = (page: Page) => page.locator("#setting-colors:visible");

async function loadTwelveColors(page: Page) {
  await page.getByTestId("file-input").setInputFiles(fixture("twelve-colors.png"));
  await waitForPalette(page, 6);
}

/** Sets Colors with the slider, so the number field's own undo history stays empty. */
async function slideColors(page: Page, value: number) {
  await page
    .locator(".slider:visible")
    .first()
    .evaluate((el, v) => {
      (el as HTMLInputElement).value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
}

test.describe("undo and redo (spec 3.6; M3 decisions 3a, 3b)", () => {
  test("Undo and Redo are disabled at start", async ({ page }) => {
    for (const url of ["./", demo()]) {
      await page.goto(url);
      // With no step to name, the accessible name is just the action.
      for (const name of ["Undo", "Redo"]) {
        const button = headerButton(page, new RegExp(`^${name}`));
        await expect(button).toBeVisible();
        await expect(button).toBeDisabled();
        await expect(button).toHaveAccessibleName(name);
      }
    }
    // A new image starts a fresh history too.
    await page.goto("./");
    await loadTwelveColors(page);
    await expect(headerButton(page, /^Undo/)).toBeDisabled();
    await expect(headerButton(page, /^Redo/)).toBeDisabled();
  });

  test("Colors 6 → 8, then Undo, gives back the same 6 hexes with no new job; Redo gives 8", async ({
    page,
  }) => {
    await countExtractJobs(page);
    await page.goto("./");
    await loadTwelveColors(page);
    const six = await hexes(page);

    await colorsField(page).fill("8");
    await colorsField(page).press("Enter");
    await waitForPalette(page, 8);
    const eight = await hexes(page);
    const undo = headerButton(page, "Undo Colors");
    await expect(undo).toBeEnabled();
    const jobs = await extractJobs(page);

    await undo.click();
    await waitForPalette(page, 6);
    expect(await hexes(page)).toEqual(six);
    await expect(colorsField(page)).toHaveValue("6");
    await expect(headerButton(page, /^Undo/)).toBeDisabled();
    const redo = headerButton(page, "Redo Colors");
    await expect(redo).toBeEnabled();
    // Well past the debounce: undo restored the palette without extracting again.
    await page.waitForTimeout(500);
    expect(await extractJobs(page)).toBe(jobs);
    expect(await hexes(page)).toEqual(six);

    await redo.click();
    await waitForPalette(page, 8);
    expect(await hexes(page)).toEqual(eight);
    await expect(colorsField(page)).toHaveValue("8");
    await page.waitForTimeout(500);
    expect(await extractJobs(page)).toBe(jobs);
  });

  test("Ctrl/Cmd+Z undoes, but not while the Colors field has focus", async ({ page }) => {
    await page.goto("./");
    await loadTwelveColors(page);
    await slideColors(page, 8);
    await waitForPalette(page, 8);
    await expect(headerButton(page, "Undo Colors")).toBeEnabled();

    await colorsField(page).focus();
    await page.keyboard.press("ControlOrMeta+z");
    await page.waitForTimeout(400);
    await expect(strip(page)).toHaveCount(8);
    await expect(headerButton(page, /^Redo/)).toBeDisabled();

    await colorsField(page).blur();
    await page.keyboard.press("ControlOrMeta+z");
    await waitForPalette(page, 6);
    await expect(colorsField(page)).toHaveValue("6");
    await expect(headerButton(page, "Redo Colors")).toBeEnabled();

    await page.keyboard.press("ControlOrMeta+Shift+z");
    await waitForPalette(page, 8);
    await expect(colorsField(page)).toHaveValue("8");
  });

  test("applying a preset is one step named 'Preset: <name>'; undo brings back Balanced", async ({
    page,
  }) => {
    await page.goto("./");
    await loadTwelveColors(page);
    const six = await hexes(page);
    const preset = page.locator("#setting-preset:visible");
    await expect(preset).toHaveValue("balanced");
    await preset.selectOption({ label: "Vibrant" });
    await expect(headerButton(page, "Undo Preset: Vibrant")).toBeEnabled();
    await headerButton(page, "Undo Preset: Vibrant").click();
    await expect(preset).toHaveValue("balanced");
    await waitForPalette(page, 6);
    expect(await hexes(page)).toEqual(six);
    await expect(headerButton(page, /^Undo/)).toBeDisabled();
    await expect(headerButton(page, "Redo Preset: Vibrant")).toBeEnabled();
  });

  test("phone Undo and Redo icons are at least 44 × 44", async ({ page }) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(demo());
      for (const name of [/^Undo/, /^Redo/]) {
        const b = await headerButton(page, name).boundingBox();
        expect(b?.width ?? 0).toBeGreaterThanOrEqual(44);
        expect(b?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test("demo mode: undo works in memory and touches no storage", async ({ page }) => {
    await countExtractJobs(page);
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
    await page.goto(demo());
    const six = await hexes(page);
    expect(six).toHaveLength(6);

    await colorsField(page).fill("8");
    await colorsField(page).press("Enter");
    const undo = headerButton(page, "Undo Colors");
    await expect(undo).toBeEnabled();
    await undo.click();
    await expect(colorsField(page)).toHaveValue("6");
    await headerButton(page, "Redo Colors").click();
    await expect(colorsField(page)).toHaveValue("8");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(colorsField(page)).toHaveValue("6");

    // The fixture palette stays: the mockup state never extracts.
    expect(await hexes(page)).toEqual(six);
    expect(await extractJobs(page)).toBe(0);
    expect(await page.evaluate(() => (window as unknown as { __calls: string[] }).__calls)).toEqual(
      [],
    );
  });
});
