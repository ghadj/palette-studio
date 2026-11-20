/**
 * The close-in-value and very-close swatches get a corner dot and one legend line; pairs are not
 * listed (M3 decisions 51 and 52). Corners: top-left the dot, top-right the X (selected), bottom-left
 * the pin or lock badge. None may overlap.
 */
import { expect, type Locator, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";

const SIZES = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
];

type Box = { x: number; y: number; width: number; height: number };
const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

async function box(l: Locator): Promise<Box> {
  const b = await l.boundingBox();
  if (!b) throw new Error("no box");
  return b;
}

async function checkCorners(page: Page, flaggedSwatch: Locator): Promise<void> {
  const dot = flaggedSwatch.getByTestId("close-flag");
  await expect(dot).toBeVisible();
  const badge = flaggedSwatch.locator(".swatch__badge");
  await expect(badge).toBeVisible();
  const x = page.locator("[data-testid=remove-swatch]:visible .swatch-remove__chip").first();
  const tile = await box(flaggedSwatch);
  const d = await box(dot);
  const b = await box(badge);
  const c = await box(x);
  expect(d.x - tile.x, "dot at the left").toBeLessThanOrEqual(8);
  expect(d.y - tile.y, "dot at the top").toBeLessThanOrEqual(8);
  expect(b.y + b.height, "badge at the bottom").toBeGreaterThan(tile.y + tile.height - 10);
  expect(overlap(d, c), "dot and X").toBe(false);
  expect(overlap(d, b), "dot and badge").toBe(false);
  expect(overlap(b, c), "badge and X").toBe(false);
}

for (const theme of ["light", "dark"]) {
  for (const size of SIZES) {
    test.describe(`${theme} at ${size.width} px`, () => {
      test.beforeEach(async ({ page }, info) => {
        test.skip(
          size.width >= 1024
            ? isPhoneProject(info)
            : !isPhoneProject(info) && info.project.name !== "chromium",
          "layout matches the project",
        );
        await page.setViewportSize(size);
      });

      test("Values view: swatches 1 and 2 only, legend under the strip, no overlaps", async ({
        page,
      }) => {
        await page.goto(demo(`tab=palette&image=values&theme=${theme}`));
        const swatches = page.locator("[data-testid=swatch-strip]:visible [data-swatch]");
        const flagged = await swatches.evaluateAll((els) =>
          els.map((el) => el.querySelector("[data-testid=close-flag]") !== null),
        );
        expect(flagged).toEqual([true, true, false, false, false, false]);
        await expect(page.locator("[data-testid=close-legend]:visible")).toHaveText(
          "Close in value",
        );
        await swatches.first().click();
        await page.getByRole("button", { name: "Lock", exact: true }).click();
        await checkCorners(page, swatches.first());
        // The dot is visible on the swatch: it has its own ring and a warn fill, not the swatch's color.
        const style = await swatches
          .first()
          .getByTestId("close-flag")
          .evaluate((el) => {
            const s = getComputedStyle(el);
            return { bg: s.backgroundColor, ring: s.borderTopColor, shadow: s.boxShadow };
          });
        expect(style.bg).not.toBe(style.ring);
        expect(style.shadow).not.toBe("none");
      });

      test("Image view: a swatch edited close to another gets the dot, legend and no overlaps", async ({
        page,
      }) => {
        await page.goto(demo(`tab=palette&theme=${theme}`));
        const hex = page.locator("[data-testid=swatch-editor]:visible").getByLabel("HEX", {
          exact: true,
        });
        await hex.fill("#EA6B3B");
        await hex.press("Enter");
        await page.getByRole("button", { name: "Lock", exact: true }).click();
        const swatches = page.locator("[data-testid=swatch-strip]:visible [data-swatch]");
        await expect(page.locator("[data-testid=close-legend]:visible")).toHaveText(
          "Very close colors",
        );
        await checkCorners(page, swatches.nth(2));
        await expect(swatches.nth(0).getByTestId("close-flag")).toBeVisible();
      });
    });
  }
}
