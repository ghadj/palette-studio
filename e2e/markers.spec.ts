import { expect, type Locator, type Page, test } from "@playwright/test";
import { encodeSolidPng } from "../tools/png";
import { demo, isPhoneProject, tokenColor } from "./helpers/app";

/** Sample-point markers on the image (spec 3.7, ui-contract "Marker", M3-T12). */

/** The fixture's points (src/state/mockup-fixture.ts), in swatch order. */
const POINTS = [
  { x: 0.204, y: 0.519 },
  { x: 0.463, y: 0.241 },
  { x: 0.769, y: 0.167 },
  { x: 0.38, y: 0.796 },
  { x: 0.889, y: 0.778 },
  { x: 0.102, y: 0.185 },
];

const marker = (page: Page, n: number) => page.locator(`[data-marker="${n}"]`);
const ring = (page: Page, n: number) => marker(page, n).locator(".marker__ring");
const image = (page: Page) => page.locator(".image-well__image:visible").first();
const swatch = (page: Page, n: number) =>
  page
    .locator("[data-testid=swatch-strip]:visible")
    .first()
    .locator("[data-swatch]")
    .nth(n - 1);
const toggle = (page: Page) => page.getByRole("button", { name: "Markers" });

async function center(locator: Locator): Promise<{ x: number; y: number }> {
  const b = await locator.boundingBox();
  if (!b) throw new Error("no box");
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Where the point should show: the image's box on screen, which follows zoom and pan. */
async function expected(page: Page, n: number) {
  const b = await image(page).boundingBox();
  if (!b) throw new Error("no image box");
  const p = POINTS[n - 1] as { x: number; y: number };
  return { x: b.x + p.x * b.width, y: b.y + p.y * b.height };
}

test.describe("markers on the image (spec 3.7)", () => {
  test("demo: six markers at the fixture points (± 2 px); marker 3 is selected", async ({
    page,
  }) => {
    await page.goto(demo());
    await expect(page.locator("[data-marker]")).toHaveCount(6);
    for (let n = 1; n <= 6; n += 1) {
      const c = await center(ring(page, n));
      const e = await expected(page, n);
      expect(Math.abs(c.x - e.x), `marker ${n} x`).toBeLessThanOrEqual(2);
      expect(Math.abs(c.y - e.y), `marker ${n} y`).toBeLessThanOrEqual(2);
    }
    for (let n = 1; n <= 6; n += 1) {
      await expect(marker(page, n)).toHaveAttribute("aria-pressed", n === 3 ? "true" : "false");
    }
  });

  test("accessible names give the number and the position", async ({ page }) => {
    await page.goto(demo());
    await expect(marker(page, 3)).toHaveAttribute("aria-label", "Swatch 3 marker, 77%, 17%");
  });

  test("hovering marker 2 sets data-linked on swatch 2, and the reverse", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "touch has no hover");
    await page.goto(demo());
    await marker(page, 2).hover();
    await expect(swatch(page, 2)).toHaveAttribute("data-linked", "");
    await expect(swatch(page, 1)).not.toHaveAttribute("data-linked", "");
    await page.mouse.move(0, 0);
    await expect(swatch(page, 2)).not.toHaveAttribute("data-linked", "");
    await swatch(page, 4).hover();
    await expect(marker(page, 4)).toHaveAttribute("data-linked", "");
    await expect(marker(page, 2)).not.toHaveAttribute("data-linked", "");
  });

  test("tapping marker 5 selects swatch 5 (phone)", async ({ page }, info) => {
    test.skip(!isPhoneProject(info), "phone");
    await page.goto(demo());
    // Marker 5 sits under the zoom pill at Fit, so tap the strip of its hit area above the pill.
    await marker(page, 5).tap({ position: { x: 22, y: 3 } });
    await expect(marker(page, 5)).toHaveAttribute("aria-pressed", "true");
    await expect(swatch(page, 5)).toHaveAttribute("aria-pressed", "true");
  });

  test("a marker under the zoom pill is reachable from the keyboard and the strip", async ({
    page,
  }) => {
    await page.goto(demo());
    await marker(page, 5).focus();
    await page.keyboard.press("Enter");
    await expect(swatch(page, 5)).toHaveAttribute("aria-pressed", "true");
    await swatch(page, 1).click();
    await expect(marker(page, 5)).toHaveAttribute("aria-pressed", "false");
    await swatch(page, 5).click();
    // The selected marker rises above the pill, so it can be pointed at.
    const b = await marker(page, 5).boundingBox();
    if (!b) throw new Error("no box");
    const hit = await page.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.closest("[data-marker]")?.getAttribute("data-marker"),
      { x: b.x + b.width / 2, y: b.y + b.height / 2 },
    );
    expect(hit).toBe("5");
  });

  test("the marker diameter is the same at zoom 1 and 4, and markers stay on their patches at zoom 4", async ({
    page,
  }) => {
    await page.goto(demo());
    const one = await ring(page, 3).boundingBox();
    await page.goto(demo("zoom=4"));
    const four = await ring(page, 3).boundingBox();
    expect(one && four).toBeTruthy();
    expect(four?.width).toBeCloseTo(one?.width ?? 0, 1);
    expect(four?.height).toBeCloseTo(one?.height ?? 0, 1);
    for (let n = 1; n <= 6; n += 1) {
      const c = await center(ring(page, n));
      const e = await expected(page, n);
      expect(Math.abs(c.x - e.x), `marker ${n} x`).toBeLessThanOrEqual(2);
      expect(Math.abs(c.y - e.y), `marker ${n} y`).toBeLessThanOrEqual(2);
    }
  });

  test("the hit area is at least 44 × 44", async ({ page }) => {
    await page.goto(demo());
    for (let n = 1; n <= 6; n += 1) {
      const b = await marker(page, n).boundingBox();
      expect(b?.width, `marker ${n}`).toBeGreaterThanOrEqual(44);
      expect(b?.height, `marker ${n}`).toBeGreaterThanOrEqual(44);
    }
    const style = await marker(page, 1).evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.touchAction, s.userSelect];
    });
    expect(style).toEqual(["none", "none"]);
  });

  test("the show/hide toggle hides all markers and is view state (not in undo)", async ({
    page,
  }) => {
    await page.goto(demo());
    await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("[data-marker]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Undo/ }).first()).toBeDisabled();
    await toggle(page).click();
    await expect(page.locator("[data-marker]")).toHaveCount(6);
  });

  test("the toggle is a full-size control and clear of the zoom controls", async ({
    page,
  }, info) => {
    const min = isPhoneProject(info) ? 44 : 32; // --hit: 44 px on touch, 32 px on desktop
    await page.goto(demo());
    const t = await toggle(page).boundingBox();
    const z = await page.getByTestId("zoom-controls").boundingBox();
    expect(t?.width).toBeGreaterThanOrEqual(min);
    expect(t?.height).toBeGreaterThanOrEqual(min);
    if (!t || !z) throw new Error("no box");
    expect(t.x + t.width).toBeLessThanOrEqual(z.x);
  });

  test("the cluster overlay and the markers can show together", async ({ page }) => {
    await page.goto(demo("cluster=3"));
    await expect(page.locator(".image-well__overlay")).toBeVisible();
    await expect(page.locator("[data-marker]")).toHaveCount(6);
    await expect(marker(page, 1)).toBeVisible();
  });

  test("loupe=3 shows #14386B", async ({ page }) => {
    await page.goto(demo("loupe=3"));
    const loupe = page.getByTestId("loupe");
    await expect(loupe).toBeVisible();
    await expect(loupe).toContainText("#14386B");
    await expect(loupe.locator("canvas")).toBeVisible();
    await page.goto(demo());
    await expect(page.getByTestId("loupe")).toHaveCount(0);
  });

  test("markers and their toggle hide in the Palette and Values views", async ({ page }) => {
    for (const view of ["palette", "values"]) {
      await page.goto(demo(`image=${view}`));
      await expect(page.locator("[data-testid=image-well]:visible")).toBeVisible();
      await expect(page.locator("[data-marker]")).toHaveCount(0);
      await expect(toggle(page)).toHaveCount(0);
    }
  });
});

