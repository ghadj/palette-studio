import { expect, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";
import { fixture } from "./helpers/files";

/**
 * Zoom and pan of the image (spec 6 "Image view", 6.1 "Gestures"; M2 decision 15). The well
 * exposes its view as data attributes: the scale, and the offset as fractions of the well's size.
 */

const well = (page: Page) => page.locator("[data-testid=image-well]:visible").first();
const zoomLevel = (page: Page) => well(page).getByTestId("zoom-level");
const button = (page: Page, name: "Zoom in" | "Zoom out" | "Fit" | "Markers" | "Eyedropper") =>
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

  test("Ctrl + wheel over the image zooms around the pointer; a plain wheel scrolls column 1", async ({
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

    // A plain wheel isn't taken: the view stays and column 1's scroll container scrolls (decision 37).
    const scrolled = () =>
      page.evaluate(() => document.querySelector(".column__scroll")?.scrollTop ?? 0);
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
    // Since M3-T12 the six markers, the Markers toggle and the Eyedropper (M3-T16) come first in the tab order.
    if (!info.project.name.includes("webkit")) {
      for (let n = 1; n <= 6; n += 1) {
        await page.keyboard.press("Tab");
        await expect(well(page).locator(`[data-marker="${n}"]`)).toBeFocused();
      }
      await page.keyboard.press("Tab");
      await expect(button(page, "Markers")).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(button(page, "Eyedropper")).toBeFocused();
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
      // They sit in the well's top-right corner (M3 decision 26).
      const controls = await well(page).getByTestId("zoom-controls").boundingBox();
      const box = await wellBox(page);
      expect((controls?.x ?? 0) + (controls?.width ?? 0)).toBeLessThanOrEqual(box.x + box.width);
      expect(controls?.y ?? 0).toBeGreaterThanOrEqual(box.y);
      expect(controls?.x ?? 0).toBeGreaterThan(box.x + box.width / 2);
      expect((controls?.y ?? 0) + (controls?.height ?? 0)).toBeLessThan(box.y + box.height / 2);
    }
  });
});

/*
 * Touch (spec 6.1 "Gestures", decision 15h). Playwright can drive real touches only in Chromium,
 * through CDP `Input.dispatchTouchEvent`, so the browser's own scrolling and touch-action apply.
 * WebKit gets synthetic pointer events: they exercise the well's handlers but can't scroll the
 * page, so there a page-scroll check is a manual one (plan, "Manual checks").
 */
type TouchPoint = { x: number; y: number };

const isChromiumPhone = (name: string) => name === "phone-chromium";

/** Real touches in Chromium: each entry of `frames` is the list of fingers down at that moment. */
async function cdpTouches(page: Page, frames: TouchPoint[][]): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  let down = 0;
  for (const fingers of frames) {
    const type = down === 0 ? "touchStart" : fingers.length === 0 ? "touchEnd" : "touchMove";
    await cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: fingers.map((p, id) => ({ x: p.x, y: p.y, id })),
    });
    down = fingers.length;
  }
  await cdp.detach();
}

/** Synthetic pointer events on the well, for browsers without touch injection. */
async function pointer(
  page: Page,
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  id: number,
  at: TouchPoint,
): Promise<void> {
  await well(page).evaluate(
    (el, a) =>
      el.dispatchEvent(
        new PointerEvent(a.type, {
          pointerId: a.id,
          pointerType: "touch",
          isPrimary: a.id === 1,
          clientX: a.x,
          clientY: a.y,
          button: a.type === "pointermove" ? -1 : 0,
          buttons: a.type === "pointerdown" || a.type === "pointermove" ? 1 : 0,
          bubbles: true,
          cancelable: true,
        }),
      ),
    { type, id, x: at.x, y: at.y },
  );
}

const nextFrame = (page: Page) =>
  page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));

