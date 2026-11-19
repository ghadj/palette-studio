/**
 * The Swatch row and sheet (M3-T4; spec 3.2, 3.7; plan D13 to D15, D21): format fields, Name with
 * the CSS-name suggestion, Copy, Duplicate, Delete, Reset to extracted, the sample settings and the
 * Cluster map toggle. The mockup state selects swatch 3 (#14386B); `rows=swatch` opens the row in
 * place on desktop and as the sheet on phones.
 */
import { expect, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";
import { sheetSettled } from "./helpers/sheet";

const OPEN = "tab=palette&rows=swatch";

const details = (page: Page) => page.locator("[data-testid=swatch-details]:visible");
const label = (page: Page) => page.locator("[data-testid=selection-label]:visible").first();
const strip = (page: Page) =>
  page.locator("[data-testid=swatch-strip]:visible").first().locator("[data-swatch]");

async function open(page: Page, query = OPEN): Promise<void> {
  await page.goto(demo(query));
  await expect(details(page)).toBeVisible();
  if (page.viewportSize() && (page.viewportSize()?.width ?? 0) < 1024) await sheetSettled(page);
}

/** Moves focus off a text field so the Ctrl+Z shortcut applies (shortcuts are off while typing). */
async function undoKey(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Control+z");
}

test.describe("name", () => {
  test("rename to 'Harbor' shows in the label and is undoable", async ({ page }) => {
    await open(page);
    await expect(label(page)).toHaveText("Swatch 3");
    const name = details(page).getByLabel("Name", { exact: true });
    await name.fill("Harbor");
    await name.press("Enter");
    await expect(label(page)).toHaveText("Harbor");
    await undoKey(page);
    await expect(label(page)).toHaveText("Swatch 3");
  });

  test("the suggestion chip applies the name", async ({ page }) => {
    await open(page);
    const chip = details(page).getByTestId("name-suggestion");
    // #14386B is closest to midnightblue (#191970) among the CSS names.
    await expect(chip).toHaveText("midnightblue");
    await chip.click();
    await expect(label(page)).toHaveText("midnightblue");
    await expect(details(page).getByLabel("Name", { exact: true })).toHaveValue("midnightblue");
    await expect(details(page).getByTestId("name-suggestion")).toHaveCount(0);
  });
});

test.describe("fields", () => {
  test("HEX, RGB, HSL and OKLCH show the color and edit it", async ({ page }) => {
    await open(page);
    const hex = details(page).getByLabel("HEX", { exact: true });
    await expect(hex).toHaveValue("#14386B");
    const format = details(page).getByTestId("swatch-format");
    await format.getByRole("button", { name: "RGB" }).click();
    await expect(details(page).getByLabel("RGB R")).toHaveValue("20");
    await expect(details(page).getByLabel("RGB G")).toHaveValue("56");
    await expect(details(page).getByLabel("RGB B")).toHaveValue("107");
    await format.getByRole("button", { name: "HSL" }).click();
    await expect(details(page).getByLabel("HSL H")).toHaveValue("215");
    await expect(details(page).getByLabel("HSL S")).toHaveValue("69");
    await expect(details(page).getByLabel("HSL L")).toHaveValue("25");
    await format.getByRole("button", { name: "OKLCH" }).click();
    const l = details(page).getByLabel("OKLCH L");
    await expect(l).toHaveValue(/^0\.\d{3}$/);
    // Edit lightness: the base color changes, and HEX follows.
    await l.fill("0.7");
    await l.press("Enter");
    await expect(l).toHaveValue("0.700");
    await format.getByRole("button", { name: "HEX" }).click();
    await expect(hex).not.toHaveValue("#14386B");
    await undoKey(page);
    await expect(hex).toHaveValue("#14386B");
  });

  test("an invalid HEX is dropped on blur", async ({ page }) => {
    await open(page);
    const hex = details(page).getByLabel("HEX", { exact: true });
    await hex.fill("#12");
    await hex.press("Enter");
    await expect(hex).toHaveValue("#14386B");
  });

  test("the HEX field turns autocorrect and autocapitalize off (spec 6.1)", async ({ page }) => {
    await open(page);
    const hex = details(page).getByLabel("HEX", { exact: true });
    await expect(hex).toHaveAttribute("autocorrect", "off");
    await expect(hex).toHaveAttribute("autocapitalize", "off");
  });
});

test.describe("copy", () => {
  test("Copy writes the selected format", async ({ page, context, browserName }) => {
    test.skip(
      browserName !== "chromium",
      "Playwright grants clipboard permissions in Chromium only",
    );
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await open(page);
    const read = () => page.evaluate(() => navigator.clipboard.readText());
    const copy = details(page).getByRole("button", { name: "Copy", exact: true });
    await copy.click();
    await expect.poll(read).toBe("#14386B");
    const format = details(page).getByTestId("swatch-format");
    await format.getByRole("button", { name: "RGB" }).click();
    await copy.click();
    await expect.poll(read).toBe("rgb(20 56 107)");
    await format.getByRole("button", { name: "HSL" }).click();
    await copy.click();
    await expect.poll(read).toBe("hsl(215 69% 25%)");
    await format.getByRole("button", { name: "OKLCH" }).click();
    await copy.click();
    await expect.poll(read).toMatch(/^oklch\(0\.\d{3} 0\.\d{3} \d{1,3}\.\d\)$/);
  });
});

test.describe("duplicate and delete", () => {
  test("Duplicate adds the copy right after swatch 3; at 12 it is disabled with a note", async ({
    page,
  }) => {
    await open(page);
    await expect(strip(page)).toHaveCount(6);
    const duplicate = details(page).getByRole("button", { name: "Duplicate" });
    await duplicate.click();
    await expect(strip(page)).toHaveCount(7);
    // The copy sits at position 4 with swatch 3's color, and is selected.
    const labels = await strip(page).evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label") ?? ""),
    );
    expect(labels[3]?.split(", ")[1]).toBe("#14386B");
    expect(labels[2]?.split(", ")[1]).toBe("#14386B");
    await expect(label(page)).toHaveText("Swatch 4");
    for (let i = 7; i < 12; i++) await duplicate.click();
    await expect(strip(page)).toHaveCount(12);
    await expect(duplicate).toBeDisabled();
    await expect(details(page)).toContainText("A palette holds at most 12 colors.");
    await expect(duplicate).toHaveAccessibleDescription("A palette holds at most 12 colors.");
  });

  test("Delete, then Undo, restores the swatch in place", async ({ page }) => {
    await open(page);
    const before = await strip(page).evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label") ?? ""),
    );
    await details(page).getByRole("button", { name: "Delete Swatch 3" }).click();
    await expect(strip(page)).toHaveCount(5);
    await expect(label(page)).toHaveText("Swatch 3");
    await undoKey(page);
    await expect(strip(page)).toHaveCount(6);
    const after = await strip(page).evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label") ?? ""),
    );
    expect(after.map((l) => l.split(", ")[1])).toEqual(before.map((l) => l.split(", ")[1]));
  });
});

