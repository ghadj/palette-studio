import { expect, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";

/**
 * Spec 6.2 acceptance 3: swatch, image and gradient colors are identical in both themes. Compares
 * screenshots of the image well (inset past its rounded border) and the center of every swatch.
 * Gradients arrive in M4.
 */

/**
 * The selected marker's accent ring is themed UI over the image (decision 15e, M3-T12; the zoom controls
 * and well tools sit under the well since decision 42, and stay in the list in case they move); the marker fills and rings are user content and stay compared.
 * Hiding the rest for the shot compares every image pixel, including those under them. The CSP blocks injected style sheets, so this
 * goes through the element's style.
 */
async function hideZoomControls(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>(
      "[data-testid=zoom-controls], [data-testid=well-tools], [data-marker-accent]",
    ))
      el.style.setProperty("visibility", "hidden");
  });
}

async function contentShots(page: Page): Promise<Buffer[]> {
  await page.waitForLoadState("networkidle");
  const image = page.locator(".image-well__image:visible").first();
  await image.evaluate((el) => (el as HTMLImageElement).decode?.());
  const shots: Buffer[] = [];
  const box = await image.boundingBox();
  if (!box) throw new Error("no image");
  const inset = 12; // past --radius-card and the well's border
  await hideZoomControls(page);
  shots.push(
    await page.screenshot({
      clip: {
        x: box.x + inset,
        y: box.y + inset,
        width: box.width - 2 * inset,
        height: box.height - 2 * inset,
      },
    }),
  );
  const swatches = page
    .locator("[data-testid=swatch-strip]:visible")
    .first()
    .locator("[data-swatch]");
  for (const swatch of await swatches.all()) {
    const b = await swatch.boundingBox();
    if (!b) throw new Error("no swatch");
    shots.push(
      await page.screenshot({
        clip: { x: b.x + b.width / 2 - 4, y: b.y + b.height / 2 - 4, width: 8, height: 8 },
      }),
    );
  }
  return shots;
}

/** Largest per-channel difference between two PNGs of the same size, decoded in the page. */
async function maxDifference(page: Page, a: Buffer, b: Buffer): Promise<number> {
  return page.evaluate(
    async ([first, second]) => {
      const load = async (b64: string) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no 2d context");
        ctx.drawImage(bitmap, 0, 0);
        return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      };
      const [x, y] = [await load(first as string), await load(second as string)];
      if (x.width !== y.width || x.height !== y.height) return 255;
      let max = 0;
      for (let i = 0; i < x.data.length; i += 4) {
        for (let c = 0; c < 3; c += 1)
          max = Math.max(max, Math.abs((x.data[i + c] ?? 0) - (y.data[i + c] ?? 0)));
      }
      return max;
    },
    [a.toString("base64"), b.toString("base64")],
  );
}

for (const viewport of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "phone", width: 390, height: 844 },
]) {
  test(`content colors are identical in light and dark: image well and swatches (${viewport.name})`, async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info) && viewport.name === "desktop", "desktop viewport");
    await page.setViewportSize(viewport);
    const shots: Record<string, Buffer[]> = {};
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(demo());
      expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
        scheme === "light" ? "rgb(255, 255, 255)" : "rgb(23, 23, 23)",
      );
      shots[scheme] = await contentShots(page);
    }
    const light = shots.light ?? [];
    const dark = shots.dark ?? [];
    expect(light).toHaveLength(7); // the image and six swatches
    expect(dark).toHaveLength(light.length);
    for (let i = 0; i < light.length; i += 1) {
      expect(await maxDifference(page, light[i] as Buffer, dark[i] as Buffer), `region ${i}`).toBe(
        0,
      );
    }
  });
}

test("overlay pixels are identical in light and dark (spec 2.6, M2 decision 13b)", async ({
  page,
}, info) => {
  const viewport = isPhoneProject(info)
    ? { width: 390, height: 844 }
    : { width: 1280, height: 800 };
  await page.setViewportSize(viewport);
  const shots: Buffer[] = [];
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(demo("cluster=3"));
    await page.waitForLoadState("networkidle");
    const well = page.locator("[data-testid=image-well]:visible").first();
    await expect(
      well.locator("[data-testid=cluster-overlay][data-index='2']:not([data-settling])"),
    ).toHaveCount(1, { timeout: 15_000 });
    await well.locator("img").evaluate((el) => (el as HTMLImageElement).decode?.());
    // The glow-in (M3 decisions 61, 64) is a timed animation: capture the settled overlay, not a
    // frame of it, so the two themes are compared at the same point.
    await page.waitForFunction(() =>
      document.getAnimations().every((a) => a.playState !== "running"),
    );
    const box = await well.boundingBox();
    if (!box) throw new Error("no well");
    const inset = 12;
    await hideZoomControls(page);
    shots.push(
      await page.screenshot({
        clip: {
          x: box.x + inset,
          y: box.y + inset,
          width: box.width - 2 * inset,
          height: box.height - 2 * inset,
        },
      }),
    );
  }
  const [light, dark] = shots as [Buffer, Buffer];
  expect(await maxDifference(page, light, dark)).toBe(0);
});

test("the zoomed image keeps its colors in light and dark (decision 15)", async ({
  page,
}, info) => {
  const viewport = isPhoneProject(info)
    ? { width: 390, height: 844 }
    : { width: 1280, height: 800 };
  await page.setViewportSize(viewport);
  const shots: Buffer[] = [];
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(demo("zoom=4"));
    await page.waitForLoadState("networkidle");
    const well = page.locator("[data-testid=image-well]:visible").first();
    await expect(
      page.locator("[data-testid=image-toolbar]:visible").getByTestId("zoom-level"),
    ).toHaveText("400%");
    await well.locator("img").evaluate((el) => (el as HTMLImageElement).decode?.());
    const box = await well.boundingBox();
    if (!box) throw new Error("no well");
    // The well past its rounded border, with the themed zoom controls hidden.
    const inset = 12;
    await hideZoomControls(page);
    shots.push(
      await page.screenshot({
        clip: {
          x: box.x + inset,
          y: box.y + inset,
          width: box.width - 2 * inset,
          height: box.height - 2 * inset,
        },
      }),
    );
  }
  const [light, dark] = shots as [Buffer, Buffer];
  expect(await maxDifference(page, light, dark)).toBe(0);
});
