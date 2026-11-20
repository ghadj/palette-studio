import { expect, type Locator, type Page, test } from "@playwright/test";
import { shareText } from "../src/state/cluster";
import { demo, isPhoneProject } from "./helpers/app";

/**
 * The cluster map (spec 2.6; M2 decisions 13 and 14b): hovering or focusing a swatch, or the
 * phone's Cluster map toggle (in the Swatch sheet since M3-T2, decision 13d), shows the pixels nearest that swatch over the image, with every
 * other pixel dimmed, and the selection label gives its share. The overlay follows zoom and pan.
 */

/** Swatch 3's patch in mockup-scene.png (mockup-state.md), in fractions of the image. */
const PATCH = { x: 0.769, y: 0.167 };
/** mockup-scene.png is 1600 × 800. */
const ASPECT = 800 / 1600;

const well = (page: Page) => page.locator("[data-testid=image-well]:visible").first();
const overlay = (page: Page) => well(page).getByTestId("cluster-overlay");
const swatches = (page: Page) =>
  page.locator("[data-testid=swatch-strip]:visible").first().locator("[data-swatch]");
const label = (page: Page) => page.locator("[data-testid=selection-label]:visible");
const toggle = (page: Page) => page.locator("#cluster-map-toggle:visible");

/** Waits for the demo's map, which the worker builds after load (M2-T13). */
async function demoMapReady(page: Page): Promise<void> {
  await expect(swatches(page).first()).toHaveAttribute("data-share", /\d/, { timeout: 15_000 });
}

/** The demo map's area shares in mockup-state.md, in percent, asserted to ±0.3 pp. */
const DEMO_SHARES = [14.7, 83.2, 0.5, 0.5, 0.5, 0.5];

/**
 * The label gives swatch `index`'s (0-based) own share, formatted as the app does. The computed
 * share varies a little by browser, so it is checked against mockup-state.md to ±0.3 pp.
 */
async function expectShareLabel(page: Page, index: number): Promise<void> {
  const share = Number(await swatches(page).nth(index).getAttribute("data-share"));
  expect(
    Math.abs(share * 100 - (DEMO_SHARES[index] ?? 0)),
    `swatch ${index + 1} share`,
  ).toBeLessThanOrEqual(0.3);
  await expect(label(page)).toHaveText(`Swatch ${index + 1} · ${shareText(share)} of the image`);
}

/** Waits until the overlay shows swatch `index` (0-based) and has been drawn. */
async function overlayShows(page: Page, index: number): Promise<void> {
  await expect(overlay(page)).toHaveCount(1);
  await expect(overlay(page)).toHaveAttribute("data-index", String(index));
  await expect(
    well(page).locator("[data-testid=cluster-overlay]:not([data-settling])"),
  ).toHaveCount(1);
}

async function tab(page: Page, name: "Source" | "Palette"): Promise<void> {
  await page.getByTestId("tabbar").getByRole("tab", { name }).click();
}

/** Opens the Swatch sheet on the phone Palette tab, which holds the toggle (decision 13d). */
async function openSwatchSheet(page: Page): Promise<void> {
  await page
    .locator("[data-panel=palette]")
    .getByRole("button", { name: "Swatch", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "Swatch" })).toBeVisible();
}

async function closeSheet(page: Page): Promise<void> {
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** The overlay canvas's clear (undimmed) pixels, in fractions of the image. */
async function clearPixels(canvas: Locator) {
  return canvas.evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
    const points: Array<{ x: number; y: number }> = [];
    const alphas = new Set<number>();
    for (let i = 0; i < width * height; i += 1) {
      const a = data[i * 4 + 3] ?? 0;
      alphas.add(a);
      if (a === 0)
        points.push({ x: ((i % width) + 0.5) / width, y: (Math.floor(i / width) + 0.5) / height });
    }
    return { points, alphas: [...alphas].sort((a, b) => a - b), rgb: [data[0], data[1], data[2]] };
  });
}

/** Mean sRGB of a small square of the page around a point, in CSS pixels. */
async function colorAt(page: Page, x: number, y: number): Promise<[number, number, number]> {
  const png = await page.screenshot({
    clip: { x: x - 1, y: y - 1, width: 2, height: 2 },
    scale: "css",
  });
  return page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    const sum = [0, 0, 0];
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c += 1) sum[c] = (sum[c] ?? 0) + (data[i + c] ?? 0);
    }
    return sum.map((s) => s / n) as [number, number, number];
  }, png.toString("base64"));
}

