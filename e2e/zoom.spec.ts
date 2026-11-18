import { expect, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";
import { fixture } from "./helpers/files";

/**
 * Zoom and pan of the image (spec 6 "Image view", 6.1 "Gestures"; M2 decision 15). The well
 * exposes its view as data attributes: the scale, and the offset as fractions of the well's size.
 */

const well = (page: Page) => page.locator("[data-testid=image-well]:visible").first();
const zoomLevel = (page: Page) => well(page).getByTestId("zoom-level");
const button = (page: Page, name: "Zoom in" | "Zoom out" | "Fit") =>
  well(page).getByRole("button", { name, exact: true });

interface View {
  scale: number;
  x: number;
  y: number;
}

async function view(page: Page): Promise<View> {
  return well(page).evaluate((el) => {
    const d = (el as HTMLElement).dataset;
    return { scale: Number(d.scale), x: Number(d.x), y: Number(d.y) };
  });
}

/** The well's content box in page pixels. */
async function wellBox(page: Page) {
  return well(page).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      x: r.left + el.clientLeft,
      y: r.top + el.clientTop,
      width: el.clientWidth,
      height: el.clientHeight,
    };
  });
}

/** The image point (fractions of the image) under a point given in fractions of the well. */
const imagePointUnder = (v: View, p: { x: number; y: number }) => ({
  x: (p.x - v.x) / v.scale,
  y: (p.y - v.y) / v.scale,
});

async function loadSample(page: Page, name: string) {
  const replace = page.locator("header").getByRole("button", { name: "Replace image" });
  if (await replace.isVisible()) await replace.click();
  await page.getByRole("button", { name: `Load the ${name} sample` }).click();
  await expect(page.locator("[data-testid=image-well] canvas:visible")).toHaveAttribute(
    "aria-label",
    `Source image, ${name}.png`,
  );
}

const paletteSettled = async (page: Page) => {
  await expect(
    page.locator("[data-testid=swatch-strip]:visible").first().locator("[data-swatch]").first(),
  ).toBeVisible();
  await expect(page.locator("[data-testid=swatch-strip][data-busy]")).toHaveCount(0);
};

