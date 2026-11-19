import { expect, type Locator, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";
import { fixture } from "./helpers/files";

/**
 * Dragging markers with a mouse, a finger and the keyboard (M3-T15; spec 3.7, 6.1 "Gestures";
 * plan D9, D10, D16). Chromium phones get real touches through CDP, so the browser's own
 * touch-action and scrolling apply. WebKit gets synthetic pointer events, which exercise the
 * handlers but can't scroll the page (a manual check, as in zoom.spec.ts).
 */

/** The fixture's points (src/state/mockup-fixture.ts), in swatch order. */
const POINTS = [
  { x: 0.204, y: 0.519 },
  { x: 0.463, y: 0.241 },
  { x: 0.769, y: 0.167 },
  { x: 0.38, y: 0.796 },
  { x: 0.889, y: 0.778 },
  { x: 0.102, y: 0.185 },
];

type Pt = { x: number; y: number };

const marker = (page: Page, n: number) => page.locator(`[data-marker="${n}"]`);
const well = (page: Page) => page.locator("[data-testid=image-well]:visible").first();
const image = (page: Page) => page.locator(".image-well__image:visible").first();
const swatch = (page: Page, n: number) =>
  page
    .locator("[data-testid=swatch-strip]:visible")
    .first()
    .locator("[data-swatch]")
    .nth(n - 1);
const hexOf = async (page: Page, n: number) =>
  ((await swatch(page, n).getAttribute("aria-label")) ?? "").split(", ")[1];
const headerButton = (page: Page, name: string | RegExp) =>
  page.locator("header").getByRole("button", { name });

async function center(locator: Locator): Promise<Pt> {
  const b = await locator.boundingBox();
  if (!b) throw new Error("no box");
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Where an image point is on screen. */
async function onScreen(page: Page, p: Pt): Promise<Pt> {
  const b = await image(page).boundingBox();
  if (!b) throw new Error("no image box");
  return { x: b.x + p.x * b.width, y: b.y + p.y * b.height };
}

/** A marker's image point: where it sits in the well (fractions), undone through the view. */
async function pointOf(page: Page, n: number): Promise<Pt> {
  const v = await view(page);
  const at = await marker(page, n).evaluate((el) => {
    const s = (el as HTMLElement).style;
    return { x: Number.parseFloat(s.left) / 100, y: Number.parseFloat(s.top) / 100 };
  });
  return { x: (at.x - v.x) / v.scale, y: (at.y - v.y) / v.scale };
}

async function view(page: Page) {
  return well(page).evaluate((el) => {
    const d = (el as HTMLElement).dataset;
    return { scale: Number(d.scale), x: Number(d.x), y: Number(d.y) };
  });
}

const path = (from: Pt, to: Pt, steps: number): Pt[] =>
  Array.from({ length: steps + 1 }, (_, i) => ({
    x: from.x + ((to.x - from.x) * i) / steps,
    y: from.y + ((to.y - from.y) * i) / steps,
  }));

async function cdpTouches(page: Page, frames: Array<{ type: string; fingers: Pt[] }>) {
  const cdp = await page.context().newCDPSession(page);
  for (const frame of frames) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: frame.type as "touchStart",
      touchPoints: frame.fingers.map((p, id) => ({ x: p.x, y: p.y, id })),
    });
  }
  await cdp.detach();
}

type PointerType = "pointerdown" | "pointermove" | "pointerup" | "pointercancel";

/** A synthetic touch pointer event on an element. */
async function fire(target: Locator, type: PointerType, id: number, at: Pt, kind = "touch") {
  await target.evaluate(
    (el, a) =>
      el.dispatchEvent(
        new PointerEvent(a.type, {
          pointerId: a.id,
          pointerType: a.kind,
          isPrimary: a.id === 1,
          clientX: a.x,
          clientY: a.y,
          button: a.type === "pointermove" ? -1 : 0,
          buttons: a.type === "pointerdown" || a.type === "pointermove" ? 1 : 0,
          bubbles: true,
          cancelable: true,
        }),
      ),
    { type, id, kind, x: at.x, y: at.y },
  );
}

