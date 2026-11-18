import { expect, test } from "@playwright/test";
import { M1_SCREENS, THEMES } from "./helpers/screens";
import { checkTokens, describeFailures } from "./helpers/tokens";

// Token conformance (visual-testing.md section 1). Fix failures with tokens; never widen the lists.
test.describe("token conformance @tokens", () => {
  for (const screen of M1_SCREENS) {
    for (const theme of THEMES) {
      test.describe(`${screen.name} ${theme}`, () => {
        test.beforeEach(async ({ page }) => {
          await page.emulateMedia({ colorScheme: theme });
          await page.setViewportSize(screen.viewport);
          await page.goto(screen.path);
          await expect(page.locator("#app-root")).toBeVisible();
          await page.waitForLoadState("networkidle");
          expect(
            await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme),
          ).toBe("light dark");
        });

        test("colors are tokens or transparent", async ({ page }) => {
          const failures = (await checkTokens(page, { touchTargets: false })).filter(
            (f) => f.kind === "color",
          );
          expect(failures, describeFailures(failures)).toEqual([]);
        });

        test("font sizes are in {12, 13, 15, 16, 20}", async ({ page }) => {
          const failures = (await checkTokens(page, { touchTargets: false })).filter(
            (f) => f.kind === "font-size",
          );
          expect(failures, describeFailures(failures)).toEqual([]);
        });

        test("radii are in {0, 6, 8, 10, 12} or a pill", async ({ page }) => {
          const failures = (await checkTokens(page, { touchTargets: false })).filter(
            (f) => f.kind === "radius",
          );
          expect(failures, describeFailures(failures)).toEqual([]);
        });

        if (screen.device !== "desktop") {
          test("every button, link, input, chip, tab is at least 44 × 44", async ({ page }) => {
            const failures = (await checkTokens(page, { touchTargets: true })).filter(
              (f) => f.kind === "touch-target",
            );
            expect(failures, describeFailures(failures)).toEqual([]);
            // The theme menu's options too.
            await page.getByRole("button", { name: /^Theme/ }).click();
            const open = (await checkTokens(page, { touchTargets: true })).filter(
              (f) => f.kind === "touch-target" || f.kind === "color" || f.kind === "radius",
            );
            expect(open, describeFailures(open)).toEqual([]);
          });
        }
      });
    }
  }

  test("the open theme menu and a toast use tokens in both themes", async ({ page }) => {
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("./?demo=mockup");
      await page.getByRole("button", { name: "Undo" }).click();
      await expect(page.getByTestId("toast-region")).toContainText("Coming in a later version");
      await page.getByRole("button", { name: /^Theme/ }).click();
      await expect(page.getByRole("menu")).toBeVisible();
      const failures = await checkTokens(page, { touchTargets: false });
      expect(failures, describeFailures(failures)).toEqual([]);
    }
  });

  test("the open Advanced settings row uses tokens, with 44 px targets on phones", async ({
    page,
  }) => {
    for (const theme of THEMES) {
      for (const viewport of [
        { width: 1280, height: 800 },
        { width: 390, height: 844 },
      ]) {
        await page.emulateMedia({ colorScheme: theme });
        await page.setViewportSize(viewport);
        await page.goto("./");
        await page.locator("details.chevron-row:visible summary").click();
        await expect(page.locator("#setting-seed:visible")).toBeVisible();
        const failures = await checkTokens(page, { touchTargets: viewport.width <= 600 });
        expect(failures, `${theme} ${viewport.width}\n${describeFailures(failures)}`).toEqual([]);
      }
    }
  });

  test("a failed-copy toast with its Download action uses tokens, with 44 px targets on phones", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    });
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("./?demo=mockup");
      await page.getByRole("button", { name: "Copy HEX" }).click();
      await expect(
        page.getByTestId("toast-region").getByRole("button", { name: "Download" }),
      ).toBeVisible();
      const failures = await checkTokens(page, { touchTargets: true });
      expect(failures, `${theme}\n${describeFailures(failures)}`).toEqual([]);
    }
  });

  test("the open Replace image menu uses tokens, with 44 px targets on phones", async ({
    page,
  }) => {
    for (const theme of THEMES) {
      for (const viewport of [
        { width: 1280, height: 800 },
        { width: 320, height: 568 },
      ]) {
        await page.emulateMedia({ colorScheme: theme });
        await page.setViewportSize(viewport);
        await page.goto("./?demo=mockup");
        await page.locator("header").getByRole("button", { name: "Replace image" }).click();
        await expect(page.getByRole("menu", { name: "Replace image" })).toBeVisible();
        const failures = await checkTokens(page, { touchTargets: viewport.width <= 600 });
        expect(failures, `${theme} ${viewport.width}\n${describeFailures(failures)}`).toEqual([]);
      }
    }
  });

  test("Median cut with Seed and Randomize disabled uses tokens, with 44 px targets on phones", async ({
    page,
  }) => {
    for (const theme of THEMES) {
      for (const viewport of [
        { width: 1280, height: 800 },
        { width: 390, height: 844 },
      ]) {
        await page.emulateMedia({ colorScheme: theme });
        await page.setViewportSize(viewport);
        await page.goto("./");
        await page.locator("#setting-algorithm:visible").selectOption({ label: "Median cut" });
        await page.locator("details.chevron-row:visible summary").click();
        await expect(page.locator("#setting-seed:visible")).toBeDisabled();
        const failures = await checkTokens(page, { touchTargets: viewport.width <= 600 });
        expect(failures, `${theme} ${viewport.width}\n${describeFailures(failures)}`).toEqual([]);
      }
    }
  });

  test("checker self-test: an injected #123456 element is reported with its selector path, and the same element under data-user-content is not", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("./?demo=mockup");
    await expect(page.locator("#app-root")).toBeVisible();
    await page.evaluate(() => {
      const make = (id: string) => {
        const el = document.createElement("div");
        el.id = id;
        el.textContent = "stray";
        el.style.setProperty("color", "#123456");
        el.style.setProperty("font-size", "14px");
        el.style.setProperty("border-radius", "3px");
        el.style.setProperty("width", "200px");
        el.style.setProperty("height", "40px");
        return el;
      };
      document.querySelector("main")?.appendChild(make("stray"));
      const user = document.createElement("div");
      user.setAttribute("data-user-content", "");
      user.appendChild(make("stray-user"));
      document.querySelector("main")?.appendChild(user);
      const button = document.createElement("button");
      button.id = "tiny";
      button.textContent = "x";
      button.style.setProperty("width", "20px");
      button.style.setProperty("height", "20px");
      document.querySelector("main")?.appendChild(button);
    });
    const failures = await checkTokens(page, { touchTargets: true });
    const stray = failures.filter((f) => f.selector.includes("#stray"));
    expect(stray).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "color",
          property: "color",
          value: "rgb(18, 52, 86)",
          selector: expect.stringMatching(
            /^body > div#app > div#app-root.*> main.* > div#stray(:nth-of-type\(\d+\))?$/,
          ),
        }),
        expect.objectContaining({ kind: "font-size", value: "14px" }),
        expect.objectContaining({ kind: "radius", value: "3px" }),
      ]),
    );
    expect(failures.some((f) => f.selector.includes("#stray-user"))).toBe(false);
    expect(failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "touch-target",
          selector: expect.stringMatching(/button#tiny(:nth-of-type\(\d+\))?$/),
        }),
      ]),
    );
  });
});
