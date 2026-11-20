import { expect, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";

/**
 * The Palette and Values views (spec 3.8; plan M3-T14; ui-contract "Image views"). Expected
 * numbers are in docs/design/mockup-state.md ("Expected image views"). The views are drawn in the
 * worker, so each test waits for the view canvas to say which mode it holds.
 */

const MOCKUP = ["#E8693A", "#1DB07A", "#14386B", "#D4527F", "#1E8A2E", "#5039B0"];
/** Band middles with 5 bands (spec 3.8): L 0.1, 0.3, 0.5, 0.7, 0.9 (mockup-state.md). */
const GRAYS_5 = ["#030303", "#2E2E2E", "#636363", "#9E9E9E", "#DEDEDE"];

const well = (page: Page) => page.locator("[data-testid=image-well]:visible").first();
const viewCanvas = (page: Page, mode: "palette" | "values") =>
  well(page).locator(`[data-testid=view-layer][data-view-mode=${mode}]:not([data-settling])`);
const viewBar = (page: Page) => page.locator("[data-testid=view-bar]:visible");
const strip = (page: Page) => page.locator("[data-testid=swatch-strip]:visible").first();
const row = (page: Page, name: string) =>
  page.locator(".setting-row:visible").filter({ hasText: name });

async function open(page: Page, query: string): Promise<void> {
  await page.goto(demo(query));
  await page.waitForLoadState("networkidle");
}

async function openView(page: Page, mode: "palette" | "values"): Promise<void> {
  await open(page, `image=${mode}`);
  await expect(viewCanvas(page, mode)).toHaveCount(1, { timeout: 15_000 });
}

/** The distinct opaque colors of the view canvas, as hexes. */
async function canvasColors(page: Page, mode: "palette" | "values"): Promise<string[]> {
  return viewCanvas(page, mode).evaluate((el) => {
    const canvas = el as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const seen = new Set<string>();
    for (let o = 0; o < data.length; o += 4) {
      if (data[o + 3] !== 255) continue;
      const key = ((data[o] ?? 0) << 16) | ((data[o + 1] ?? 0) << 8) | (data[o + 2] ?? 0);
      seen.add(`#${key.toString(16).padStart(6, "0").toUpperCase()}`);
    }
    return [...seen].sort();
  });
}

async function goToTab(
  page: Page,
  name: "Source" | "Palette",
  info: { project: { name: string } },
) {
  if (!info.project.name.startsWith("phone")) return;
  await page.getByTestId("tabbar").getByRole("tab", { name }).click();
}

test.describe("Palette view (spec 3.8)", () => {
  test("image=palette: legend 83.2%, 14.7% and '0.5% each' (± 0.3 pp)", async ({ page }) => {
    await openView(page, "palette");
    const entries = page.locator("[data-testid=legend]:visible [data-testid=legend-entry]");
    await expect(entries).toHaveCount(3);
    const text = await entries.allTextContents();
    const pct = (s: string) => Number.parseFloat(s);
    expect(Math.abs(pct(text[0] ?? "") - 83.2)).toBeLessThanOrEqual(0.3);
    expect(Math.abs(pct(text[1] ?? "") - 14.7)).toBeLessThanOrEqual(0.3);
    expect(text[2]).toMatch(/each$/);
    expect(Math.abs(pct(text[2] ?? "") - 0.5)).toBeLessThanOrEqual(0.3);
    // Four squares share the merged entry; the bar has one part per color.
    await expect(entries.nth(2).locator("[data-legend-square]")).toHaveCount(4);
    await expect(page.locator("[data-testid=share-bar]:visible [data-share-part]")).toHaveCount(6);
  });

  test("every pixel of the view canvas is one of the six hexes (dither off)", async ({ page }) => {
    await openView(page, "palette");
    const colors = await canvasColors(page, "palette");
    expect(colors.length).toBeGreaterThan(0);
    for (const hex of colors) expect(MOCKUP).toContain(hex);
    expect(colors).toContain("#1DB07A");
    expect(colors).toContain("#E8693A");
  });

  test("Colors from is Palette, with Matched paints disabled and a note", async ({ page }) => {
    await openView(page, "palette");
    const select = page.locator("select#view-colors-from:visible");
    await expect(select).toHaveValue("palette");
    await expect(select.locator("option[value=paints]")).toBeDisabled();
    await expect(select.locator("option[value=paints]")).toHaveText(/needs paint matching/i);
  });

  test("Dither on keeps palette colors only", async ({ page }) => {
    await openView(page, "palette");
    const dither = page.locator("#view-dither:visible");
    await expect(dither).toHaveAttribute("aria-checked", "false");
    await dither.click();
    await expect(dither).toHaveAttribute("aria-checked", "true");
    await expect(viewCanvas(page, "palette")).toHaveCount(1, { timeout: 15_000 });
    await expect(viewCanvas(page, "palette")).toHaveAttribute("data-dither", "");
    for (const hex of await canvasColors(page, "palette")) expect(MOCKUP).toContain(hex);
  });

  test("an adjustment updates the Palette view", async ({ page }, info) => {
    await openView(page, "palette");
    await goToTab(page, "Palette", info);
    await page.locator("[data-testid=swatch-strip]:visible [data-swatch]").nth(1).click();
    const hex = page.locator("[data-testid=swatch-editor]:visible").getByLabel("HEX", {
      exact: true,
    });
    await hex.fill("#20B27C");
    await hex.press("Enter");
    await goToTab(page, "Source", info);
    await expect
      .poll(async () => (await canvasColors(page, "palette")).includes("#20B27C"), {
        timeout: 15_000,
      })
      .toBe(true);
    const colors = await canvasColors(page, "palette");
    expect(colors).not.toContain("#1DB07A");
  });

  test("the selected swatch's label gives its share in the Palette view", async ({
    page,
  }, info) => {
    await openView(page, "palette");
    await goToTab(page, "Palette", info);
    await page.locator("[data-testid=swatch-strip]:visible [data-swatch]").nth(1).click();
    await expect(page.locator("[data-testid=selection-label]:visible")).toHaveText(
      /^Swatch 2 · 8[23]\.\d% of the image$/,
    );
  });
});

test.describe("Values view (spec 3.8)", () => {
  test("image=values: 5 bands; the canvas has only band grays; swatches 1 and 2 have a corner dot and the legend says Close in value (decisions 51, 52)", async ({
    page,
  }, info) => {
    await openView(page, "values");
    const bands = page.locator("[data-testid=band-strip]:visible [data-band]");
    await expect(bands).toHaveCount(5);
    await expect(page.locator("[data-testid=band-strip]:visible")).toContainText("Dark");
    await expect(page.locator("[data-testid=band-strip]:visible")).toContainText("Light");
    // Band 1 (L 0 to 0.2) is empty in the fixture, so the canvas holds the four other grays.
    const colors = await canvasColors(page, "values");
    for (const hex of colors) expect(GRAYS_5).toContain(hex);
    for (const hex of GRAYS_5.slice(1)) expect(colors).toContain(hex);
    await expect(row(page, "Bands")).toContainText("5");
    // No pair list or chips: the dots and one legend line are the indication.
    await expect(page.getByTestId("value-pairs")).toHaveCount(0);
    await expect(page.getByTestId("value-bracket")).toHaveCount(0);

    const swatches = strip(page).locator("[data-swatch]");
    await expect(swatches).toHaveCount(6);
    const flagged = await swatches.evaluateAll((els) =>
      els.map((el) => el.querySelector("[data-testid=close-flag]") !== null),
    );
    expect(flagged).toEqual([true, true, false, false, false, false]);
    // The dot is at the tile's top-left corner.
    const s1 = await swatches.nth(0).boundingBox();
    const dot = await swatches.nth(0).getByTestId("close-flag").boundingBox();
    if (!s1 || !dot) throw new Error("no boxes");
    expect(dot.x - s1.x).toBeLessThanOrEqual(8);
    expect(dot.y - s1.y).toBeLessThanOrEqual(8);
    await expect(swatches.nth(0)).toHaveAttribute("aria-description", /Close in value to swatch 2/);
    // The legend sits directly under the strip, with the same dot.
    const legend = page.locator("[data-testid=close-legend]:visible");
    await expect(legend).toHaveText("Close in value");
    const bar = await strip(page).boundingBox();
    const l = await legend.boundingBox();
    if (!bar || !l) throw new Error("no boxes");
    expect(l.y - (bar.y + bar.height)).toBeGreaterThanOrEqual(-1);
    expect(l.y - (bar.y + bar.height)).toBeLessThanOrEqual(24);
    await expect(page.getByTestId("close-announce")).toHaveText("Some colors are close in value.");
    if (isPhoneProject(info)) {
      // On phones the legend pins with the strip (M2 decision 19).
      await expect(page.locator("[data-testid=strip-dock] [data-testid=close-legend]")).toHaveCount(
        1,
      );
    }
  });

  test("Bands 3 gives 3 grays", async ({ page }) => {
    await openView(page, "values");
    await page.locator("select#view-bands:visible").selectOption("3");
    await expect(page.locator("[data-testid=band-strip]:visible [data-band]")).toHaveCount(3);
    await expect(viewCanvas(page, "values")).toHaveAttribute("data-bands", "3", {
      timeout: 15_000,
    });
    const colors = await canvasColors(page, "values");
    // L 1/6, 1/2 and 5/6 as grays.
    expect(colors.length).toBeLessThanOrEqual(3);
    expect(colors.length).toBeGreaterThanOrEqual(2);
  });

  test("the threshold slider changes which swatches are flagged", async ({ page }) => {
    await openView(page, "values");
    const field = page.locator("#view-close-in-value:visible");
    await expect(field).toHaveValue("0.03");
    await expect(page.locator("[data-testid=close-flag]:visible")).toHaveCount(2);
    await field.fill("0.05");
    await field.press("Enter");
    // Swatches 1 and 4 differ by about 0.046 (mockup-state.md), so swatch 4 is flagged too.
    await expect(page.locator("[data-testid=close-flag]:visible")).toHaveCount(3);
  });

  test("6 swatches: the '+' tile is on the swatches' row, (decision 29)", async ({
    page,
  }, info) => {
    await page.setViewportSize(
      isPhoneProject(info) ? { width: 390, height: 844 } : { width: 1280, height: 800 },
    );
    await openView(page, "values");
    const swatches = strip(page).locator("[data-swatch]");
    await expect(swatches).toHaveCount(6);
    const first = await swatches.first().boundingBox();
    const last = await swatches.nth(5).boundingBox();
    if (!first || !last) throw new Error("no boxes");
    // The phone Source tab has no "+" tile (decision 32); strip-actions covers the Palette tab.
    if (!isPhoneProject(info)) {
      const tile = await strip(page).getByTestId("add-swatch").boundingBox();
      if (!tile) throw new Error("no tile");
      expect(Math.abs(tile.y - first.y)).toBeLessThanOrEqual(1);
      expect(tile.x).toBeGreaterThan(last.x);
      expect(tile.height).toBeGreaterThanOrEqual(44);
    }
    for (const box of [first, last]) expect(box.width).toBeGreaterThanOrEqual(44);
  });

  test("phone: the Close in value row is at least 44 px tall", async ({ page }, info) => {
    test.skip(!isPhoneProject(info), "phone only");
    await openView(page, "values");
    const box = await page.locator("[data-testid=close-in-value-row]:visible").boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});

test.describe("views (spec 3.8)", () => {
  test("the view bar switches among Image, Palette and Values; Grid stays coming soon", async ({
    page,
  }) => {
    await open(page, "");
    const seg = (name: string) => viewBar(page).getByRole("button", { name, exact: true });
    await expect(seg("Image")).toHaveAttribute("aria-pressed", "true");
    await seg("Palette").click();
    await expect(seg("Palette")).toHaveAttribute("aria-pressed", "true");
    await expect(viewCanvas(page, "palette")).toHaveCount(1, { timeout: 15_000 });
    await seg("Values").click();
    await expect(viewCanvas(page, "values")).toHaveCount(1, { timeout: 15_000 });
    await seg("Image").click();
    await expect(page.locator("[data-testid=view-layer]")).toHaveCount(0);
    await expect(row(page, "Algorithm")).toHaveCount(1);
    await expect(viewBar(page).getByRole("button", { name: "Grid", exact: true })).toHaveAttribute(
      "data-coming-soon",
      "",
    );
  });

  test("switching views starts no extraction job and a cached switch takes under 100 ms", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const sent: string[] = [];
      (window as unknown as { __sent: string[] }).__sent = sent;
      const post = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (this: Worker, message: unknown, ...rest: never[]) {
        sent.push((message as { type?: string })?.type ?? "?");
        return (post as (...a: unknown[]) => void).call(this, message, ...rest);
      } as typeof Worker.prototype.postMessage;
    });
    await open(page, "");
    const before = await page.evaluate(
      () => (window as unknown as { __sent: string[] }).__sent.length,
    );
    const seg = (name: string) => viewBar(page).getByRole("button", { name, exact: true });
    // First computes, then the cached switches.
    await seg("Palette").click();
    await expect(viewCanvas(page, "palette")).toHaveCount(1, { timeout: 15_000 });
    await seg("Values").click();
    await expect(viewCanvas(page, "values")).toHaveCount(1, { timeout: 15_000 });
    const elapsed = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const buttons = [
            ...document.querySelectorAll<HTMLButtonElement>("[data-testid=view-bar] button"),
          ].filter((b) => b.offsetParent !== null);
          const palette = buttons.find((b) => b.textContent === "Palette");
          const t0 = performance.now();
          const done = () => {
            const el = document.querySelector(
              "[data-testid=view-layer][data-view-mode=palette]:not([data-settling])",
            );
            if (!el) return false;
            resolve(performance.now() - t0);
            return true;
          };
          const observer = new MutationObserver(() => {
            if (done()) observer.disconnect();
          });
          observer.observe(document.body, { subtree: true, childList: true, attributes: true });
          palette?.click();
        }),
    );
    expect(elapsed).toBeLessThan(100);
    const sent = await page.evaluate(() => (window as unknown as { __sent: string[] }).__sent);
    expect(sent.slice(before)).not.toContain("extract");
    expect(sent.slice(before)).toContain("view");
  });

  test("markers hide outside the Image view", async ({ page }) => {
    await openView(page, "palette");
    await expect(page.locator("[data-marker]")).toHaveCount(0);
    await open(page, "image=values");
    await expect(page.locator("[data-marker]")).toHaveCount(0);
  });

  test("the view isn't in undo", async ({ page }) => {
    await open(page, "");
    const undo = page.locator("header").getByRole("button", { name: /^Undo/ });
    await expect(undo).toBeDisabled();
    await viewBar(page).getByRole("button", { name: "Palette", exact: true }).click();
    await expect(viewCanvas(page, "palette")).toHaveCount(1, { timeout: 15_000 });
    await expect(undo).toBeDisabled();
    await page.keyboard.press("Control+z");
    await expect(viewCanvas(page, "palette")).toHaveCount(1);
  });

  test("the view layer follows zoom and pan", async ({ page }) => {
    await open(page, "image=palette&zoom=2");
    await expect(viewCanvas(page, "palette")).toHaveCount(1, { timeout: 15_000 });
    const image = await well(page).locator(".image-well__image").boundingBox();
    const layer = await viewCanvas(page, "palette").boundingBox();
    if (!image || !layer) throw new Error("no boxes");
    for (const key of ["x", "y", "width", "height"] as const) {
      expect(Math.abs(image[key] - layer[key])).toBeLessThanOrEqual(1);
    }
    expect(image.width).toBeGreaterThan((await well(page).boundingBox())?.width ?? 0);
  });

  test("view pixels are identical in light and dark", async ({ page }) => {
    const shots: string[] = [];
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await openView(page, "palette");
      shots.push(
        await viewCanvas(page, "palette").evaluate((el) => (el as HTMLCanvasElement).toDataURL()),
      );
      await expect(viewCanvas(page, "palette")).toHaveAttribute("data-user-content", "");
    }
    expect(shots[0]).toBe(shots[1]);
  });
});