/**
 * Drags marker `n` to a point on screen with the project's pointer: the mouse on desktop, real
 * touches on Chromium phones, synthetic touch events in WebKit.
 */
async function dragMarker(page: Page, project: string, n: number, to: Pt) {
  const from = await center(marker(page, n).locator(".marker__ring"));
  const steps = path(from, to, 12);
  if (project === "phone-chromium") {
    await cdpTouches(page, [
      { type: "touchStart", fingers: [from] },
      ...steps.slice(1).map((p) => ({ type: "touchMove", fingers: [p] })),
      { type: "touchEnd", fingers: [] },
    ]);
  } else if (project === "phone-webkit") {
    const el = marker(page, n);
    await fire(el, "pointerdown", 1, from);
    for (const p of steps.slice(1)) await fire(el, "pointermove", 1, p);
    await fire(el, "pointerup", 1, to);
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (const p of steps.slice(1)) await page.mouse.move(p.x, p.y);
    await page.mouse.up();
  }
}

test.describe("dragging a marker (spec 3.7)", () => {
  test("dragging marker 3 onto patch 5 makes swatch 3 #1E8A2E, picked and locked; Undo restores it all", async ({
    page,
  }, info) => {
    await page.goto(demo());
    const before = {
      hex: await hexOf(page, 3),
      origin: await swatch(page, 3).getAttribute("data-origin"),
      point: await pointOf(page, 3),
    };
    expect(before.hex).toBe("#14386B");
    await expect(headerButton(page, /^Undo/).first()).toBeDisabled();

    await dragMarker(page, info.project.name, 3, await onScreen(page, POINTS[4] as Pt));

    await expect.poll(() => hexOf(page, 3)).toBe("#1E8A2E");
    await expect(swatch(page, 3)).toHaveAttribute("data-origin", "picked");
    const point = await pointOf(page, 3);
    expect(point.x).toBeCloseTo(0.889, 2);
    expect(point.y).toBeCloseTo(0.778, 2);
    await expect(marker(page, 3)).toHaveAttribute("aria-label", "Swatch 3 marker, 89%, 78%");
    await expect(page.getByTestId("loupe")).toHaveCount(0);
    if (!isPhoneProject(info)) {
      // Locked: the Lock pill of the selected swatch (swatch 3 is selected, and stays so).
      await expect(page.getByRole("button", { name: "Lock", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }

    // One drag is one undo step.
    await headerButton(page, "Undo Move marker").click();
    await expect.poll(() => hexOf(page, 3)).toBe(before.hex);
    await expect(swatch(page, 3)).toHaveAttribute("data-origin", before.origin ?? "");
    const back = await pointOf(page, 3);
    expect(back.x).toBeCloseTo(before.point.x, 5);
    expect(back.y).toBeCloseTo(before.point.y, 5);
    if (!isPhoneProject(info)) {
      await expect(page.getByRole("button", { name: "Lock", exact: true })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }
    await expect(headerButton(page, /^Undo/).first()).toBeDisabled();
    await headerButton(page, "Redo Move marker").click();
    await expect.poll(() => hexOf(page, 3)).toBe("#1E8A2E");
  });

  test("while dragging, the loupe shows the live HEX; a click without moving only selects", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "mouse");
    await page.goto(demo());
    const from = await center(marker(page, 3).locator(".marker__ring"));
    const to = await onScreen(page, POINTS[4] as Pt);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (const p of path(from, to, 10).slice(1)) await page.mouse.move(p.x, p.y);
    const loupe = page.getByTestId("loupe");
    await expect(loupe).toContainText("#1E8A2E");
    await expect(loupe.locator("canvas")).toBeVisible();
    await expect(marker(page, 3)).toHaveAttribute("data-dragging", "");
    await page.mouse.up();
    await expect(loupe).toHaveCount(0);
    await expect(marker(page, 3)).not.toHaveAttribute("data-dragging", "");

    // A click on marker 2 selects it and changes nothing.
    await page.goto(demo());
    const c = await center(marker(page, 2).locator(".marker__ring"));
    await page.mouse.click(c.x, c.y);
    await expect(marker(page, 2)).toHaveAttribute("aria-pressed", "true");
    await expect(headerButton(page, /^Undo/).first()).toBeDisabled();
    expect(await hexOf(page, 2)).toBe("#1DB07A");
  });

  test("Esc mid-drag restores everything and records no step", async ({ page }, info) => {
    test.skip(isPhoneProject(info), "keyboard and mouse");
    await page.goto(demo());
    const from = await center(marker(page, 3).locator(".marker__ring"));
    const to = await onScreen(page, POINTS[4] as Pt);
    const startPoint = await pointOf(page, 3);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (const p of path(from, to, 10).slice(1)) await page.mouse.move(p.x, p.y);
    await expect.poll(() => hexOf(page, 3)).toBe("#1E8A2E");
    await page.keyboard.press("Escape");
    await expect.poll(() => hexOf(page, 3)).toBe("#14386B");
    await expect(page.getByTestId("loupe")).toHaveCount(0);
    await expect(swatch(page, 3)).not.toHaveAttribute("data-origin", "picked");
    // The pointer is still down; moving on doesn't drag anything.
    await page.mouse.move(to.x - 80, to.y - 40);
    await page.mouse.up();
    const after = await pointOf(page, 3);
    expect(after.x).toBeCloseTo(startPoint.x, 5);
    expect(after.y).toBeCloseTo(startPoint.y, 5);
    expect(await hexOf(page, 3)).toBe("#14386B");
    await expect(headerButton(page, /^Undo/).first()).toBeDisabled();
  });

  test("pointercancel mid-drag restores", async ({ page }, info) => {
    await page.goto(demo());
    const el = marker(page, 3);
    const from = await center(el.locator(".marker__ring"));
    const to = await onScreen(page, POINTS[4] as Pt);
    const kind = isPhoneProject(info) ? "touch" : "mouse";
    await fire(el, "pointerdown", 1, from, kind);
    for (const p of path(from, to, 6).slice(1)) await fire(el, "pointermove", 1, p, kind);
    await expect(el).toHaveAttribute("data-dragging", "");
    await expect.poll(() => hexOf(page, 3)).toBe("#1E8A2E");
    await fire(el, "pointercancel", 1, to, kind);
    await expect.poll(() => hexOf(page, 3)).toBe("#14386B");
    await expect(el).not.toHaveAttribute("data-dragging", "");
    await expect(page.getByTestId("loupe")).toHaveCount(0);
    // A late move belongs to no drag.
    await fire(el, "pointermove", 1, { x: to.x - 50, y: to.y }, kind);
    await page.waitForTimeout(200);
    const p = await pointOf(page, 3);
    expect(p.x).toBeCloseTo(0.769, 5);
    expect(await hexOf(page, 3)).toBe("#14386B");
    await expect(headerButton(page, /^Undo/).first()).toBeDisabled();
  });

  test("a second finger cancels the drag and the two pinch", async ({ page }) => {
    await page.goto(demo());
    const el = marker(page, 3);
    const w = well(page);
    const from = await center(el.locator(".marker__ring"));
    const kind = "touch";
    await fire(el, "pointerdown", 1, from, kind);
    for (const p of path(from, { x: from.x - 40, y: from.y + 30 }, 4).slice(1)) {
      await fire(el, "pointermove", 1, p, kind);
    }
    await expect(el).toHaveAttribute("data-dragging", "");
    const finger1 = { x: from.x - 40, y: from.y + 30 };
    // The second finger lands on the well.
    const box = await w.boundingBox();
    if (!box) throw new Error("no box");
    const finger2 = { x: box.x + box.width * 0.3, y: box.y + box.height * 0.6 };
    await fire(w, "pointerdown", 2, finger2, kind);
    await expect(el).not.toHaveAttribute("data-dragging", "");
    await expect.poll(() => hexOf(page, 3)).toBe("#14386B");
    expect((await pointOf(page, 3)).x).toBeCloseTo(0.769, 5);
    await expect(headerButton(page, /^Undo/).first()).toBeDisabled();
    // Both fingers now belong to the pinch: spreading them zooms.
    expect((await view(page)).scale).toBe(1);
    for (let i = 1; i <= 6; i += 1) {
      await fire(w, "pointermove", 2, { x: finger2.x - i * 10, y: finger2.y + i * 8 }, kind);
    }
    await expect.poll(async () => (await view(page)).scale).toBeGreaterThan(1.2);
    await fire(w, "pointerup", 1, finger1, kind);
    await fire(w, "pointerup", 2, finger2, kind);
    // Nothing was committed.
    await expect(headerButton(page, /^Undo/).first()).toBeDisabled();
    expect(await hexOf(page, 3)).toBe("#14386B");
  });

  test("Chromium touch: a second real finger cancels the drag and pinches", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "phone-chromium", "CDP touch");
    await page.goto(demo());
    const from = await center(marker(page, 3).locator(".marker__ring"));
    const box = await well(page).boundingBox();
    if (!box) throw new Error("no box");
    const f2 = { x: box.x + box.width * 0.3, y: box.y + box.height * 0.6 };
    const moved = { x: from.x - 40, y: from.y + 30 };
    await cdpTouches(page, [
      { type: "touchStart", fingers: [from] },
      ...path(from, moved, 4)
        .slice(1)
        .map((p) => ({ type: "touchMove", fingers: [p] })),
      { type: "touchStart", fingers: [moved, f2] },
      ...[1, 2, 3, 4, 5, 6].map((i) => ({
        type: "touchMove",
        fingers: [moved, { x: f2.x - i * 12, y: f2.y + i * 10 }],
      })),
      { type: "touchEnd", fingers: [] },
    ]);
    await expect.poll(async () => (await view(page)).scale).toBeGreaterThan(1.2);
    expect(await hexOf(page, 3)).toBe("#14386B");
    expect((await pointOf(page, 3)).x).toBeCloseTo(0.769, 5);
    await expect(headerButton(page, /^Undo/).first()).toBeDisabled();
  });
});

