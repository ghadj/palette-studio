/**
 * M4-T9: the Interpolation row and the Interpolation options row (spec 4.3; plan Q4, D24, D25).
 * The Gamut row's test lands in T10, and Premultiplied's appearance depends on a stop's alpha, which
 * the Stop row (T8) sets; its predicate is unit-tested in tests/gradient.
 */
import { expect, type Page, test } from "@playwright/test";
import { demo, hasHorizontalScroll, isPhoneProject } from "./helpers/app";
import { sheetSettled } from "./helpers/sheet";

type Info = Parameters<typeof isPhoneProject>[0];

async function open(page: Page, info: Info, query = "", rows = "interpolation") {
  const q = `rows=${rows}${query && `&${query}`}`;
  if (isPhoneProject(info)) await page.goto(demo(`tab=gradient&${q}`));
  else {
    await page.setViewportSize({ width: 1280, height: 1280 });
    await page.goto(demo(q));
  }
  if (rows.includes("interpolation")) {
    await expect(page.getByTestId("interpolation-options")).toBeVisible();
    if (isPhoneProject(info)) await sheetSettled(page);
  }
}

const preview = (page: Page) => page.getByTestId("gradient-preview");
const options = (page: Page) => page.getByTestId("interpolation-options");
const space = (page: Page) => page.locator("#interpolation-space");
const rowLabels = (page: Page) => options(page).locator(".setting-row__label");
const header = (page: Page) => page.locator("[data-row=interpolation] .chevron-row__button");
/** The reset-all icon: in the header on desktop, in the sheet's title bar on phones (M3 decision 48). */
const resetAll = (page: Page, info: Info) =>
  page.getByTestId(
    isPhoneProject(info) ? "interpolation-reset-all-sheet" : "interpolation-reset-all",
  );