test.describe("reset to extracted", () => {
  test("is disabled for an unedited swatch; after an edit it restores the color and shows the ΔE", async ({
    page,
  }) => {
    await open(page);
    const reset = details(page).getByRole("button", { name: "Reset to extracted" });
    await expect(reset).toBeDisabled();
    const hex = details(page).getByLabel("HEX", { exact: true });
    await hex.fill("#14386F");
    await hex.press("Enter");
    await expect(hex).toHaveValue("#14386F");
    await expect(reset).toBeEnabled();
    // Like the color editor, an edit pins the swatch (decision 24); Reset clears the pin.
    const pin = page.locator("[data-testid=swatch-editor]:visible").getByTestId("pin-button");
    await expect(pin).toBeVisible();
    await expect(details(page).getByTestId("reset-delta")).toHaveText(/^ΔE OK 0\.\d{3}$/);
    await reset.click();
    await expect(hex).toHaveValue("#14386B");
    await expect(pin).toHaveCount(0);
    await expect(reset).toBeDisabled();
  });
});

test.describe("sample settings", () => {
  test("the radius and Mean/Median are stored on the swatch", async ({ page }, info) => {
    await open(page);
    const radius = details(page).getByTestId("sample-radius");
    const stat = details(page).getByTestId("sample-stat");
    await expect(radius.getByRole("button", { name: "Auto" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await radius.getByRole("button", { name: "5", exact: true }).click();
    await stat.getByRole("button", { name: "Median" }).click();
    await expect(radius.getByRole("button", { name: "5", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(stat.getByRole("button", { name: "Median" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Switching to another swatch shows that swatch's own values (the sheet covers the strip on
    // phones, so only desktop switches).
    if (isPhoneProject(info)) return;
    await strip(page).nth(0).click();
    await expect(radius.getByRole("button", { name: "Auto" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(stat.getByRole("button", { name: "Mean" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

test.describe("cluster map toggle (D21, 13d)", () => {
  test("the toggle in the swatch row shows the overlay on desktop too", async ({ page }, info) => {
    test.skip(isPhoneProject(info), "the phone case is below");
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, "rows=swatch");
    await details(page).locator("#cluster-map-toggle").click();
    await expect(page.locator("[data-testid=cluster-overlay]")).toBeVisible();
  });

  test("phone: the Cluster map toggle in the swatch sheet shows the overlay", async ({
    page,
  }, info) => {
    test.skip(!isPhoneProject(info), "needs the phone layout");
    await open(page);
    const toggle = details(page).locator("#cluster-map-toggle");
    await toggle.tap();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    // The map belongs to the image, on the Source tab: close the sheet and look there.
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    await page.getByRole("tab", { name: "Source" }).tap();
    await expect(page.locator("[data-testid=cluster-overlay]")).toBeVisible();
  });
});

test.describe("live regions (spec 6.3)", () => {
  const live = (page: Page, text: string) =>
    page.locator('[role="status"], [aria-live="polite"]').filter({ hasText: text });

  test("a close pair is announced through a live region", async ({ page }) => {
    await open(page);
    const hex = details(page).getByLabel("HEX", { exact: true });
    await hex.fill("#EA6B3B");
    await hex.press("Enter");
    await expect(live(page, "very close").first()).toBeAttached();
    await expect(live(page, "Swatches 1 and 3 are very close").first()).toBeAttached();
  });

  test("reaching 12 colors is announced through a live region", async ({ page }) => {
    await open(page);
    const duplicate = details(page).getByRole("button", { name: "Duplicate" });
    for (let i = 6; i < 12; i++) await duplicate.click();
    await expect(strip(page)).toHaveCount(12);
    await expect(live(page, "A palette holds at most 12 colors.").first()).toBeAttached();
  });
});
