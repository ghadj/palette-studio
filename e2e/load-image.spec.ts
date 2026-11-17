import { expect, type Page, test } from "@playwright/test";
import { encodeSolidPng } from "../tools/png";
import { dataTransferWith, fixture, fixtureFile } from "./helpers/files";

const canvas = (page: Page) => page.locator("[data-testid=image-well] canvas:visible");
const projectButton = (page: Page) => page.locator("header").locator(".project-button__name");

async function expectLoaded(page: Page, name: string, width: number, height: number) {
  await expect(canvas(page)).toHaveAttribute("aria-label", `Source image, ${name}`);
  const well = page.locator("[data-testid=image-well]:visible");
  await expect(well).toHaveAttribute("data-width", String(width));
  await expect(well).toHaveAttribute("data-height", String(height));
  await expect(page.getByTestId("drop-zone")).toHaveCount(0);
}

test.describe("load an image (spec 2.1, 6 Input, 6.1, 6.3)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
    await expect(page.getByTestId("drop-zone")).toBeVisible();
  });

  test("first visit shows a drop zone with Choose image, Paste and three sample images", async ({
    page,
  }) => {
    const zone = page.getByTestId("drop-zone");
    await expect(zone.getByRole("button", { name: "Choose image" })).toBeVisible();
    await expect(zone.getByRole("button", { name: "Paste" })).toBeVisible();
    await expect(zone.getByRole("button", { name: /^Load the .* sample$/ })).toHaveCount(3);
    const input = page.getByTestId("file-input");
    await expect(input).toHaveAttribute("accept", "image/*");
    expect(await input.getAttribute("capture")).toBeNull();
  });

  test("picker loads two-color.png and shows it", async ({ page }) => {
    await page.getByTestId("file-input").setInputFiles(fixture("two-color.png"));
    await expectLoaded(page, "two-color.png", 40, 40);
    const pixel = await canvas(page).evaluate((el) => {
      const c = el as HTMLCanvasElement;
      return Array.from(c.getContext("2d")?.getImageData(2, 2, 1, 1).data ?? []);
    });
    expect(pixel).toEqual([0x1d, 0xb0, 0x7a, 255]);
    // The working master was made in the image worker (spec 7.4).
    expect(page.workers().length).toBeGreaterThan(0);
    await expect(page.locator("[data-testid=image-well]:visible")).toHaveAttribute(
      "data-master-thread",
      "worker",
    );
  });

  test("drop loads an image", async ({ page }) => {
    const dt = await dataTransferWith(page, fixtureFile("two-color.png", "image/png"));
    const zone = page.getByTestId("drop-zone");
    await zone.dispatchEvent("dragover", { dataTransfer: dt });
    await zone.dispatchEvent("drop", { dataTransfer: dt });
    await expectLoaded(page, "two-color.png", 40, 40);
  });

  test("paste loads an image (Chromium)", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "synthetic paste events with files are Chromium only");
    const dt = await dataTransferWith(page, fixtureFile("single-color.png", "image/png"));
    await page.evaluate((data) => {
      document.body.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
      );
    }, dt);
    await expectLoaded(page, "single-color.png", 16, 16);
  });

  test("a sample image button loads", async ({ page }) => {
    await page.getByRole("button", { name: "Load the Tiles sample" }).click();
    await expectLoaded(page, "Tiles.png", 960, 640);
    await expect(projectButton(page)).toHaveText("Tiles");
  });

  test("not-an-image.txt shows the inline message and the previous image stays", async ({
    page,
  }) => {
    const input = page.getByTestId("file-input");
    await input.setInputFiles(fixture("two-color.png"));
    await expectLoaded(page, "two-color.png", 40, 40);
    await input.setInputFiles(fixture("not-an-image.txt"));
    const message = page.getByTestId("image-message").filter({ visible: true }).first();
    await expect(message.getByRole("alert")).toHaveText(
      "TXT files can't be loaded. Use JPEG, PNG, WebP, GIF, AVIF or SVG.",
    );
    await expectLoaded(page, "two-color.png", 40, 40);
    await expect(projectButton(page)).toHaveText("two-color");
    // A good file clears the message.
    await input.setInputFiles(fixture("single-color.png"));
    await expectLoaded(page, "single-color.png", 16, 16);
    await expect(message.getByRole("alert")).toHaveCount(0);
  });

  test("exif-orientation-6.jpg displays in portrait", async ({ page }) => {
    await page.getByTestId("file-input").setInputFiles(fixture("exif-orientation-6.jpg"));
    await expectLoaded(page, "exif-orientation-6.jpg", 40, 80);
    const box = await canvas(page).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(box?.width ?? 0);
    // Stored with red on the left; rotated 90° clockwise, red is on top.
    const [top, bottom] = await canvas(page).evaluate((el) => {
      const ctx = (el as HTMLCanvasElement).getContext("2d");
      return [
        Array.from(ctx?.getImageData(20, 10, 1, 1).data ?? []),
        Array.from(ctx?.getImageData(20, 70, 1, 1).data ?? []),
      ];
    });
    expect(top?.[0]).toBeGreaterThan(200);
    expect(top?.[2]).toBeLessThan(60);
    expect(bottom?.[2]).toBeGreaterThan(200);
    expect(bottom?.[0]).toBeLessThan(60);
  });

  test("project name becomes the file name without extension", async ({ page }) => {
    await expect(projectButton(page)).toHaveText("Untitled");
    await page.getByTestId("file-input").setInputFiles(fixture("two-color.png"));
    await expect(projectButton(page)).toHaveText("two-color");
  });

  test("a generated 31 MP image shows the large-image note and loads", async ({ page }) => {
    test.slow();
    await page.getByTestId("file-input").setInputFiles({
      name: "huge.png",
      mimeType: "image/png",
      buffer: encodeSolidPng(6200, 5000, [200, 120, 40]),
    });
    await expectLoaded(page, "huge.png", 6200, 5000);
    await expect(page.getByTestId("image-message").filter({ visible: true }).first()).toHaveText(
      "This image is 31.0 megapixels, so it is scaled down to 4096 px on the longest edge.",
    );
    // The display copy is at most 2048 px; the master never exceeds 4096 px (spec 7.4).
    await expect(canvas(page)).toHaveAttribute("width", "2048");
  });

  test("the main-thread fallback loads images when workers can't draw", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __paletteStudioMainThread: boolean }).__paletteStudioMainThread =
        true;
    });
    await page.goto("./");
    await page.getByTestId("file-input").setInputFiles(fixture("exif-orientation-6.jpg"));
    await expectLoaded(page, "exif-orientation-6.jpg", 40, 80);
    await expect(page.locator("[data-testid=image-well]:visible")).toHaveAttribute(
      "data-master-thread",
      "main",
    );
  });
});