/** Counts the pixels of a clip that match each "r,g,b" exactly, decoded in the page. */
async function countColors(
  page: Page,
  clip: { x: number; y: number; width: number; height: number },
  colors: string[],
): Promise<number[]> {
  const png = await page.screenshot({ clip });
  return page.evaluate(
    async ([b64, wanted]) => {
      const bytes = Uint8Array.from(atob(b64 as string), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.drawImage(bitmap, 0, 0);
      const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
      const counts = (wanted as string[]).map(() => 0);
      for (let i = 0; i < data.length; i += 4) {
        const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
        (wanted as string[]).forEach((w, j) => {
          if (w === key) counts[j] = (counts[j] ?? 0) + 1;
        });
      }
      return counts;
    },
    [png.toString("base64"), colors] as const,
  );
}

for (const [name, rgb] of [
  ["white", [255, 255, 255]],
  ["black", [0, 0, 0]],
] as const) {
  test(`markers are visible on an all-${name} runtime image: both ring colors are present`, async ({
    page,
  }) => {
    await page.goto("./");
    await page.getByTestId("file-input").setInputFiles({
      name: `${name}.png`,
      mimeType: "image/png",
      buffer: encodeSolidPng(200, 120, [...rgb]),
    });
    await expect(page.locator("[data-marker]").first()).toBeVisible();
    await page.mouse.move(0, 0);
    const box = await ring(page, 1).boundingBox();
    if (!box) throw new Error("no ring");
    const toRgb = (css: string) =>
      css
        .replace(/[^\d,]/g, "")
        .split(",")
        .slice(0, 3)
        .join(",");
    const outer = toRgb(await tokenColor(page, "--marker-ring-outer"));
    const inner = toRgb(await tokenColor(page, "--marker-ring-inner"));
    const [o, i] = await countColors(page, box, [outer, inner]);
    expect(o, "outer ring pixels").toBeGreaterThan(0);
    expect(i, "inner ring pixels").toBeGreaterThan(0);
  });
}