/** Counts of the overlay's clear and dimmed pixels. */
async function overlayDump(canvas: Locator) {
  return canvas.evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
    let clear = 0;
    let dimmed = 0;
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const at = (y * width + x) * 4;
        const alpha = data[at + 3];
        if (alpha === 0) clear += 1;
        else if (alpha === 179) dimmed += 1;
      }
    }
    let sum = 0;
    for (let i = 0; i < data.length; i += 1) sum = (sum * 31 + (data[i] ?? 0)) % 2147483647;
    return { clear, dimmed, hash: sum };
  });
}

test.describe("cluster map glow-in (M3 decisions 61, 64)", () => {
  test("the overlay is the clear region and the dimmed outside only, with no outline; the same in both themes", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "hover needs a fine pointer; phones use the toggle");
    const dumps = [];
    for (const theme of ["light", "dark"]) {
      await page.goto(demo(`theme=${theme}`));
      await demoMapReady(page);
      await swatches(page).nth(2).hover();
      await overlayShows(page, 2);
      dumps.push(await overlayDump(overlay(page)));
    }
    const [light, dark] = dumps;
    expect(light?.clear ?? 0).toBeGreaterThan(0);
    expect(light?.dimmed ?? 0).toBeGreaterThan(0);
    expect(dark).toEqual(light);
  });

  test("the glow-in is a short animation on the overlay, and absent with reduced motion", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "hover needs a fine pointer; phones use the toggle");
    await page.goto(demo());
    await demoMapReady(page);
    await swatches(page).nth(2).hover();
    await expect(overlay(page)).toHaveCount(1);
    const names = () =>
      overlay(page).evaluate((el) =>
        el.getAnimations().map((a) => (a as CSSAnimation).animationName),
      );
    await expect.poll(names).toContain("overlay-glow-in");
    // It settles to a plain overlay.
    await expect
      .poll(() => overlay(page).evaluate((el) => getComputedStyle(el).filter), { timeout: 3000 })
      .toBe("none");
    await page.mouse.move(0, 0);
    await expect(overlay(page)).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await swatches(page).nth(2).hover();
    await overlayShows(page, 2);
    expect(await names()).toEqual([]);
  });
});

