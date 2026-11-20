/**
 * M4-T2: the Gradient column and tab scaffold. The layout and the pinned dock are fixed here, so
 * the wave-1 tasks fill their own files (plan M4-T2). Each later task adds its own spec file.
 */
import { expect, type Locator, type Page, test } from "@playwright/test";
import { demo, isPhoneProject } from "./helpers/app";
import { openExport, sheetSettled } from "./helpers/sheet";

/** The vertical centers of the column's pieces, top to bottom: the order the contract fixes. */
async function order(scope: Locator): Promise<string[]> {
  const parts: Array<[string, Locator]> = [
    ["preview", scope.getByTestId("gradient-preview")],
    ["chips", scope.getByTestId("gradient-types")],
    ["stop-bar", scope.getByTestId("stop-bar")],
    [
      "interpolation",
      scope.getByTestId("gradient-rows").getByText("Interpolation", { exact: true }),
    ],
    ["technique", scope.getByTestId("gradient-rows").getByText("Technique", { exact: true })],
    ["interpolation-options", scope.locator("[data-row=interpolation]")],
    ["stop", scope.locator("[data-row=stop]")],
    ["geometry", scope.locator("[data-row=geometry]")],
    ["preview-row", scope.locator("[data-row=preview]")],
  ];
  const tops = await Promise.all(
    parts.map(async ([name, locator]) => {
      await expect(locator, name).toBeVisible();
      const b = await locator.boundingBox();
      return [name, b?.y ?? -1] as const;
    }),
  );
  return [...tops].sort((a, b) => a[1] - b[1]).map(([name]) => name);
}

const EXPECTED = [
  "preview",
  "chips",
  "stop-bar",
  "interpolation",
  "technique",
  "interpolation-options",
  "stop",
  "geometry",
  "preview-row",
];

test.describe("Gradient column and tab (M4-T2)", () => {
  test("desktop: column 3 holds the preview, chips, stop bar, the Interpolation and Technique rows, then the Interpolation options, Stop, Geometry and Preview chevron rows, in that order", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "desktop layout");
    await page.setViewportSize({ width: 1280, height: 1280 });
    await page.goto(demo());
    const column = page.locator("[data-column=gradient]");
    expect(await order(column)).toEqual(EXPECTED);
    await expect(column.locator("[data-row]")).toHaveCount(4);
    await expect(column.locator("[data-row]")).toHaveText([
      /^Interpolation options/,
      /^Stop/,
      /^Geometry/,
      /^Preview/,
    ]);
  });

  test("phone: the Gradient tab has the same order", async ({ page }, info) => {
    test.skip(!isPhoneProject(info), "phone projects");
    await page.goto(demo("tab=gradient"));
    expect(await order(page.locator("[data-panel=gradient]"))).toEqual(EXPECTED);
  });

  test("the preview's data-stops reads #1DB07A@0,#D4527F@50,#5039B0@100, and the preview is data-user-content", async ({
    page,
  }, info) => {
    if (isPhoneProject(info)) await page.goto(demo("tab=gradient"));
    else {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(demo());
    }
    const preview = page.getByTestId("gradient-preview");
    await expect(preview).toHaveAttribute("data-stops", "#1DB07A@0,#D4527F@50,#5039B0@100");
    await expect(preview).toHaveAttribute("data-user-content", "");
    await expect(preview).toHaveAttribute("data-type", "linear");
    await expect(preview).toHaveAttribute("data-angle", "90");
    await expect(preview).toHaveAttribute("data-space", "oklab");
    await expect(preview).toHaveAttribute("data-hue", "shorter");
    await expect(preview).toHaveAttribute("data-easing", "linear");
    await expect(preview).toHaveAttribute("data-render", "native");
    await expect(preview).toHaveAttribute("data-cvd", "normal");
  });

  test("demo parameters reach the preview: gradient=conic and space=oklch", async ({
    page,
  }, info) => {
    if (isPhoneProject(info)) await page.goto(demo("tab=gradient&gradient=conic&space=oklch"));
    else {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(demo("gradient=conic&space=oklch"));
    }
    const preview = page.getByTestId("gradient-preview");
    await expect(preview).toHaveAttribute("data-type", "conic");
    await expect(preview).toHaveAttribute("data-space", "oklch");
    await expect(page.getByTestId("interpolation-value")).toHaveText("OKLCH");
  });

  test("the technique row reads Smooth path", async ({ page }, info) => {
    if (isPhoneProject(info)) await page.goto(demo("tab=gradient"));
    else {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(demo());
    }
    await expect(page.getByTestId("technique-value")).toHaveText("Smooth path");
    await expect(page.getByTestId("interpolation-value")).toHaveText("OKLab");
  });
});

async function spaceTwo(page: Page): Promise<number> {
  return page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.height = "var(--space-2)";
    document.body.append(probe);
    const h = probe.getBoundingClientRect().height;
    probe.remove();
    return h;
  });
}

