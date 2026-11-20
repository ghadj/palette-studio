/**
 * M4-T12: the gradient preview (spec 4.4, 4.5, 6.2; plan D22, D23). Pixels are read from screenshots
 * of the preview, decoded in the page.
 */
import { expect, type Locator, type Page, test } from "@playwright/test";
import { addScrollSpace, demo, isPhoneProject } from "./helpers/app";
import { sheetSettled } from "./helpers/sheet";

const preview = (page: Page) => page.getByTestId("gradient-preview");
const stage = (page: Page) => page.getByTestId("gradient-stage");

/** Opens a demo page on the Gradient tab at a fixed size per project. */
async function open(page: Page, info: Parameters<typeof isPhoneProject>[0], query = "") {
  if (isPhoneProject(info)) {
    await page.goto(demo(`tab=gradient${query ? `&${query}` : ""}`));
  } else {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(demo(query));
  }
  await expect(preview(page)).toBeVisible();
}

/** Screenshots the inside of a locator, inset past its border and rounded corners. */
async function shot(locator: Locator, inset = 6): Promise<Buffer> {
  const b = await locator.boundingBox();
  if (!b) throw new Error("no box");
  return locator.page().screenshot({
    clip: {
      x: b.x + inset,
      y: b.y + inset,
      width: b.width - 2 * inset,
      height: b.height - 2 * inset,
    },
  });
}

interface Pixels {
  width: number;
  height: number;
  /** The mean color of each column over `rows` rows through the middle, as [r, g, b][]. */
  columns: number[][];
  /** The largest difference between R, G and B of any pixel. */
  grayness: number;
}

/** Decodes a PNG in the page and reduces it. */
async function pixels(page: Page, png: Buffer, rows = 4): Promise<Pixels> {
  return page.evaluate(
    async ([b64, count]) => {
      const bytes = Uint8Array.from(atob(b64 as string), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.drawImage(bitmap, 0, 0);
      const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
      const first = Math.floor((bitmap.height - (count as number)) / 2);
      const columns: number[][] = [];
      for (let x = 0; x < bitmap.width; x += 1) {
        const sum = [0, 0, 0];
        for (let y = first; y < first + (count as number); y += 1) {
          for (let c = 0; c < 3; c += 1) {
            sum[c] = (sum[c] ?? 0) + (data[(y * bitmap.width + x) * 4 + c] ?? 0);
          }
        }
        columns.push(sum.map((v) => v / (count as number)));
      }
      let grayness = 0;
      for (let i = 0; i < data.length; i += 4) {
        const [r, g, b] = [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0];
        grayness = Math.max(grayness, Math.abs(r - g), Math.abs(g - b));
      }
      return { width: bitmap.width, height: bitmap.height, columns, grayness };
    },
    [png.toString("base64"), rows] as const,
  );
}

/** Largest per-channel difference between two PNGs of the same size, pixel by pixel. */
async function maxDifference(page: Page, a: Buffer, b: Buffer): Promise<number> {
  return page.evaluate(
    async ([first, second]) => {
      const load = async (b64: string) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no 2d context");
        ctx.drawImage(bitmap, 0, 0);
        return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      };
      const [x, y] = [await load(first as string), await load(second as string)];
      if (x.width !== y.width || x.height !== y.height) return 255;
      let max = 0;
      for (let i = 0; i < x.data.length; i += 4) {
        for (let c = 0; c < 3; c += 1)
          max = Math.max(max, Math.abs((x.data[i + c] ?? 0) - (y.data[i + c] ?? 0)));
      }
      return max;
    },
    [a.toString("base64"), b.toString("base64")] as const,
  );
}

