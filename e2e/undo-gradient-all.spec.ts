/**
 * One long gradient session, undone and redone in full (M4-T14; spec 3.6). It changes the angle,
 * type, space, easing and technique, shuffles, adds and moves a stop, changes its alpha and
 * detaches it, then undoes every step back to the fixture and redoes them all. After each step the
 * gradient matches what it was then: the stops and every data attribute of the preview.
 */
import { expect, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";

const preview = (page: Page) => page.getByTestId("gradient-preview");
const undoButton = (page: Page) => page.locator("header").getByRole("button", { name: /^Undo/ });
const redoButton = (page: Page) => page.locator("header").getByRole("button", { name: /^Redo/ });
const technique = (page: Page) => page.getByTestId("technique-value");

/** The preview's data attributes, the technique's label and the stop count. */
async function snapshot(page: Page): Promise<string> {
  const attrs = await preview(page).evaluate((el) =>
    [...el.attributes]
      .filter((a) => a.name.startsWith("data-") && a.name !== "data-testid")
      .map((a) => `${a.name}=${a.value}`)
      .sort()
      .join(" "),
  );
  return `${attrs} | ${await technique(page).textContent()} | ${await page.getByTestId("stop-handle").count()}`;
}

test("type, angle, space, easing, technique, shuffle, add, move, alpha and detach: undo all, redo all", async ({
  page,
}, info) => {
  test.skip(isPhoneProject(info), "the desktop panels and the mouse drag");
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 1500 });
  await page.goto(demo("rows=interpolation,stop,geometry"));
  await expect(page.getByTestId("stop-handle")).toHaveCount(3);
  await expect(page.getByTestId("geometry-panel")).toBeVisible();
  await expect(undoButton(page)).toHaveAttribute("aria-disabled", "true");

  const seen: string[] = [await snapshot(page)];
  const step = async (action: () => Promise<void>) => {
    await action();
    await expect.poll(() => undoButton(page).getAttribute("aria-disabled")).not.toBe("true");
    seen.push(await snapshot(page));
  };

  await step(async () => {
    const dial = page.getByTestId("geometry-angle-dial");
    await dial.focus();
    await page.keyboard.press("Shift+ArrowRight");
    await expect(preview(page)).toHaveAttribute("data-angle", "105");
  });
  await step(async () => {
    await page.getByTestId("gradient-types").getByRole("button", { name: "Radial" }).click();
    await expect(preview(page)).toHaveAttribute("data-type", "radial");
  });
  await step(async () => {
    await page.locator("#interpolation-space").selectOption("oklch");
    await expect(preview(page)).toHaveAttribute("data-space", "oklch");
  });
  await step(async () => {
    await page.locator("#interp-easing").selectOption("smoothstep");
    await expect(preview(page)).toHaveAttribute("data-easing", /smoothstep/);
  });
  await step(async () => {
    await page
      .getByTestId("gradient-rows")
      .getByLabel("Technique", { exact: true })
      .selectOption("random");
    await expect(technique(page)).toHaveText("Constrained random");
  });
  await step(async () => {
    const before = await preview(page).getAttribute("data-stops");
    await page.getByRole("button", { name: "Shuffle order" }).click();
    await expect.poll(() => preview(page).getAttribute("data-stops")).not.toBe(before);
  });
  await step(async () => {
    const bar = await page.getByTestId("stop-bar").boundingBox();
    if (!bar) throw new Error("no bar");
    await page.mouse.click(bar.x + bar.width * 0.75, bar.y + 22);
    await expect(page.getByTestId("stop-handle")).toHaveCount(4);
  });
  await step(async () => {
    const selected = page.locator("[data-testid=stop-handle][data-selected]");
    await selected.focus();
    const before = await preview(page).getAttribute("data-stops");
    await page.keyboard.press("Shift+ArrowLeft");
    await expect.poll(() => preview(page).getAttribute("data-stops")).not.toBe(before);
  });
  await step(async () => {
    const alpha = page
      .getByTestId("row-stop")
      .getByRole("spinbutton", { name: "Alpha", exact: true });
    await alpha.fill("50");
    await alpha.press("Enter");
    await expect(preview(page)).toHaveAttribute("data-stops", /[0-9A-F]{6}80@/);
  });
  await step(async () => {
    const hex = page.getByTestId("row-stop").getByRole("textbox", { name: "HEX" });
    await hex.fill("#FF0000");
    await hex.press("Enter");
    await expect(preview(page)).toHaveAttribute("data-stops", /#FF000080@/);
  });
  expect(new Set(seen).size).toBe(seen.length);

  // Undo every step, checking each state on the way back to the fixture.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  for (let i = seen.length - 2; i >= 0; i -= 1) {
    await undoButton(page).click();
    await expect.poll(() => snapshot(page)).toBe(seen[i]);
  }
  await expect(undoButton(page)).toHaveAttribute("aria-disabled", "true");
  expect(await preview(page).getAttribute("data-stops")).toBe("#1DB07A@0,#D4527F@50,#5039B0@100");

  // Redo them all.
  for (let i = 1; i < seen.length; i += 1) {
    await redoButton(page).click();
    await expect.poll(() => snapshot(page)).toBe(seen[i]);
  }
  await expect(redoButton(page)).toHaveAttribute("aria-disabled", "true");
});