/** Changes the space; a phone's sheet covers the row, so it closes and reopens. */
async function setSpace(page: Page, info: Info, value: string) {
  if (!isPhoneProject(info)) {
    await space(page).selectOption(value);
    return;
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await space(page).selectOption(value);
  await header(page).click();
  await sheetSettled(page);
}
const easingSelect = (page: Page) => page.locator("#interp-easing");

/** Undo by shortcut: on phones the sheet covers the header's button. */
const undo = (page: Page) => page.keyboard.press("ControlOrMeta+z");
const undoButton = (page: Page) => page.locator("header").getByRole("button", { name: /^Undo/ });

test.describe("Interpolation row and options (M4-T9)", () => {
  test("fixture: Interpolation reads OKLab inline, and there is no inline Hue, Easing, Premultiplied or Gamut row", async ({
    page,
  }, info) => {
    await open(page, info, "", "");
    await expect(space(page)).toHaveValue("oklab");
    const scope = isPhoneProject(info) ? page : page.getByTestId("gradient-rows");
    for (const name of ["Hue", "Easing", "Premultiplied alpha", "Gamut"]) {
      await expect(
        scope.locator(".setting-row__label").filter({ hasText: new RegExp(`^${name}$`) }),
      ).toHaveCount(0);
    }
    await expect(header(page)).toHaveAccessibleName("Interpolation options");
  });

  test("the drawer on OKLab shows only Easing; on OKLCH or HSL it shows Hue (Shorter) too; on Lab it doesn't", async ({
    page,
  }, info) => {
    await open(page, info);
    await expect(rowLabels(page)).toHaveText(["Easing"]);
    await setSpace(page, info, "oklch");
    // The fixture leaves sRGB in OKLCH (green to pink by the shorter arc passes a yellow-orange
    // too vivid for sRGB), so the bake maps colors and the Gamut row shows (plan D12, M4-T10).
    await expect(rowLabels(page)).toHaveText(["Hue", "Easing", "Gamut"]);
    await expect(options(page)).toContainText("Some colors fall outside sRGB.");
    await expect(page.locator("#interp-hue")).toHaveValue("shorter");
    await setSpace(page, info, "hsl");
    await expect(rowLabels(page)).toHaveText(["Hue", "Easing"]);
    await setSpace(page, info, "lab");
    await expect(rowLabels(page)).toHaveText(["Easing"]);
  });

  test("data-space, data-hue and data-easing follow the rows", async ({ page }, info) => {
    await open(page, info, "space=oklch");
    await expect(preview(page)).toHaveAttribute("data-space", "oklch");
    await page.locator("#interp-hue").selectOption("longer");
    await expect(preview(page)).toHaveAttribute("data-hue", "longer");
    await easingSelect(page).selectOption("smoothstep");
    await expect(preview(page)).toHaveAttribute("data-easing", "smoothstep");
    await setSpace(page, info, "lab");
    await expect(preview(page)).toHaveAttribute("data-space", "lab");
  });

  test("Ease in gives the header 'Interpolation options · 1'; reset-all brings back Linear as one undo step, and the badge hides", async ({
    page,
  }, info) => {
    await open(page, info);
    await expect(resetAll(page, info)).toHaveCount(0);
    await expect(page.getByTestId("interpolation-badge")).toHaveCount(0);
    await easingSelect(page).selectOption("ease-in");
    await expect(preview(page)).toHaveAttribute("data-easing", "ease-in");
    await expect(header(page)).toHaveAccessibleName("Interpolation options, 1 active");
    await expect(page.getByTestId("interpolation-badge")).toHaveText("· 1");
    await expect(page.getByTestId("interpolation-badge")).toBeVisible();
    await expect(resetAll(page, info)).toHaveAccessibleName("Reset interpolation options");
    await resetAll(page, info).click();
    await expect(preview(page)).toHaveAttribute("data-easing", "linear");
    await expect(page.getByTestId("interpolation-badge")).toHaveCount(0);
    await expect(resetAll(page, info)).toHaveCount(0);
    // One step back restores Ease in; a second leaves nothing to undo.
    await undo(page);
    await expect(preview(page)).toHaveAttribute("data-easing", "ease-in");
    await undo(page);
    await expect(preview(page)).toHaveAttribute("data-easing", "linear");
    if (!isPhoneProject(info))
      await expect(undoButton(page)).toHaveAttribute("aria-disabled", "true");
  });

  test("the count includes a non-default Hue whose row is hidden", async ({ page }, info) => {
    await open(page, info, "space=oklch");
    await page.locator("#interp-hue").selectOption("longer");
    await easingSelect(page).selectOption("ease-out");
    await expect(page.getByTestId("interpolation-badge")).toHaveText("· 2");
    await setSpace(page, info, "oklab");
    await expect(rowLabels(page)).toHaveText(["Easing"]);
    await expect(page.getByTestId("interpolation-badge")).toHaveText("· 2");
    await resetAll(page, info).click();
    await expect(preview(page)).toHaveAttribute("data-hue", "shorter");
    await expect(preview(page)).toHaveAttribute("data-easing", "linear");
  });

  test("Custom shows 4 fields; x1 1.5 is rejected, with a note", async ({ page }, info) => {
    await open(page, info);
    await expect(page.getByTestId("bezier-field")).toHaveCount(0);
    await easingSelect(page).selectOption("cubic-bezier");
    const fields = page.getByTestId("bezier-field");
    await expect(fields).toHaveCount(4);
    await expect(fields.first()).toHaveValue("0.25");
    await fields.first().fill("1.5");
    await expect(page.getByTestId("bezier-note")).toContainText("0 and 1");
    await expect(fields.first()).toHaveAttribute("aria-invalid", "true");
    await fields.first().blur();
    await expect(fields.first()).toHaveValue("0.25");
    await expect(page.getByTestId("bezier-note")).toHaveCount(0);
    await fields.nth(1).fill("0.5");
    await expect(fields.nth(1)).toHaveValue("0.5");
    await fields.first().fill("0,4");
    await fields.first().blur();
    await expect(fields.first()).toHaveValue("0.4");
  });

  test("Premultiplied appears in the drawer only after a stop's alpha drops below 100%", async ({
    page,
  }, info) => {
    const phone = isPhoneProject(info);
    if (phone) await page.goto(demo("tab=gradient&rows=stop"));
    else {
      await page.setViewportSize({ width: 1280, height: 1280 });
      await page.goto(demo("rows=stop,interpolation"));
    }
    if (phone) await sheetSettled(page);
    const alpha = page.getByRole("spinbutton", { name: "Alpha", exact: true });
    await alpha.fill("50");
    await alpha.press("Enter");
    await expect(alpha).toHaveValue("50");
    if (phone) {
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await header(page).click();
      await sheetSettled(page);
    }
    await expect(rowLabels(page)).toHaveText(["Easing", "Premultiplied alpha"]);
    const toggle = page.getByRole("switch", { name: "Premultiplied alpha" });
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("interpolation-badge")).toHaveText("· 1");
    await resetAll(page, info).click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("interpolation-badge")).toHaveCount(0);
  });

  test("each change is one undo step; a row's reset icon shows only off its default", async ({
    page,
  }, info) => {
    await open(page, info, "space=oklch");
    const rowReset = page.getByTestId("interpolation-reset-row");
    await expect(rowReset).toHaveCount(0);
    await page.locator("#interp-hue").selectOption("increasing");
    await expect(rowReset).toHaveCount(1);
    await easingSelect(page).selectOption("smoothstep");
    await expect(rowReset).toHaveCount(2);
    await rowReset.first().click();
    await expect(preview(page)).toHaveAttribute("data-hue", "shorter");
    await expect(rowReset).toHaveCount(1);
    await undo(page);
    await expect(preview(page)).toHaveAttribute("data-hue", "increasing");
    await undo(page);
    await expect(preview(page)).toHaveAttribute("data-easing", "linear");
    await undo(page);
    await expect(preview(page)).toHaveAttribute("data-hue", "shorter");
  });

  test("the Interpolation row: a reset icon only off OKLab, one undo step per change", async ({
    page,
  }, info) => {
    await open(page, info, "", "");
    const reset = page.getByTestId("interpolation-space-reset");
    await expect(reset).toHaveCount(0);
    await space(page).selectOption("hsl");
    await expect(preview(page)).toHaveAttribute("data-space", "hsl");
    await expect(reset).toHaveCount(1);
    await reset.click();
    await expect(preview(page)).toHaveAttribute("data-space", "oklab");
    await expect(reset).toHaveCount(0);
    await undo(page);
    await expect(preview(page)).toHaveAttribute("data-space", "hsl");
    await undo(page);
    await expect(preview(page)).toHaveAttribute("data-space", "oklab");
  });

  test("the row lists the ten spaces by name", async ({ page }, info) => {
    await open(page, info, "", "");
    await expect(space(page).locator("option")).toHaveText([
      "sRGB",
      "Linear sRGB",
      "Display-P3",
      "Lab",
      "OKLab",
      "LCH",
      "OKLCH",
      "HSL",
      "HWB",
      "XYZ",
    ]);
  });

  test("phone: the drawer opens below the dock with the --space-2 gap and locks the page; rows stay on one line", async ({
    page,
  }, info) => {
    test.skip(!isPhoneProject(info), "phone only");
    await page.setViewportSize({ width: 320, height: 700 });
    await open(page, info, "space=oklch");
    await easingSelect(page).selectOption("cubic-bezier");
    const dock = await page.getByTestId("gradient-dock").boundingBox();
    const sheet = await page.getByRole("dialog").locator(".bottom-sheet__panel").boundingBox();
    const scrim = await page.getByRole("dialog").getByTestId("sheet-scrim").boundingBox();
    if (!dock || !sheet || !scrim) throw new Error("no boxes");
    const gap = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.height = "var(--space-2)";
      document.body.append(probe);
      const h = probe.getBoundingClientRect().height;
      probe.remove();
      return h;
    });
    // The panel hugs the bottom and is as tall as its content, so it starts at or below the gap.
    expect(sheet.y).toBeGreaterThanOrEqual(dock.y + dock.height + gap - 1);
    expect(Math.abs(scrim.y - (dock.y + dock.height))).toBeLessThanOrEqual(1);
    await expect(page.locator("html")).toHaveClass(/sheet-locked/);
    const rows = options(page).locator(".setting-row");
    for (const row of await rows.all()) {
      const label = await row.locator(".setting-row__label").boundingBox();
      const b = await row.boundingBox();
      if (!label || !b) throw new Error("no row");
      expect(b.x + b.width).toBeLessThanOrEqual(320);
      const note = row.locator(".setting-row__note");
      const hasNote = (await note.count()) > 0 && ((await note.textContent()) ?? "").trim() !== "";
      if (!hasNote) {
        expect(b.height).toBeLessThanOrEqual(64);
        continue;
      }
      // A row with a note (the Gamut row's "Some colors fall outside sRGB.") may wrap below 64 px
      // tall. M2's setting-row rule still holds: the label group and the value share one line
      // (their vertical ranges overlap, centers within 2 px), nothing overlaps and nothing clips.
      const group = await row.locator(".setting-row__label-group").boundingBox();
      const value = await row.locator(".setting-row__value").boundingBox();
      if (!group || !value) throw new Error("no label group or value");
      expect(group.y).toBeLessThan(value.y + value.height);
      expect(value.y).toBeLessThan(group.y + group.height);
      expect(
        Math.abs(group.y + group.height / 2 - (value.y + value.height / 2)),
      ).toBeLessThanOrEqual(2);
      expect(group.x + group.width).toBeLessThanOrEqual(value.x + 1);
      for (const part of [group, value]) {
        expect(part.x).toBeGreaterThanOrEqual(b.x - 1);
        expect(part.x + part.width).toBeLessThanOrEqual(b.x + b.width + 1);
        expect(part.y).toBeGreaterThanOrEqual(b.y - 1);
        expect(part.y + part.height).toBeLessThanOrEqual(b.y + b.height + 1);
      }
      const clipped = await note.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(clipped).toBe(false);
    }
    expect(await hasHorizontalScroll(page)).toBe(false);
    for (const f of await page.getByTestId("bezier-field").all()) {
      const b = await f.boundingBox();
      expect(b?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(b ? b.x + b.width : 0).toBeLessThanOrEqual(320);
      await expect(f).toHaveCSS("font-size", "16px");
    }
  });
});