test.describe("gradient preview (M4-T12)", () => {
  test("native and forced-baked fixture previews match within 3/255 per channel, averaged over 4 rows (v1 acceptance 6)", async ({
    page,
  }, info) => {
    // WebKit's own gradient rendering differs by up to 8/255 from the baked stops (measured on the
    // phone-webkit project); the acceptance criterion is for Chromium.
    test.skip(info.project.name.includes("webkit"), "the 3/255 criterion is for Chromium");
    await open(page, info);
    await expect(preview(page)).toHaveAttribute("data-render", "native");
    const native = await pixels(page, await shot(preview(page)));

    const baked = await page.context().newPage();
    await baked.addInitScript(() => {
      CSS.supports = () => false;
    });
    if (!isPhoneProject(info)) await baked.setViewportSize({ width: 1280, height: 800 });
    await baked.goto(demo(isPhoneProject(info) ? "tab=gradient" : ""));
    await expect(baked.getByTestId("gradient-preview")).toHaveAttribute("data-render", "baked");
    const forced = await pixels(baked, await shot(baked.getByTestId("gradient-preview")));
    await baked.close();

    expect(forced.width).toBe(native.width);
    let worst = 0;
    for (let x = 0; x < native.width; x += 1) {
      for (let c = 0; c < 3; c += 1) {
        worst = Math.max(
          worst,
          Math.abs((native.columns[x]?.[c] ?? 0) - (forced.columns[x]?.[c] ?? 0)),
        );
      }
    }
    console.log(`native against baked: worst ${worst.toFixed(2)}/255 over ${native.width} columns`);
    expect(worst).toBeLessThanOrEqual(3);
  });

  test("preview pixels are identical in light and dark (spec 6.2 theme 3)", async ({
    page,
  }, info) => {
    const shots: Buffer[] = [];
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page, info, "surround=mid-gray");
      shots.push(await shot(preview(page)));
    }
    expect(await maxDifference(page, shots[0] as Buffer, shots[1] as Buffer)).toBe(0);
  });

  test("the preview is 2:1 at full width on desktop", async ({ page }, info) => {
    test.skip(isPhoneProject(info), "the phone caps the height");
    await open(page, info);
    const b = await preview(page).boundingBox();
    const s = await stage(page).boundingBox();
    expect(Math.abs((b?.width ?? 0) / (b?.height ?? 1) - 2)).toBeLessThan(0.02);
    expect((s?.width ?? 0) - (b?.width ?? 0)).toBeLessThanOrEqual(20);
  });

  test("the checkerboard shows only while a stop has alpha below 1", async ({ page }, info) => {
    await page.goto(demo(`rows=stop&tab=gradient`));
    if (!isPhoneProject(info)) {
      await page.setViewportSize({ width: 1280, height: 1000 });
    } else if ((await page.getByRole("dialog").count()) > 0) await sheetSettled(page);
    const frame = page.locator(".gradient-frame[data-checker]");
    await expect(frame).toHaveCount(0);
    const alpha = page
      .locator("[data-testid=row-stop], [data-testid=sheet-stop]")
      .getByRole("spinbutton", { name: "Alpha", exact: true });
    await alpha.fill("50");
    await expect(frame).toHaveCount(1);
    await expect(preview(page)).toHaveAttribute("data-stops", /#D4527F80@50/);
    await page
      .locator("[data-testid=row-stop], [data-testid=sheet-stop]")
      .getByRole("button", { name: "Reset alpha" })
      .click();
    await expect(frame).toHaveCount(0);
  });

  test("surround=black: the stage is #000000 and the preview pixels don't change", async ({
    page,
  }, info) => {
    await open(page, info);
    const before = await shot(preview(page));
    await open(page, info, "surround=black");
    await expect(stage(page)).toHaveCSS("background-color", "rgb(0, 0, 0)");
    expect(await maxDifference(page, before, await shot(preview(page)))).toBe(0);
    await open(page, info, "surround=mid-gray");
    await expect(stage(page)).toHaveCSS("background-color", "rgb(119, 119, 119)");
    expect(await maxDifference(page, before, await shot(preview(page)))).toBe(0);
  });

  test("dragging marker 4 changes the 50% stop's color in the preview before release (spec 3.7)", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "the image and the preview are on different tabs on phones");
    await open(page, info);
    const stops = await preview(page).getAttribute("data-stops");
    await page.evaluate(() => {
      const w = window as unknown as { __long: number[] };
      w.__long = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) w.__long.push(e.duration);
      }).observe({ entryTypes: ["longtask"] });
    });
    const ring = page.locator('[data-marker="4"] .marker__ring');
    const b = await ring.boundingBox();
    const image = await page.locator(".image-well__image:visible").first().boundingBox();
    if (!b || !image) throw new Error("no boxes");
    const from = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= 20; i += 1) {
      await page.mouse.move(from.x + i * 4, from.y + i * 6);
    }
    // Still pressed: the preview already shows the new color.
    await expect(preview(page)).not.toHaveAttribute("data-stops", stops ?? "");
    await expect(page.locator('[data-marker="4"]')).toHaveAttribute("data-dragging", "");
    await page.mouse.up();
    const long = await page.evaluate(() => (window as unknown as { __long: number[] }).__long);
    expect(long.filter((d) => d > 50)).toEqual([]);
  });

  test("phone: the dock holds the preview and the stop bar, pinned, within about 35% of the screen", async ({
    page,
  }, info) => {
    test.skip(!isPhoneProject(info), "phone only");
    await open(page, info);
    await addScrollSpace(page);
    await page.evaluate(() => window.scrollTo(0, 400));
    const dock = page.getByTestId("gradient-dock");
    await expect(dock.getByTestId("stop-bar")).toBeVisible();
    const header = await page.locator("header").first().boundingBox();
    const d = await dock.boundingBox();
    const bar = await page.getByTestId("stop-bar").boundingBox();
    if (!header || !d || !bar) throw new Error("no boxes");
    expect(Math.abs(d.y - (header.y + header.height))).toBeLessThanOrEqual(8);
    expect(bar.y + bar.height).toBeLessThanOrEqual(d.y + d.height);
    expect(d.height).toBeLessThanOrEqual(0.35 * (page.viewportSize()?.height ?? 0) + 8);
  });

  for (const size of [
    { width: 390, height: 844 },
    { width: 820, height: 1180 },
  ]) {
    test(`${size.width} x ${size.height}: with the Stop drawer open and scrolled, the stop bar and the selected handle stay above it (decision 67)`, async ({
      page,
    }, info) => {
      test.skip(!isPhoneProject(info), "the drawers are sheets below 1024 px");
      await page.setViewportSize(size);
      await page.goto(demo("rows=stop&tab=gradient"));
      await sheetSettled(page);
      const dialog = page.getByRole("dialog");
      const handle = page.locator("[data-testid=stop-handle][data-selected]");
      await expect(handle).toBeVisible();
      for (const dy of [0, 400]) {
        // Scrolls whatever scrolls in the drawer (a wheel is not available in mobile WebKit).
        await dialog.evaluate((el, by) => {
          for (const node of [el, ...el.querySelectorAll<HTMLElement>("*")]) {
            if (node.scrollHeight > node.clientHeight + 1) node.scrollTop += by;
          }
        }, dy);
        await page.waitForTimeout(150);
        const panel = await dialog.boundingBox();
        const h = await handle.boundingBox();
        const bar = await page.getByTestId("stop-bar").boundingBox();
        if (!panel || !h || !bar) throw new Error("no boxes");
        expect(bar.y + bar.height).toBeLessThanOrEqual(panel.y + 1);
        expect(h.y + h.height).toBeLessThanOrEqual(panel.y + 1);
        expect(h.y).toBeGreaterThanOrEqual(0);
      }
    });
  }

  test("desktop: column 3 scrolled to the bottom keeps the stop bar pinned at its top (decision 67)", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "desktop layout");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(demo("rows=interpolation,stop,geometry"));
    const scroller = page.locator("[data-column=gradient] .column__scroll");
    await scroller.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    const column = await scroller.boundingBox();
    const dock = await page.getByTestId("gradient-dock").boundingBox();
    const bar = await page.getByTestId("stop-bar").boundingBox();
    if (!column || !dock || !bar) throw new Error("no boxes");
    expect(Math.abs(dock.y - column.y)).toBeLessThanOrEqual(2);
    expect(bar.y).toBeGreaterThanOrEqual(dock.y);
    expect(bar.y + bar.height).toBeLessThanOrEqual(dock.y + dock.height + 1);
  });
});