test.describe("keyboard (spec 3.7, plan D9)", () => {
  test("ArrowRight ×10 moves x by 10 master px (0.00625) and announces the HEX; each is a step", async ({
    page,
  }) => {
    await page.goto(demo());
    const start = await pointOf(page, 3);
    await marker(page, 3).focus();
    for (let i = 0; i < 10; i += 1) await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => (await pointOf(page, 3)).x, { timeout: 10_000 })
      .toBeCloseTo(start.x + 0.00625, 5);
    const end = await pointOf(page, 3);
    expect(end.y).toBeCloseTo(start.y, 5);
    await expect(page.getByTestId("marker-status")).toHaveText(
      /^Swatch 3 marker moved, #[0-9A-F]{6}$/,
    );
    // The swatch is locked now, and the marker's name has the new position.
    await expect(swatch(page, 3)).toHaveAttribute("data-origin", "picked");
    await expect(marker(page, 3)).toHaveAttribute("aria-label", /^Swatch 3 marker, 78%, 17%$/);

    // Ten nudges are ten steps: ten Undos bring it back, and then Undo is off.
    for (let i = 0; i < 10; i += 1) await headerButton(page, "Undo Move marker").click();
    await expect(headerButton(page, /^Undo/).first()).toBeDisabled();
    const back = await pointOf(page, 3);
    expect(back.x).toBeCloseTo(start.x, 5);
    await expect(swatch(page, 3)).not.toHaveAttribute("data-origin", "picked");
  });

  test("Shift+arrow moves 10 px, and the page and the image don't pan", async ({ page }) => {
    await page.goto(demo());
    const start = await pointOf(page, 1);
    await marker(page, 1).focus();
    await page.keyboard.press("Shift+ArrowDown");
    await page.keyboard.press("ArrowLeft");
    await expect
      .poll(async () => (await pointOf(page, 1)).y, { timeout: 10_000 })
      .toBeCloseTo(start.y + 10 / 800, 5);
    expect((await pointOf(page, 1)).x).toBeCloseTo(start.x - 1 / 1600, 5);
    expect(await view(page)).toEqual({ scale: 1, x: 0, y: 0 });
  });

  test("at zoom, arrows on a marker nudge it and leave the view alone", async ({ page }) => {
    await page.goto(demo("zoom=4"));
    const w = well(page);
    await expect(w).toHaveAttribute("data-scale", "4");
    const target = await page.evaluate(() => {
      // The marker nearest the middle of the well.
      const box = document.querySelector("[data-testid=image-well]")?.getBoundingClientRect();
      if (!box) return 0;
      let best = 0;
      let bestD = Number.POSITIVE_INFINITY;
      for (const el of document.querySelectorAll("[data-marker]")) {
        const r = el.getBoundingClientRect();
        const d = Math.hypot(
          r.left + r.width / 2 - (box.left + box.width / 2),
          r.top + r.height / 2 - (box.top + box.height / 2),
        );
        if (d < bestD) {
          bestD = d;
          best = Number(el.getAttribute("data-marker"));
        }
      }
      return best;
    });
    const before = await view(page);
    const p = await pointOf(page, target);
    await marker(page, target).focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(async () => (await pointOf(page, target)).x).toBeGreaterThan(p.x);
    expect(await view(page)).toEqual(before);
  });
});

