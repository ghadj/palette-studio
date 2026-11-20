/**
 * Each phone and tablet tab keeps its own scroll position (M3 decision 44, user request
 * 2026-11-20). Below 1024 px the window scrolls; switching tabs restores the tab's last position,
 * and a tab not visited yet starts at the top.
 */
import { expect, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";

const SIZES = [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
];

for (const size of SIZES) {
  test(`each tab keeps its own scroll at ${size.width} x ${size.height}`, async ({
    page,
  }, info) => {
    test.skip(!isPhoneProject(info) && info.project.name !== "chromium", "phone layout only");
    await page.setViewportSize(size);
    await page.goto(demo());
    const bar = page.getByTestId("tabbar");
    await expect(bar).toBeVisible();
    // A spacer on the body outlasts the tab panels, so every tab can scroll far.
    await page.evaluate(() => {
      const spacer = document.createElement("div");
      spacer.style.height = "3000px";
      document.body.append(spacer);
    });
    const y = () => page.evaluate(() => Math.round(window.scrollY));
    const settle = () =>
      page.evaluate(
        () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
      );
    const scrollTo = async (to: number) => {
      await page.evaluate((v) => window.scrollTo(0, v), to);
      await settle();
    };
    const show = async (name: "Source" | "Palette") => {
      await bar.getByRole("tab", { name }).click();
      await settle();
    };

    await scrollTo(300);
    const sourceY = await y();
    expect(sourceY).toBeGreaterThan(100);
    await show("Palette");
    expect(await y(), "Palette starts at the top the first time").toBe(0);
    await scrollTo(520);
    const paletteY = await y();
    expect(paletteY).toBeGreaterThan(sourceY);
    await show("Source");
    expect(await y(), "Source is back at Y").toBe(sourceY);
    await show("Palette");
    expect(await y(), "Palette is back at Z").toBe(paletteY);
    await show("Source");
    expect(await y()).toBe(sourceY);
  });
}
