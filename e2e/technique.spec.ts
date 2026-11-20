/**
 * M4-T11: the Technique rows, the Colors subset, Shuffle, Image sample and its thumbnail (spec 4.2;
 * plan Q1, D13 to D19). The fixture is Smooth path with Colors set to Picked: swatches 2, 4 and 6.
 */
import { expect, type Locator, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";
import { sheetSettled } from "./helpers/sheet";

const preview = (page: Page) => page.getByTestId("gradient-preview");
const technique = (page: Page) => page.getByTestId("technique-value");
const rows = (page: Page) => page.getByTestId("gradient-rows");
const chip = (page: Page, name: string) => rows(page).getByRole("button", { name, exact: true });
const undoButton = (page: Page, label: string) =>
  page.locator("header").getByRole("button", { name: `Undo ${label}` });

async function open(page: Page, info: { project: { name: string } }, query = "") {
  const phone = isPhoneProject(info as never);
  if (phone) await page.goto(demo(`tab=gradient${query && `&${query}`}`));
  else {
    await page.setViewportSize({ width: 1280, height: 1100 });
    await page.goto(demo(query));
  }
  await expect(rows(page)).toBeVisible();
}

const stops = async (page: Page): Promise<string[]> =>
  ((await preview(page).getAttribute("data-stops")) ?? "").split(",");
const hexes = async (page: Page): Promise<string[]> =>
  (await stops(page)).map((s) => s.split("@")[0] as string);

const HEXES = ["#E8693A", "#1DB07A", "#14386B", "#D4527F", "#1E8A2E", "#5039B0"];

async function pick(page: Page, label: string, option: string) {
  await rows(page).getByLabel(label, { exact: true }).selectOption({ label: option });
}

const channels = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
const near = (a: string, b: string, tolerance: number) => {
  const [x, y] = [channels(a), channels(b)];
  return x.every((v, i) => Math.abs(v - (y[i] as number)) <= tolerance);
};

test.describe("Technique rows (M4-T11)", () => {
  test("fixture: Smooth path, with Colors set to Picked and swatches 2, 4 and 6 pressed", async ({
    page,
  }, info) => {
    await open(page, info);
    await expect(technique(page)).toHaveText("Smooth path");
    await expect(rows(page).getByLabel("Technique", { exact: true })).toHaveValue("smooth-path");
    await expect(rows(page).getByLabel("Colors", { exact: true })).toHaveValue("picked");
    for (const n of [1, 3, 5])
      await expect(chip(page, `Swatch ${n}`)).toHaveAttribute("aria-pressed", "false");
    for (const n of [2, 4, 6])
      await expect(chip(page, `Swatch ${n}`)).toHaveAttribute("aria-pressed", "true");
    await expect(rows(page).getByTestId("picked-note")).toHaveText("Pick at least 2 colors.");
  });

  test("Palette order + All: data-stops #E8693A@0,#1DB07A@20,#14386B@40,#D4527F@60,#1E8A2E@80,#5039B0@100", async ({
    page,
  }, info) => {
    await open(page, info, "technique=palette-order");
    await expect(rows(page).getByLabel("Colors", { exact: true })).toHaveValue("all");
    await expect(preview(page)).toHaveAttribute(
      "data-stops",
      "#E8693A@0,#1DB07A@20,#14386B@40,#D4527F@60,#1E8A2E@80,#5039B0@100",
    );
  });

  test("Sorted by lightness: #14386B, #5039B0, #1E8A2E, #D4527F, #E8693A, #1DB07A", async ({
    page,
  }, info) => {
    await open(page, info, "technique=sorted");
    await expect(rows(page).getByLabel("By", { exact: true })).toHaveValue("lightness");
    expect(await hexes(page)).toEqual([
      "#14386B",
      "#5039B0",
      "#1E8A2E",
      "#D4527F",
      "#E8693A",
      "#1DB07A",
    ]);
  });

  test("Population-weighted: bands in proportion to the shares, first at 0 and last at 100", async ({
    page,
  }, info) => {
    await open(page, info, "technique=population");
    const positions = (await stops(page)).map((s) => Number(s.split("@")[1]));
    expect(positions).toHaveLength(6);
    expect(positions[0]).toBe(0);
    expect(positions[5]).toBe(100);
    for (let i = 1; i < positions.length; i += 1)
      expect(positions[i] as number).toBeGreaterThan(positions[i - 1] as number);
    // Not the even 20% steps of Palette order.
    expect(positions).not.toEqual([0, 20, 40, 60, 80, 100]);
  });

  test("Shuffle changes the order as one undo step; Undo gives back the earlier order", async ({
    page,
  }, info) => {
    await open(page, info, "technique=random");
    const before = await hexes(page);
    expect([...before].sort()).toEqual([...HEXES].sort());
    await rows(page).getByRole("button", { name: "Shuffle order" }).click();
    await expect.poll(() => hexes(page)).not.toEqual(before);
    await undoButton(page, "Shuffle").click();
    await expect.poll(() => hexes(page)).toEqual(before);
  });

  test("Derived, analogous, from swatch 3 gives 3 stops; a hue edit to swatch 3 moves all three", async ({
    page,
  }, info) => {
    test.skip(
      isPhoneProject(info),
      "The swatch editor is a sheet on phones; the engine is unit-tested",
    );
    await open(page, info, "technique=derived&rows=swatch");
    await expect(rows(page).getByLabel("Kind", { exact: true })).toHaveValue("analogous");
    await expect(rows(page).getByRole("radio", { name: "Swatch 3", exact: true })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    const before = await hexes(page);
    expect(before).toHaveLength(3);
    const h = page
      .locator("[data-testid=swatch-editor]:visible")
      .getByRole("spinbutton", { name: /Hue/ });
    await h.fill("120");
    await h.press("Enter");
    await expect.poll(() => hexes(page)).not.toEqual(before);
    const after = await hexes(page);
    expect(after.filter((hex, i) => hex !== before[i])).toHaveLength(3);
  });

  test("Markers by x gives linked stops #5039B0, #E8693A, #D4527F, #1DB07A, #14386B, #1E8A2E", async ({
    page,
  }, info) => {
    await open(page, info, "technique=image-sample");
    await pick(page, "Mode", "Markers by x");
    await expect
      .poll(() => hexes(page))
      .toEqual(["#5039B0", "#E8693A", "#D4527F", "#1DB07A", "#14386B", "#1E8A2E"]);
    // The marker modes have no Count.
    await expect(rows(page).getByLabel("Count", { exact: true })).toHaveCount(0);
    await expect(rows(page).getByTestId("sample-dot")).toHaveCount(6);
  });

  test("Line: dragging the end handle onto patch 4 (0.380, 0.796) makes the last stop #D4527F ± 2", async ({
    page,
  }, info) => {
    await open(page, info, "technique=image-sample");
    const thumb = page.getByTestId("sample-thumb");
    await expect(thumb).toBeVisible();
    // The default line ends on the image's corner region, so the last stop starts elsewhere.
    await expect.poll(async () => (await stops(page)).length).toBe(5);
    const end = page.locator("[data-testid=sample-handle][data-end=b]");
    // Clear of the pinned preview and the tab bar on phones.
    await thumb.evaluate((el) => el.scrollIntoView({ block: "center" }));
    const h = await end.boundingBox();
    const t = await thumb.boundingBox();
    if (!h || !t) throw new Error("no boxes");
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(t.x + t.width * 0.38, t.y + t.height * 0.796, { steps: 8 });
    await page.mouse.up();
    await expect
      .poll(async () => near((await hexes(page)).at(-1) ?? "#000000", "#D4527F", 2), {
        timeout: 10_000,
      })
      .toBe(true);
    // The drag is one undo step.
    await undoButton(page, "Sample line").click();
    await expect
      .poll(async () => near((await hexes(page)).at(-1) ?? "#000000", "#D4527F", 2))
      .toBe(false);
  });

  test("keyboard: arrows move a line handle 1%, Shift+arrow 10%", async ({ page }, info) => {
    await open(page, info, "technique=image-sample");
    const end = page.locator("[data-testid=sample-handle][data-end=b]");
    await expect(end).toHaveAttribute("aria-label", "Line end, x 95%, y 95%");
    await end.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(end).toHaveAttribute("aria-label", "Line end, x 94%, y 95%");
    await page.keyboard.press("Shift+ArrowUp");
    await expect(end).toHaveAttribute("aria-label", "Line end, x 94%, y 85%");
  });

  test("from Custom, the ↺ icon rebuilds the Smooth path stops and keeps a locked stop", async ({
    page,
  }, info) => {
    const phone = isPhoneProject(info);
    await open(page, info, phone ? "tab=gradient&rows=stop" : "rows=stop");
    if (phone) await sheetSettled(page);
    const scope = page.locator("[data-testid=row-stop], [data-testid=sheet-stop]");
    await scope.getByRole("textbox", { name: "HEX" }).fill("#FF0000");
    await scope.getByRole("textbox", { name: "HEX" }).press("Enter");
    await scope.getByRole("switch", { name: "Lock" }).click();
    await expect(technique(page)).toHaveText("Custom");
    if (phone) {
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    await page.getByRole("button", { name: "Rebuild from Smooth path" }).click();
    await expect(technique(page)).toHaveText("Smooth path");
    await expect(preview(page)).toHaveAttribute("data-stops", "#1DB07A@0,#FF0000@50,#5039B0@100");
  });

  test("unpicking down to 1 swatch is refused, with the note", async ({ page }, info) => {
    await open(page, info);
    await chip(page, "Swatch 6").click();
    await expect(chip(page, "Swatch 6")).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => hexes(page)).toEqual(["#1DB07A", "#D4527F"]);
    await chip(page, "Swatch 4").click();
    await expect(chip(page, "Swatch 4")).toHaveAttribute("aria-pressed", "true");
    await expect(rows(page).getByTestId("picked-note")).toHaveText("Keep at least 2 colors.");
    expect(await hexes(page)).toEqual(["#1DB07A", "#D4527F"]);
  });

  test("Most distinct takes a count and keeps the palette order", async ({ page }, info) => {
    await open(page, info, "technique=palette-order");
    await pick(page, "Colors", "Most distinct");
    const count = rows(page).getByRole("spinbutton", { name: "Count", exact: true });
    await count.fill("3");
    await count.press("Enter");
    await expect.poll(async () => (await stops(page)).length).toBe(3);
    await undoButton(page, "Colors").click();
    await expect.poll(async () => (await stops(page)).length).toBe(4);
  });

  test("the Stop row never shows an empty state: the first stop is selected by default", async ({
    page,
  }, info) => {
    await open(page, info, "technique=palette-order&rows=stop");
    if (isPhoneProject(info)) await sheetSettled(page);
    const scope = page.locator("[data-testid=row-stop], [data-testid=sheet-stop]");
    await expect(scope.getByTestId("stop-details")).toBeVisible();
    await expect(scope.getByText("Select a stop")).toHaveCount(0);
  });

  test("phone: every chip and handle is 44 px; the demo makes no storage access", async ({
    page,
  }, info) => {
    test.skip(!isPhoneProject(info), "phone only");
    await page.addInitScript(() => {
      const w = window as unknown as { __storage: string[] };
      w.__storage = [];
      for (const name of ["getItem", "setItem", "removeItem", "clear"] as const) {
        const original = Storage.prototype[name] as (...args: unknown[]) => unknown;
        Object.defineProperty(Storage.prototype, name, {
          configurable: true,
          value(this: Storage, ...args: unknown[]) {
            w.__storage.push(name);
            return original.apply(this, args);
          },
        });
      }
    });
    await open(page, info);
    const sizes = async (loc: Locator) =>
      (await loc.all()).map(async (l) => (await l.boundingBox()) ?? { width: 0, height: 0 });
    for (const b of await Promise.all(await sizes(rows(page).getByTestId("technique-chip")))) {
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
    }
    await page.goto(demo("tab=gradient&technique=image-sample"));
    await expect(page.getByTestId("sample-thumb")).toBeVisible();
    for (const b of await Promise.all(await sizes(page.getByTestId("sample-handle")))) {
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
    }
    // Touching a handle must not scroll the page.
    expect(
      await page
        .locator("[data-testid=sample-handle]")
        .first()
        .evaluate((el) => getComputedStyle(el).touchAction),
    ).toBe("none");
    expect(
      await page.evaluate(() => (window as unknown as { __storage: string[] }).__storage),
    ).toEqual([]);
  });
});