test.describe("Gradient-tab drawers stop below the pinned preview (M4 plan Q2; M3 decisions 46, 59)", () => {
  for (const row of ["interpolation", "stop"] as const) {
    test(`phone: rows=${row} opens a sheet whose panel stops at the dock's bottom plus --space-2 (±1 px), with the page locked`, async ({
      page,
    }, info) => {
      test.skip(!isPhoneProject(info), "phone projects");
      await page.goto(demo(`tab=gradient&rows=${row}`));
      await sheetSettled(page);
      const dock = await page.getByTestId("gradient-dock").boundingBox();
      const panel = await page.getByRole("dialog").locator(".bottom-sheet__panel").boundingBox();
      const scrim = await page.getByRole("dialog").getByTestId("sheet-scrim").boundingBox();
      if (!dock || !panel || !scrim) throw new Error("no boxes");
      const gap = await spaceTwo(page);
      expect(gap).toBeGreaterThan(0);
      const dockBottom = dock.y + dock.height;
      // The panel is anchored to the bottom and sized to its content, so it starts at or below the
      // gap; its largest height is the space between the gap and the viewport's bottom.
      expect(panel.y).toBeGreaterThanOrEqual(dockBottom + gap - 1);
      const viewport = page.viewportSize();
      const maxHeight = await page
        .getByRole("dialog")
        .locator(".bottom-sheet__panel")
        .evaluate((el) => Number.parseFloat(getComputedStyle(el).maxHeight));
      expect(
        Math.abs(maxHeight - ((viewport?.height ?? 0) - dockBottom - gap)),
      ).toBeLessThanOrEqual(1);
      // The scrim starts at the dock and covers the gap.
      expect(Math.abs(scrim.y - (dock.y + dock.height))).toBeLessThanOrEqual(1);
      // The preview stays visible above the sheet.
      const preview = await page.getByTestId("gradient-preview").boundingBox();
      expect(preview?.y).toBeGreaterThanOrEqual(0);
      expect((preview?.y ?? 0) + (preview?.height ?? 0)).toBeLessThanOrEqual(panel.y);
      // The page is locked: the root carries the class and doesn't scroll.
      await expect(page.locator("html")).toHaveClass(/sheet-locked/);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe(
        "hidden",
      );
      await expect(page.getByRole("dialog")).toContainText("Coming in a later version");
    });
  }

  test("phone: the dock is sticky under the header, at most 30% of the screen tall", async ({
    page,
  }, info) => {
    test.skip(!isPhoneProject(info), "phone projects");
    await page.goto(demo("tab=gradient"));
    const dock = page.getByTestId("gradient-dock");
    expect(await dock.evaluate((el) => getComputedStyle(el).position)).toBe("sticky");
    const preview = await page.getByTestId("gradient-preview").boundingBox();
    const viewport = page.viewportSize();
    expect(preview?.height).toBeLessThanOrEqual((viewport?.height ?? 0) * 0.3 + 0.5);
    // --dock-height carries the dock's height, for the scroll padding.
    const height = await dock.evaluate((el) => el.getBoundingClientRect().height);
    const written = await page.evaluate(() =>
      Number.parseFloat(document.documentElement.style.getPropertyValue("--dock-height")),
    );
    expect(Math.abs(written - height)).toBeLessThanOrEqual(1);
  });

  test("desktop: scrolling column 3 pins the dock at its top, with the divider", async ({
    page,
  }, info) => {
    test.skip(isPhoneProject(info), "desktop layout");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(demo());
    const scroller = page.locator("[data-column=gradient] [data-testid=column-scroll]");
    const dock = page.getByTestId("gradient-dock");
    await expect(dock).not.toHaveAttribute("data-stuck");
    // Make the column scroll, then check the preview stays at its top.
    await page.evaluate(() => {
      const spacer = document.createElement("div");
      spacer.style.height = "1600px";
      document.querySelector("[data-panel=gradient]")?.append(spacer);
    });
    await scroller.evaluate((el) => {
      el.scrollTop = 300;
    });
    await expect(dock).toHaveAttribute("data-stuck", "");
    const column = await scroller.boundingBox();
    const d = await dock.boundingBox();
    if (!column || !d) throw new Error("no boxes");
    expect(Math.abs(d.y - column.y)).toBeLessThanOrEqual(2);
    expect(await dock.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe("none");
    expect(await dock.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
    // --dock-height is on the column's scroll container, not the page.
    const written = await scroller.evaluate((el) =>
      Number.parseFloat((el as HTMLElement).style.getPropertyValue("--dock-height")),
    );
    expect(Math.abs(written - d.height)).toBeLessThanOrEqual(1);
  });
});

test.describe("Export from the Gradient tab (M4 plan D26)", () => {
  test("the Export button on the Gradient tab opens the panel on Gradient", async ({
    page,
  }, info) => {
    if (isPhoneProject(info)) await page.goto(demo("tab=gradient"));
    else {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(demo());
      // Focus something in column 3, as the user would.
      await page.locator("[data-column=gradient]").locator("[data-row=stop] button").focus();
    }
    const panel = await openExport(page);
    await expect(panel.getByRole("tab", { name: "Gradient" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(panel.getByTestId("export-soon")).toContainText(
      "CSS, Tailwind, SVG, images, JSON and a stop sheet.",
    );
  });
});