test.describe("touch (spec 6.1 'Gestures', M2 decision 15h)", () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(!isPhoneProject(info), "touch devices");
    // A shorter window, so the phone page can scroll.
    await page.setViewportSize({ width: 390, height: 560 });
  });

  test("at Fit, dragging a marker leaves window.scrollY unchanged, while a swipe elsewhere scrolls", async ({
    page,
  }, info) => {
    await page.goto(demo());
    expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(
      true,
    );
    // Drag marker 3 down and left with a finger.
    const from = await center(marker(page, 3).locator(".marker__ring"));
    const to = { x: from.x - 60, y: from.y + 80 };
    const scrollY = await page.evaluate(() => window.scrollY);
    const el = marker(page, 3);
    const steps = path(from, to, 10);
    if (info.project.name === "phone-chromium") {
      await cdpTouches(page, [
        { type: "touchStart", fingers: [from] },
        ...steps.slice(1).map((p) => ({ type: "touchMove", fingers: [p] })),
        { type: "touchEnd", fingers: [] },
      ]);
    } else {
      await fire(el, "pointerdown", 1, from);
      for (const p of steps.slice(1)) await fire(el, "pointermove", 1, p);
      await fire(el, "pointerup", 1, to);
    }
    await expect(swatch(page, 3)).toHaveAttribute("data-origin", "picked");
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
    const moved = await pointOf(page, 3);
    expect(moved.x).toBeLessThan(0.769);
    expect(moved.y).toBeGreaterThan(0.167);
    expect(await view(page)).toEqual({ scale: 1, x: 0, y: 0 });

    if (info.project.name === "phone-chromium") {
      // A swipe elsewhere on the image scrolls the page.
      const box = await well(page).boundingBox();
      if (!box) throw new Error("no box");
      const start = { x: box.x + box.width * 0.62, y: box.y + box.height - 10 };
      const swipe = path(start, { x: start.x, y: start.y - 160 }, 8);
      await cdpTouches(page, [
        { type: "touchStart", fingers: [start] },
        ...swipe.slice(1).map((p) => ({ type: "touchMove", fingers: [p] })),
        { type: "touchEnd", fingers: [] },
      ]);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(50);
    }
  });

  test("at zoom 2, one finger on a marker drags it, and elsewhere it pans", async ({
    page,
  }, info) => {
    await page.goto(demo("zoom=2"));
    // Pan the image so marker 1 is on screen: three presses of ArrowLeft.
    await well(page).focus();
    for (let i = 0; i < 3; i += 1) await page.keyboard.press("ArrowLeft");
    await expect.poll(async () => (await view(page)).x).toBeCloseTo(-0.2, 3);
    const v0 = await view(page);
    const from = await center(marker(page, 1).locator(".marker__ring"));
    const to = { x: from.x + 50, y: from.y + 20 };
    const p0 = await pointOf(page, 1);
    const steps = path(from, to, 8);
    const el = marker(page, 1);
    if (info.project.name === "phone-chromium") {
      await cdpTouches(page, [
        { type: "touchStart", fingers: [from] },
        ...steps.slice(1).map((p) => ({ type: "touchMove", fingers: [p] })),
        { type: "touchEnd", fingers: [] },
      ]);
    } else {
      await fire(el, "pointerdown", 1, from);
      for (const p of steps.slice(1)) await fire(el, "pointermove", 1, p);
      await fire(el, "pointerup", 1, to);
    }
    await expect(swatch(page, 1)).toHaveAttribute("data-origin", "picked");
    // The marker moved (to the right and down on screen), and the view did not.
    const p1 = await pointOf(page, 1);
    expect(p1.x).toBeGreaterThan(p0.x);
    expect(p1.y).toBeGreaterThan(p0.y);
    expect(await view(page)).toEqual(v0);

    // One finger away from a marker pans.
    const box = await well(page).boundingBox();
    if (!box) throw new Error("no box");
    const a = { x: box.x + box.width * 0.7, y: box.y + box.height * 0.3 };
    const b = { x: a.x - 60, y: a.y };
    const pan = path(a, b, 6);
    if (info.project.name === "phone-chromium") {
      await cdpTouches(page, [
        { type: "touchStart", fingers: [a] },
        ...pan.slice(1).map((p) => ({ type: "touchMove", fingers: [p] })),
        { type: "touchEnd", fingers: [] },
      ]);
    } else {
      const w = well(page);
      await fire(w, "pointerdown", 1, a);
      for (const p of pan.slice(1)) await fire(w, "pointermove", 1, p);
      await fire(w, "pointerup", 1, b);
    }
    await expect.poll(async () => (await view(page)).x).toBeLessThan(v0.x);
  });
});