test.describe("zoom and pan (spec 6 'Image view', decision 15)", () => {
  test("Zoom in twice gives 400% and the label says so; Fit returns to 100%", async ({ page }) => {
    await page.goto(demo());
    await expect(zoomLevel(page)).toHaveText("100%");
    await expect(button(page, "Zoom out")).toBeDisabled();
    await button(page, "Zoom in").click();
    await expect(zoomLevel(page)).toHaveText("200%");
    await button(page, "Zoom in").click();
    await expect(zoomLevel(page)).toHaveText("400%");
    await expect(zoomLevel(page)).toHaveAttribute("role", "status");
    expect((await view(page)).scale).toBe(4);
    // Button zoom keeps the image centered.
    expect(await view(page)).toEqual({ scale: 4, x: -1.5, y: -1.5 });
    await button(page, "Zoom in").click();
    await expect(zoomLevel(page)).toHaveText("800%");
    await expect(button(page, "Zoom in")).toBeDisabled();
    // aria-disabled keeps it focusable; activating it does nothing.
    await button(page, "Zoom in").focus();
    await page.keyboard.press("Enter");
    await expect(button(page, "Zoom in")).toBeFocused();
    await expect(zoomLevel(page)).toHaveText("800%");
    await button(page, "Zoom out").click();
    await expect(zoomLevel(page)).toHaveText("400%");
    await button(page, "Fit").click();
    await expect(zoomLevel(page)).toHaveText("100%");
    expect(await view(page)).toEqual({ scale: 1, x: 0, y: 0 });
    await expect(button(page, "Zoom out")).toBeDisabled();
    await expect(button(page, "Zoom in")).toBeEnabled();
  });

  test("Ctrl + wheel over the image zooms around the pointer; a plain wheel scrolls the page", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "desktop wheel");
    // At the desktop minimum height the columns scroll inside the window (fix L3, L4).
    await page.setViewportSize({ width: 1280, height: 640 });
    await page.goto(demo());
    await page.evaluate(() => {
      const seen: boolean[] = [];
      (window as unknown as { __wheel: boolean[] }).__wheel = seen;
      window.addEventListener("wheel", (e) => seen.push(e.defaultPrevented));
    });
    const box = await wellBox(page);
    const anchor = { x: 0.25, y: 0.3 };
    await page.mouse.move(box.x + box.width * anchor.x, box.y + box.height * anchor.y);
    const before = imagePointUnder(await view(page), anchor);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -100);
    await page.keyboard.up("Control");
    await expect.poll(async () => (await view(page)).scale).toBeGreaterThan(1.5);
    const zoomed = await view(page);
    const after = imagePointUnder(zoomed, anchor);
    // Within 0.5% of the image: the browser rounds the pointer to whole pixels.
    expect(after.x).toBeCloseTo(before.x, 2);
    expect(after.y).toBeCloseTo(before.y, 2);
    await expect(zoomLevel(page)).toHaveText(`${Math.round(zoomed.scale * 100)}%`);

    // A plain wheel isn't taken: the view stays and the column scrolls.
    const scrolled = () =>
      page.evaluate(
        () =>
          (document.scrollingElement?.scrollTop ?? 0) +
          (document.querySelector(".columns")?.scrollTop ?? 0),
      );
    const top = await scrolled();
    await page.mouse.wheel(0, 120);
    await expect.poll(scrolled).toBeGreaterThan(top);
    expect(await view(page)).toEqual(zoomed);
    expect(
      await page.evaluate(() => (window as unknown as { __wheel: boolean[] }).__wheel),
    ).toEqual([true, false]);
  });

  test("drag pans when zoomed and does nothing at Fit", async ({ page }, info) => {
    test.skip(isPhoneProject(info), "mouse drag");
    await page.goto(demo());
    const box = await wellBox(page);
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const drag = async (dx: number, dy: number) => {
      await page.mouse.move(center.x, center.y);
      await page.mouse.down();
      await page.mouse.move(center.x + dx / 2, center.y + dy / 2);
      await page.mouse.move(center.x + dx, center.y + dy);
      await page.mouse.up();
    };
    await drag(-80, -40);
    expect(await view(page)).toEqual({ scale: 1, x: 0, y: 0 });

    await button(page, "Zoom in").click();
    const start = await view(page);
    await drag(-80, -40);
    const end = await view(page);
    expect(end.scale).toBe(2);
    expect(end.x - start.x).toBeCloseTo(-80 / box.width, 3);
    expect(end.y - start.y).toBeCloseTo(-40 / box.height, 3);
    // Panning stops at the image's edge, so the image always covers the well. The drag stays
    // inside the window, where every browser reports the pointer.
    await drag(box.width, box.height);
    expect(await view(page)).toEqual({ scale: 2, x: 0, y: 0 });
  });

  test("keyboard: focus the image, + zooms, arrows pan, 0 fits", async ({ page }, info) => {
    await page.goto(demo());
    await well(page).focus();
    await expect(well(page)).toBeFocused();
    await expect(well(page)).toHaveAttribute("aria-describedby", "image-view-keys");
    await page.keyboard.press("+");
    await expect(zoomLevel(page)).toHaveText("200%");
    expect(await view(page)).toEqual({ scale: 2, x: -0.5, y: -0.5 });
    // Arrows pan by 10% of the visible area: ArrowRight shows more of the right side.
    await page.keyboard.press("ArrowRight");
    expect(await view(page)).toEqual({ scale: 2, x: -0.6, y: -0.5 });
    await page.keyboard.press("ArrowUp");
    expect(await view(page)).toEqual({ scale: 2, x: -0.6, y: -0.4 });
    await page.keyboard.press("-");
    await expect(zoomLevel(page)).toHaveText("100%");
    await page.keyboard.press("+");
    await page.keyboard.press("+");
    await expect(zoomLevel(page)).toHaveText("400%");
    await page.keyboard.press("0");
    await expect(zoomLevel(page)).toHaveText("100%");
    expect(await view(page)).toEqual({ scale: 1, x: 0, y: 0 });
    // The zoom buttons are reachable with Tab from the image. WebKit on macOS tabs only to form
    // fields by default, so it is checked in the other browsers.
    if (!info.project.name.includes("webkit")) {
      await page.keyboard.press("Tab");
      await expect(button(page, "Zoom out")).toBeFocused();
    }
  });

  test("zooming never re-runs extraction (job count unchanged)", async ({ page }, info) => {
    await page.addInitScript(() => {
      const sent: string[] = [];
      (window as unknown as { __sent: string[] }).__sent = sent;
      const post = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (this: Worker, message: unknown, ...rest: unknown[]) {
        const type = (message as { type?: string } | null)?.type;
        if (type) sent.push(type);
        return (post as (...args: unknown[]) => void).call(this, message, ...rest);
      };
    });
    await page.goto("./");
    await loadSample(page, "Orbits");
    await paletteSettled(page);
    const extracts = () =>
      page.evaluate(
        () =>
          (window as unknown as { __sent: string[] }).__sent.filter((t) => t === "extract").length,
      );
    const before = await extracts();
    expect(before).toBeGreaterThan(0);
    await button(page, "Zoom in").click();
    await button(page, "Zoom in").click();
    await well(page).focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("-");
    if (!isPhoneProject(info)) {
      const box = await wellBox(page);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 - 50, box.y + box.height / 2);
      await page.mouse.up();
      await page.keyboard.down("Control");
      await page.mouse.wheel(0, -60);
      await page.keyboard.up("Control");
    }
    await button(page, "Fit").click();
    // Longer than the settings debounce (120 ms), so a stray re-extraction would have started.
    await page.waitForTimeout(400);
    expect(await extracts()).toBe(before);
    await expect(page.locator("[data-testid=swatch-strip][data-busy]")).toHaveCount(0);
  });

  test("loading a new image resets to Fit", async ({ page }) => {
    await page.goto("./");
    await loadSample(page, "Orbits");
    await button(page, "Zoom in").click();
    await button(page, "Zoom in").click();
    await expect(zoomLevel(page)).toHaveText("400%");
    await page.getByTestId("file-input").setInputFiles(fixture("two-color.png"));
    await expect(page.locator("[data-testid=image-well] canvas:visible")).toHaveAttribute(
      "aria-label",
      "Source image, two-color.png",
    );
    await expect(zoomLevel(page)).toHaveText("100%");
    expect(await view(page)).toEqual({ scale: 1, x: 0, y: 0 });
  });

  test("zoom isn't written to storage and isn't in the URL", async ({ page }) => {
    await page.goto("./");
    await loadSample(page, "Tiles");
    const snapshot = () =>
      page.evaluate(() => ({
        local: JSON.stringify(Object.entries(localStorage).sort()),
        session: JSON.stringify(Object.entries(sessionStorage).sort()),
        url: window.location.href,
      }));
    const before = await snapshot();
    await button(page, "Zoom in").click();
    await well(page).focus();
    await page.keyboard.press("ArrowDown");
    await expect(zoomLevel(page)).toHaveText("200%");
    expect(await snapshot()).toEqual(before);
    await page.reload();
    await expect(page.locator("#app-root")).toBeVisible();
    // Nothing remembers the zoom, so the reloaded page is back to the first screen.
    await expect(page.locator("[data-testid=image-well] [data-testid=zoom-level]")).toHaveCount(0);
  });

  test("zoom controls are at least 44 × 44 at phone width", async ({ page }) => {
    for (const size of [
      { width: 320, height: 568 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await page.goto(demo());
      for (const name of ["Zoom out", "Zoom in", "Fit"] as const) {
        const b = await button(page, name).boundingBox();
        expect(b, name).not.toBeNull();
        expect(b?.width ?? 0, name).toBeGreaterThanOrEqual(44);
        expect(b?.height ?? 0, name).toBeGreaterThanOrEqual(44);
      }
      // They sit in the well's bottom-right corner.
      const controls = await well(page).getByTestId("zoom-controls").boundingBox();
      const box = await wellBox(page);
      expect((controls?.x ?? 0) + (controls?.width ?? 0)).toBeLessThanOrEqual(box.x + box.width);
      expect((controls?.y ?? 0) + (controls?.height ?? 0)).toBeLessThanOrEqual(box.y + box.height);
      expect(controls?.x ?? 0).toBeGreaterThan(box.x + box.width / 2);
      expect(controls?.y ?? 0).toBeGreaterThan(box.y + box.height / 2);
    }
  });
});
