/**
 * An open drawer is the only thing that scrolls (M3 decision 46, user request 2026-11-20): below
 * 1024 px the page behind a bottom sheet is locked, so only the sheet's content scrolls.
 */
import { expect, type Page, test } from "@playwright/test";
import { demo } from "./helpers/app";
import { openRow } from "./helpers/rows";
import { sheetSettled } from "./helpers/sheet";

const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));
const body = (page: Page) => page.locator(".bottom-sheet__body");

async function wheelOver(page: Page, selector: string, dy: number): Promise<void> {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, dy);
  await page.waitForTimeout(150);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(demo());
  await expect(page.getByTestId("tabbar")).toBeVisible();
});

test("a wheel scroll over the pinned strip leaves the page where it is", async ({ page }, info) => {
  test.skip(info.project.name === "phone-webkit", "mobile WebKit has no mouse wheel");
  await openRow(page, "Advanced");
  await sheetSettled(page);
  const before = await scrollY(page);
  await wheelOver(page, "[data-testid=strip-dock]", 400);
  expect(await scrollY(page)).toBe(before);
  await wheelOver(page, "[data-testid=strip-dock]", -400);
  expect(await scrollY(page)).toBe(before);
});

test("a touch scroll over the pinned strip leaves the page where it is (Chromium)", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "CDP touch gestures");
  await openRow(page, "Advanced");
  await sheetSettled(page);
  const before = await scrollY(page);
  const box = await page.locator("[data-testid=strip-dock]").boundingBox();
  if (!box) throw new Error("no dock");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.synthesizeScrollGesture", {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
    yDistance: -300,
    gestureSourceType: "touch",
  });
  await page.waitForTimeout(200);
  expect(await scrollY(page)).toBe(before);
});

test("the sheet scrolls, and overscrolling it never moves the page", async ({ page }, info) => {
  test.skip(info.project.name === "phone-webkit", "mobile WebKit has no mouse wheel");
  await openRow(page, "Advanced");
  await sheetSettled(page);
  const before = await scrollY(page);
  const room = await body(page).evaluate((el) => el.scrollHeight - el.clientHeight);
  expect(room, "the sheet has content to scroll").toBeGreaterThan(0);
  await wheelOver(page, ".bottom-sheet__body", 200);
  expect(await body(page).evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await wheelOver(page, ".bottom-sheet__body", 5000);
  await wheelOver(page, ".bottom-sheet__body", 5000);
  expect(await scrollY(page)).toBe(before);
  await wheelOver(page, ".bottom-sheet__body", -9000);
  await wheelOver(page, ".bottom-sheet__body", -9000);
  expect(await scrollY(page)).toBe(before);
});

test("only the sheet's content scrolls while a drawer is open", async ({ page }) => {
  await openRow(page, "Advanced");
  await sheetSettled(page);
  const scrollers = await page.evaluate(() => {
    const out: string[] = [];
    const root = document.documentElement;
    if (getComputedStyle(root).overflowY !== "hidden") out.push("html");
    for (const el of document.querySelectorAll("body, body *")) {
      if (el.closest(".bottom-sheet__body")) continue;
      const { overflowY } = getComputedStyle(el);
      if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight + 1)
        out.push(el.className || el.tagName);
    }
    return out;
  });
  expect(scrollers, "scrollers outside the sheet").toEqual([]);
});

test("closing unlocks the page and keeps its position", async ({ page }, info) => {
  // Playwright scrolls the button into view first; the page's position at the click is the one
  // that must come back.
  await page
    .getByRole("button", { name: "Advanced", exact: true })
    .evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.evaluate(() => {
    document.addEventListener(
      "click",
      () => {
        (window as unknown as { __atClick: number }).__atClick = window.scrollY;
      },
      { capture: true, once: true },
    );
  });
  await openRow(page, "Advanced");
  await sheetSettled(page);
  const open = await page.evaluate(() =>
    Math.round((window as unknown as { __atClick: number }).__atClick),
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflowY))
    .not.toBe("hidden");
  await expect
    .poll(() => scrollY(page), { message: "the page is where it was before the drawer opened" })
    .toBe(open);
  await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.style.height = "2000px";
    document.body.append(spacer);
  });
  if (info.project.name !== "phone-webkit") {
    await wheelOver(page, "main", 300);
    expect(await scrollY(page), "the page scrolls again").toBeGreaterThan(open);
  } else {
    await page.evaluate(() => window.scrollBy(0, 100));
    expect(await scrollY(page), "the page scrolls again").toBeGreaterThan(open);
  }
});

test("switching tabs never leaves the page locked", async ({ page }) => {
  await openRow(page, "Advanced");
  await sheetSettled(page);
  await page.keyboard.press("Escape");
  await page.getByTestId("tabbar").getByRole("tab", { name: "Palette" }).click();
  expect(
    await page.evaluate(() => document.documentElement.classList.contains("sheet-locked")),
  ).toBe(false);
});

test("touchmove outside the sheet's scroll area is cancelled (iOS)", async ({ page }, info) => {
  test.skip(
    info.project.name !== "chromium" && info.project.name !== "phone-chromium",
    "Only Chromium has the Touch constructor",
  );
  await openRow(page, "Advanced");
  await sheetSettled(page);
  const result = await page.evaluate(() => {
    const fire = (el: Element) => {
      const t = new Touch({ identifier: 1, target: el, clientX: 10, clientY: 10 });
      const event = new TouchEvent("touchmove", {
        bubbles: true,
        cancelable: true,
        touches: [t],
        targetTouches: [t],
        changedTouches: [t],
      });
      el.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const dock = document.querySelector("[data-testid=strip-dock]");
    const header = document.querySelector("header");
    const scrim = document.querySelector("[data-testid=sheet-scrim]");
    const area = document.querySelector(".bottom-sheet__body > *");
    if (!dock || !header || !scrim || !area) throw new Error("missing");
    return { dock: fire(dock), header: fire(header), scrim: fire(scrim), sheet: fire(area) };
  });
  expect(result).toEqual({ dock: true, header: true, scrim: true, sheet: false });
});