/** Valid: a finite view, scale 1 to 8, with the image covering the well (offsets in well units). */
function expectValid(v: View): void {
  for (const n of [v.scale, v.x, v.y]) expect(Number.isFinite(n)).toBe(true);
  expect(v.scale).toBeGreaterThanOrEqual(1);
  expect(v.scale).toBeLessThanOrEqual(8);
  expect(v.x).toBeLessThanOrEqual(0);
  expect(v.y).toBeLessThanOrEqual(0);
  expect(v.x).toBeGreaterThanOrEqual(1 - v.scale - 1e-9);
  expect(v.y).toBeGreaterThanOrEqual(1 - v.scale - 1e-9);
}

test.describe("touch gestures (spec 6.1 'Gestures', decision 15h)", () => {
  // A shorter window, so the phone page can scroll.
  test.beforeEach(async ({ page }, info) => {
    test.skip(!isPhoneProject(info), "touch devices");
    await page.setViewportSize({ width: 390, height: 560 });
  });

  test("one-finger drag pans a zoomed image and window.scrollY stays the same", async ({
    page,
  }, info) => {
    await page.goto(demo("zoom=2"));
    await expect(zoomLevel(page)).toHaveText("200%");
    expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(
      true,
    );
    const box = await wellBox(page);
    const start = await view(page);
    const scrollY = await page.evaluate(() => window.scrollY);
    const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const path = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ x: from.x - i * 10, y: from.y - i * 10 }));
    if (isChromiumPhone(info.project.name)) {
      await cdpTouches(page, [...path.map((p) => [p]), []]);
    } else {
      await pointer(page, "pointerdown", 1, path[0] as TouchPoint);
      for (const p of path.slice(1)) await pointer(page, "pointermove", 1, p);
      await pointer(page, "pointerup", 1, path[6] as TouchPoint);
    }
    await expect.poll(async () => (await view(page)).x).toBeLessThan(start.x);
    const end = await view(page);
    expect(end.scale).toBe(2);
    expect(end.x - start.x).toBeCloseTo(-60 / box.width, 2);
    expect(end.y - start.y).toBeCloseTo(-60 / box.height, 2);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  });

  test("at Fit, a one-finger swipe on the image scrolls the page", async ({ page }, info) => {
    await page.goto(demo());
    await expect(zoomLevel(page)).toHaveText("100%");
    await expect(well(page)).toHaveCSS("touch-action", "pan-x pan-y");
    const box = await wellBox(page);
    const from = { x: box.x + box.width / 2, y: box.y + box.height - 10 };
    const path = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ x: from.x, y: from.y - i * 20 }));
    if (isChromiumPhone(info.project.name)) {
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      await cdpTouches(page, [...path.map((p) => [p]), []]);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(50);
    } else {
      // WebKit: the well lets the browser pan (above) and its handlers take nothing at Fit.
      await pointer(page, "pointerdown", 1, path[0] as TouchPoint);
      for (const p of path.slice(1)) await pointer(page, "pointermove", 1, p);
      await pointer(page, "pointerup", 1, path[8] as TouchPoint);
      await nextFrame(page);
    }
    expect(await view(page)).toEqual({ scale: 1, x: 0, y: 0 });
  });

  test("two-finger pinch zooms", async ({ page }, info) => {
    test.skip(!isChromiumPhone(info.project.name), "CDP touch; WebKit pinch is a manual check");
    await page.goto(demo());
    const box = await wellBox(page);
    const mid = { x: box.x + box.width * 0.4, y: box.y + box.height * 0.5 };
    const fingers = (half: number): TouchPoint[] => [
      { x: mid.x - half, y: mid.y },
      { x: mid.x + half, y: mid.y },
    ];
    // 60 px apart to 180 px apart: about 300%, about the midpoint.
    await cdpTouches(page, [fingers(30), fingers(45), fingers(60), fingers(75), fingers(90), []]);
    await expect.poll(async () => (await view(page)).scale).toBeGreaterThan(2.5);
    const v = await view(page);
    expect(v.scale).toBeCloseTo(3, 1);
    const anchor = { x: 0.4, y: 0.5 };
    const under = imagePointUnder(v, anchor);
    expect(under.x).toBeCloseTo(0.4, 2);
    expect(under.y).toBeCloseTo(0.5, 2);
    await expect(zoomLevel(page)).toHaveText(`${Math.round(v.scale * 100)}%`);
  });

  test("pointercancel mid-gesture leaves a valid view", async ({ page }) => {
    await page.goto(demo("zoom=2"));
    const box = await wellBox(page);
    const c = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    // One finger: pan, then cancel. The last view stays.
    await pointer(page, "pointerdown", 1, c);
    await pointer(page, "pointermove", 1, { x: c.x - 40, y: c.y });
    await pointer(page, "pointercancel", 1, { x: c.x - 40, y: c.y });
    const afterPan = await view(page);
    expectValid(afterPan);
    expect(afterPan.x).toBeCloseTo(-0.5 - 40 / box.width, 3);
    // A move after the cancel belongs to no gesture.
    await pointer(page, "pointermove", 1, { x: c.x - 120, y: c.y });
    await nextFrame(page);
    expect(await view(page)).toEqual(afterPan);
    // Two fingers: pinch out, then cancel mid-pinch.
    await pointer(page, "pointerdown", 1, { x: c.x - 30, y: c.y });
    await pointer(page, "pointerdown", 2, { x: c.x + 30, y: c.y });
    await pointer(page, "pointermove", 2, { x: c.x + 90, y: c.y });
    await pointer(page, "pointercancel", 1, { x: c.x - 30, y: c.y });
    const afterPinch = await view(page);
    expectValid(afterPinch);
    expect(afterPinch.scale).toBeGreaterThan(afterPan.scale);
    await pointer(page, "pointermove", 2, { x: c.x + 150, y: c.y });
    await nextFrame(page);
    expect(await view(page)).toEqual(afterPinch);
  });

  test("the well has touch-action pan-x pan-y at Fit and none when zoomed; the callout is off", async ({
    page,
  }) => {
    await page.goto(demo());
    const image = well(page).locator("img");
    const styles = () =>
      well(page).evaluate((el) => {
        const img = el.querySelector("img") as HTMLElement;
        const s = getComputedStyle(el);
        return {
          well: s.touchAction,
          image: getComputedStyle(img).touchAction,
          userSelect: s.userSelect || s.getPropertyValue("-webkit-user-select"),
          imageUserSelect:
            getComputedStyle(img).userSelect ||
            getComputedStyle(img).getPropertyValue("-webkit-user-select"),
        };
      });
    await expect(image).toBeVisible();
    let s = await styles();
    expect([s.well, s.image]).toEqual(["pan-x pan-y", "pan-x pan-y"]);
    expect([s.userSelect, s.imageUserSelect]).toEqual(["none", "none"]);
    // -webkit-touch-callout is iOS only: no desktop engine Playwright runs computes it, so check
    // the shipped style sheet declares it on the well and on the image.
    const css = await page.evaluate(async () => {
      const hrefs = [...document.styleSheets].map((sheet) => sheet.href).filter(Boolean);
      const texts = await Promise.all(
        hrefs.map((href) => fetch(href as string).then((r) => r.text())),
      );
      return texts.join("\n");
    });
    for (const selector of [".image-well--image", ".image-well__image"]) {
      const rule = new RegExp(
        `${selector.replace(".", "\\.")}\\s*\\{[^}]*-webkit-touch-callout:\\s*none`,
      );
      expect(css, selector).toMatch(rule);
    }
    await button(page, "Zoom in").click();
    await expect(zoomLevel(page)).toHaveText("200%");
    s = await styles();
    expect([s.well, s.image]).toEqual(["none", "none"]);
    await button(page, "Fit").click();
    await expect(well(page)).toHaveCSS("touch-action", "pan-x pan-y");
  });
});
