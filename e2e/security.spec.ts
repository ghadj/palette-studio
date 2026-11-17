import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

// Spec 7.8. The policy is applied as a meta tag in the production build only.
const SPEC_CSP =
  "default-src 'self'; img-src 'self' blob: data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'";

test.describe("security (spec 7.8)", () => {
  test("production page carries the spec 7.8 CSP meta", async ({ page }) => {
    await page.goto("./");
    const metas = page.locator('meta[http-equiv="Content-Security-Policy"]');
    await expect(metas).toHaveCount(1);
    await expect(metas).toHaveAttribute("content", SPEC_CSP);
  });

  test("dist/index.html has no inline script, no style element and no style attribute", () => {
    const html = readFileSync(resolve(process.cwd(), "dist/index.html"), "utf8");
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    expect(scripts.length).toBeGreaterThan(0);
    for (const [, attrs, body] of scripts) {
      expect(attrs, "every script has a src").toMatch(/\bsrc=/);
      expect(body?.trim(), "scripts have no inline body").toBe("");
    }
    expect(html).not.toMatch(/<style\b/i);
    expect(html).not.toMatch(/\sstyle\s*=/i);
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
  });

  test("dist carries the licence notice of every runtime dependency (spec 7.10)", async ({
    request,
  }) => {
    const root = process.cwd();
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    const notices = readFileSync(resolve(root, "dist/licenses.md"), "utf8");
    const names = Object.keys(pkg.dependencies);
    expect(names.sort()).toEqual(["@preact/signals", "culori", "lucide-preact", "preact"]);
    for (const name of names) {
      const installed = JSON.parse(
        readFileSync(resolve(root, "node_modules", name, "package.json"), "utf8"),
      ) as { version: string; license: string };
      const heading = `## ${name} - ${installed.version} (${installed.license})`;
      const start = notices.indexOf(heading);
      expect(start, heading).toBeGreaterThan(-1);
      const next = notices.indexOf("\n## ", start + heading.length);
      const body = notices.slice(start + heading.length, next < 0 ? undefined : next);
      expect(body, name).toMatch(/Copyright/);
      expect(body, name).toMatch(/Permission/);
    }
    // It is published with the site.
    const response = await request.get("licenses.md");
    expect(response.ok()).toBe(true);
  });

  test("every request during load and use is same-origin", async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? "").origin;
    const foreign: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.protocol === "data:" || url.protocol === "blob:") return;
      if (url.origin !== origin) foreign.push(request.url());
    });

    for (const path of ["./", "./?demo=mockup"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      // Use the app: press every visible button once (links may leave the page, so skip them).
      const buttons = page.locator("button:visible");
      const count = await buttons.count();
      for (let i = 0; i < count; i += 1) {
        const button = buttons.nth(i);
        if (!(await button.isVisible()) || !(await button.isEnabled())) continue;
        await button.click({ trial: false, timeout: 2000 }).catch(() => undefined);
        await page.keyboard.press("Escape");
      }
      await page.waitForLoadState("networkidle");
    }
    expect(foreign).toEqual([]);
  });
});
