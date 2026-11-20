import { defineConfig, devices } from "@playwright/test";

const base = process.env.BASE_PATH ?? "/palette-studio/";
// E2E_PORT lets two checkouts run their suites side by side (Playwright reuses a running server).
const port = Number(process.env.E2E_PORT ?? 4173);
const baseURL = `http://localhost:${port}${base}`;

// Functional tests live in e2e/*.spec.ts; e2e/visual holds the screenshot projects.
const functional = { testIgnore: /visual\// };

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  // Visual baselines (visual-testing.md 3). They are generated and compared only in CI, inside the
  // Playwright Docker image pinned to @playwright/test's version, and updated only by
  // .github/workflows/visual-baselines.yml after the review page is approved.
  snapshotPathTemplate: "{testDir}/visual/baselines/{arg}{ext}",
  expect: {
    toHaveScreenshot: { animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.002 },
  },
  projects: [
    { name: "chromium", ...functional, use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", ...functional, use: { ...devices["Desktop Safari"] } },
    { name: "firefox", ...functional, use: { ...devices["Desktop Firefox"] } },
    { name: "phone-webkit", ...functional, use: { ...devices["iPhone 13"] } },
    { name: "phone-chromium", ...functional, use: { ...devices["Pixel 7"] } },
    {
      name: "visual-review",
      testMatch: /visual\/review\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], deviceScaleFactor: 1 },
    },
    {
      name: "visual",
      testMatch: /visual\/baseline\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], deviceScaleFactor: 1 },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