test.describe("a locked, moved swatch survives re-extraction (spec 3.7 acceptance 3)", () => {
  test("drag a marker, then change Colors 6 → 5: that swatch keeps its color and marker", async ({
    page,
  }, info) => {
    await page.goto("./");
    await page.getByTestId("file-input").setInputFiles(fixture("twelve-colors.png"));
    await expect(
      page.locator("[data-testid=swatch-strip]:visible").first().locator("[data-swatch]"),
    ).toHaveCount(6);
    await expect(page.locator("[data-testid=swatch-strip][data-busy]")).toHaveCount(0);
    await expect(page.locator("[data-marker]")).toHaveCount(6);
    // The image is wide and short, so rings overlap: take a marker that nothing covers.
    const n = await page.evaluate(() => {
      for (const el of document.querySelectorAll("[data-marker]")) {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (hit?.closest("[data-marker]") === el) return Number(el.getAttribute("data-marker"));
      }
      return 0;
    });
    expect(n).toBeGreaterThan(0);
    const start = await pointOf(page, n);
    const target = { x: Math.min(0.95, start.x + 0.25), y: start.y };
    await dragMarker(page, info.project.name, n, await onScreen(page, target));
    await expect(swatch(page, n)).toHaveAttribute("data-origin", "picked");
    const moved = await pointOf(page, n);
    expect(moved.x).toBeGreaterThan(start.x + 0.1);
    const hex = await hexOf(page, n);

    await page
      .locator(".slider:visible")
      .first()
      .evaluate((el) => {
        (el as HTMLInputElement).value = "5";
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });
    await expect(
      page.locator("[data-testid=swatch-strip]:visible").first().locator("[data-swatch]"),
    ).toHaveCount(5);
    await expect(page.locator("[data-testid=swatch-strip][data-busy]")).toHaveCount(0);
    expect(await hexOf(page, n)).toBe(hex);
    const kept = await pointOf(page, n);
    expect(kept.x).toBeCloseTo(moved.x, 5);
    expect(kept.y).toBeCloseTo(moved.y, 5);
  });
});