test.describe("cluster map overlay (spec 2.6, M2 decision 13)", () => {
  test("hovering swatch 3 in demo mode shows the overlay; its undimmed pixels lie within 0.05 of (0.769, 0.167)", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "hover needs a fine pointer; phones use the toggle");
    await page.goto(demo());
    await demoMapReady(page);
    await expect(overlay(page)).toHaveCount(0);
    await swatches(page).nth(2).hover();
    await overlayShows(page, 2);
    await expect(overlay(page)).toHaveAttribute("data-user-content", "");
    const { points, alphas, rgb } = await clearPixels(overlay(page));
    expect(points.length).toBeGreaterThan(0);
    // Distances in image widths: the patch has a radius of 46 px on the 1600 px wide image.
    for (const p of points) {
      expect(Math.abs(p.x - PATCH.x), `x ${p.x}`).toBeLessThanOrEqual(0.05);
      expect(Math.abs(p.y - PATCH.y) * ASPECT, `y ${p.y}`).toBeLessThanOrEqual(0.05);
    }
    const mean = (k: "x" | "y") => points.reduce((s, p) => s + p[k], 0) / points.length;
    expect(Math.abs(mean("x") - PATCH.x)).toBeLessThan(0.01);
    expect(Math.abs(mean("y") - PATCH.y)).toBeLessThan(0.02);
    // Every other pixel is neutral mid-gray at about 70% (decision 13b); there is no outline (64).
    expect(alphas).toEqual([0, 179]);
    expect(rgb).toEqual([128, 128, 128]);
    // Leaving the swatch hides it.
    await page.mouse.move(0, 0);
    await expect(overlay(page)).toHaveCount(0);
  });

  test("the overlay canvas is at least as large as the display copy's long side, capped at 1024 (M3 decision 36)", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "hover needs a fine pointer; phones use the toggle");
    await page.goto(demo());
    await demoMapReady(page);
    await swatches(page).nth(2).hover();
    await overlayShows(page, 2);
    const sizes = await overlay(page).evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const img = document.querySelector<HTMLImageElement>("[data-testid=image-well] img");
      return {
        long: Math.max(c.width, c.height),
        display: Math.max(img?.naturalWidth ?? 0, img?.naturalHeight ?? 0),
        smooth: getComputedStyle(c).imageRendering,
      };
    });
    expect(sizes.display).toBeGreaterThan(0);
    expect(sizes.long).toBeGreaterThanOrEqual(Math.min(sizes.display, 1024));
    // Smooth edges: the overlay isn't drawn pixelated.
    expect(sizes.smooth).not.toBe("pixelated");
  });

  test("the label reads 'Swatch 3 · 0.5% of the image'", async ({ page }, info) => {
    if (isPhoneProject(info)) {
      // No hover on phones (spec 6.1): the toggle shows the selected swatch, which is swatch 3.
      await page.goto(demo("tab=palette"));
      await demoMapReady(page);
      await expect(label(page)).toHaveText("Swatch 3");
      await openSwatchSheet(page);
      await toggle(page).click();
    } else {
      await page.goto(demo());
      await demoMapReady(page);
      await expect(label(page)).toHaveText("Swatch 3");
      await swatches(page).nth(2).hover();
    }
    await expect(label(page)).toHaveText("Swatch 3 · 0.5% of the image");
    if (!isPhoneProject(info)) {
      // While another swatch's map shows, the label names that swatch and its share.
      await swatches(page).nth(1).hover();
      await expectShareLabel(page, 1);
      await page.mouse.move(0, 0);
      await expect(label(page)).toHaveText("Swatch 3");
    }
  });

  test("Tab focus on a swatch shows it; blur hides it", async ({ page }, info) => {
    await page.goto(demo());
    await demoMapReady(page);
    // WebKit on macOS tabs only to some form controls by default (as in zoom.spec.ts and
    // presets.spec.ts), so there the swatches are focused directly.
    const webkit = info.project.name.includes("webkit");
    await swatches(page).nth(1).focus();
    if (webkit) await swatches(page).nth(2).focus();
    else await page.keyboard.press("Tab");
    await expect(swatches(page).nth(2)).toBeFocused();
    await overlayShows(page, 2);
    if (webkit) await swatches(page).nth(1).focus();
    else await page.keyboard.press("Shift+Tab");
    await expect(swatches(page).nth(1)).toBeFocused();
    await overlayShows(page, 1);
    await swatches(page).nth(1).blur();
    await expect(overlay(page)).toHaveCount(0);
  });

  test("phone: the Cluster map toggle in the Swatch sheet shows the selected swatch's map", async ({
    page,
  }, info) => {
    test.skip(!isPhoneProject(info), "the toggle is in the phone Swatch sheet");
    await page.goto(demo());
    await demoMapReady(page);
    // Tapping a swatch selects it and shows no map: nothing depends on hover (spec 6.1).
    await swatches(page).nth(0).tap();
    await expect(swatches(page).nth(0)).toHaveAttribute("aria-pressed", "true");
    await expect(overlay(page)).toHaveCount(0);
    await tab(page, "Palette");
    await openSwatchSheet(page);
    await expect(toggle(page)).toHaveAttribute("aria-checked", "false");
    await expect(toggle(page)).toHaveAccessibleName("Cluster map");
    await toggle(page).tap();
    await expect(toggle(page)).toHaveAttribute("aria-checked", "true");
    await expectShareLabel(page, 0);
    // Changing the selection changes the map.
    await closeSheet(page);
    await swatches(page).nth(3).tap();
    await expectShareLabel(page, 3);
    await tab(page, "Source");
    await overlayShows(page, 3);
    await tab(page, "Palette");
    await openSwatchSheet(page);
    await toggle(page).tap();
    await expect(toggle(page)).toHaveAttribute("aria-checked", "false");
    await closeSheet(page);
    await expect(label(page)).toHaveText("Swatch 4");
    await tab(page, "Source");
    await expect(overlay(page)).toHaveCount(0);
  });

  test("at zoom 4 centered on (0.769, 0.167), the overlay stays aligned with the patch", async ({
    page,
  }) => {
    await page.goto(demo("cluster=3"));
    await overlayShows(page, 2);
    // Sample colors after the glow-in (decision 61) has settled.
    await page.waitForFunction(() =>
      document.getAnimations().every((a) => a.playState !== "running"),
    );
    const w = well(page);
    await w.focus();
    await page.keyboard.press("+");
    await page.keyboard.press("+");
    await expect(w).toHaveAttribute("data-scale", "4");
    // From the centered (−1.5, −1.5), pan by 10% steps to put the patch near the middle.
    for (let i = 0; i < 11; i += 1) await page.keyboard.press("ArrowRight");
    for (let i = 0; i < 13; i += 1) await page.keyboard.press("ArrowUp");
    const view = await w.evaluate((el) => {
      const d = (el as HTMLElement).dataset;
      const r = el.getBoundingClientRect();
      return {
        scale: Number(d.scale),
        x: Number(d.x),
        y: Number(d.y),
        left: r.left + el.clientLeft,
        top: r.top + el.clientTop,
        width: el.clientWidth,
        height: el.clientHeight,
      };
    });
    // The patch is within 5% of the well's center.
    const patch = { x: view.x + view.scale * PATCH.x, y: view.y + view.scale * PATCH.y };
    expect(Math.abs(patch.x - 0.5)).toBeLessThan(0.05);
    expect(Math.abs(patch.y - 0.5)).toBeLessThan(0.05);

    // The overlay covers exactly the image, which the same layer zooms and pans.
    const image = await w.locator(".image-well__image").boundingBox();
    const over = await overlay(page).boundingBox();
    if (!image || !over) throw new Error("no box");
    for (const k of ["x", "y", "width", "height"] as const) {
      expect(Math.abs(over[k] - image[k]), k).toBeLessThanOrEqual(1);
    }
    expect(image.width).toBeGreaterThan(view.width * 3.9);

    // On screen: the patch shows unchanged, and just outside it the image is dimmed toward gray.
    const at = (fx: number, fy: number) => ({
      x: view.left + (view.x + view.scale * fx) * view.width,
      y: view.top + (view.y + view.scale * fy) * view.height,
    });
    const inside = at(PATCH.x, PATCH.y);
    const outside = at(PATCH.x - 0.05, PATCH.y);
    const shownIn = await colorAt(page, inside.x, inside.y);
    const shownOut = await colorAt(page, outside.x, outside.y);
    await overlay(page).evaluate((el) =>
      (el as HTMLElement).style.setProperty("visibility", "hidden"),
    );
    const bareIn = await colorAt(page, inside.x, inside.y);
    const bareOut = await colorAt(page, outside.x, outside.y);
    for (let c = 0; c < 3; c += 1) {
      expect(Math.abs((shownIn[c] ?? 0) - (bareIn[c] ?? 0)), `inside ${c}`).toBeLessThanOrEqual(3);
      const dimmed = 0.3 * (bareOut[c] ?? 0) + 0.7 * 128;
      expect(Math.abs((shownOut[c] ?? 0) - dimmed), `outside ${c}`).toBeLessThanOrEqual(4);
    }
    // The point inside really is swatch 3's patch, #14386B.
    for (const [c, v] of [20, 56, 107].entries()) {
      expect(Math.abs((bareIn[c] ?? 0) - v), `patch ${c}`).toBeLessThanOrEqual(6);
    }
  });

  test("while extracting, the old map stays dimmed with the palette", async ({ page }, info) => {
    const phone = isPhoneProject(info);
    await page.goto("./");
    await page.getByRole("button", { name: "Load the Dunes sample" }).click();
    await expect(swatches(page)).toHaveCount(6);
    await expect(page.locator("[data-testid=swatch-strip][data-busy]")).toHaveCount(0);
    if (phone) {
      await swatches(page).nth(0).tap();
      await tab(page, "Palette");
      await openSwatchSheet(page);
      await toggle(page).tap();
      await closeSheet(page);
      await tab(page, "Source");
    } else {
      await swatches(page).nth(0).hover();
    }
    await overlayShows(page, 0);
    await page.evaluate(() => {
      const seen: Array<{ strip: boolean; overlay: boolean; busy: boolean }> = [];
      (window as unknown as { __seen: typeof seen }).__seen = seen;
      new MutationObserver(() => {
        const strip = Array.from(document.querySelectorAll("[data-testid=swatch-strip]")).find(
          (el) => (el as HTMLElement).offsetParent !== null,
        );
        const map = document.querySelector("[data-testid=cluster-overlay]");
        seen.push({
          strip: strip?.hasAttribute("data-busy") ?? false,
          overlay: map !== null,
          busy: map?.hasAttribute("data-busy") ?? false,
        });
      }).observe(document.body, { subtree: true, childList: true, attributes: true });
    });
    await page.locator("#setting-colors:visible").fill("5");
    await expect(swatches(page)).toHaveCount(5);
    await expect(page.locator("[data-testid=swatch-strip][data-busy]")).toHaveCount(0);
    const seen = await page.evaluate(
      () =>
        (
          window as unknown as {
            __seen: Array<{ strip: boolean; overlay: boolean; busy: boolean }>;
          }
        ).__seen,
    );
    const during = seen.filter((s) => s.strip);
    expect(during.length).toBeGreaterThan(0);
    for (const s of during) expect(s).toEqual({ strip: true, overlay: true, busy: true });
    await expect(page.locator("[data-testid=cluster-overlay][data-busy]")).toHaveCount(0);
    // The toggle follows the selection, which keeps its place in the new palette.
    if (phone) await overlayShows(page, 0);
  });
});
