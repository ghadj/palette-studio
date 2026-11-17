import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { M1_SHOTS, type Shot } from "../../e2e/visual/shots";
import { buildReviewPage, writeReviewPage } from "../../tools/visual-review";

const SHOTS: Shot[] = [
  {
    name: "studio-desktop",
    path: "./?demo=mockup&view=studio",
    viewport: { width: 1280, height: 800 },
    mockup: { light: "01-studio-light.png", dark: "02-studio-dark.png" },
    frame: "whole frame",
  },
  {
    name: "studio-tablet",
    path: "./?demo=mockup&view=studio",
    viewport: { width: 820, height: 1180 },
    mockup: null,
    frame: "",
  },
];

const rows = (html: string) => html.match(/<tr data-shot=/g) ?? [];

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("visual review page (visual-testing.md 2)", () => {
  it("writes one row per shot and theme with mockup and build images side by side", () => {
    const html = buildReviewPage(SHOTS, () => true);
    expect(rows(html)).toHaveLength(4);
    const row = html.match(/<tr data-shot="studio-desktop" data-theme="dark">[\s\S]*?<\/tr>/)?.[0];
    expect(row).toBeDefined();
    const mockupAt = row?.indexOf('src="mockups/02-studio-dark.png"') ?? -1;
    const buildAt = row?.indexOf('src="studio-desktop-dark.png"') ?? -1;
    expect(mockupAt).toBeGreaterThan(-1);
    expect(buildAt).toBeGreaterThan(mockupAt);
    expect(row).toContain("whole frame");
    expect(row).toContain("1280 × 800");
    // Every M1 shot appears in both themes.
    const all = buildReviewPage(M1_SHOTS, () => true);
    expect(rows(all)).toHaveLength(M1_SHOTS.length * 2);
  });

  it("has a notes column and a link to ui-contract.md", () => {
    const html = buildReviewPage(SHOTS, () => true);
    expect(html).toMatch(/<th[^>]*>Notes<\/th>/);
    expect(html.match(/<textarea/g)).toHaveLength(4);
    expect(html).toMatch(/<a href="ui-contract\.md">ui-contract\.md<\/a>/);
  });

  it("shots without a mockup say 'contract text (not drawn)'", () => {
    const html = buildReviewPage(SHOTS, () => true);
    const row = html.match(/<tr data-shot="studio-tablet" data-theme="light">[\s\S]*?<\/tr>/)?.[0];
    expect(row).toContain("contract text (not drawn)");
    expect(row).not.toContain("mockups/");
  });

  it("a missing screenshot shows as missing, not a broken image", () => {
    const html = buildReviewPage(SHOTS, (file) => file !== "studio-tablet-dark.png");
    const row = html.match(/<tr data-shot="studio-tablet" data-theme="dark">[\s\S]*?<\/tr>/)?.[0];
    expect(row).toContain("Missing: studio-tablet-dark.png");
    expect(row).not.toContain('src="studio-tablet-dark.png"');
    expect(html).toContain('src="studio-tablet-light.png"');
  });

  it("writes index.html and copies the referenced mockups and the contract next to it", () => {
    const root = mkdtempSync(join(tmpdir(), "visual-review-"));
    dirs.push(root);
    const out = join(root, "artifacts/visual-review");
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "studio-desktop-light.png"), "png");
    writeReviewPage({ shots: SHOTS, outDir: out, repoRoot: process.cwd() });
    const html = readFileSync(join(out, "index.html"), "utf8");
    expect(rows(html)).toHaveLength(4);
    expect(html).toContain('src="studio-desktop-light.png"');
    expect(html).toContain("Missing: studio-desktop-dark.png");
    expect(readFileSync(join(out, "mockups/01-studio-light.png")).length).toBeGreaterThan(1000);
    expect(readFileSync(join(out, "mockups/02-studio-dark.png")).length).toBeGreaterThan(1000);
    expect(readFileSync(join(out, "ui-contract.md"), "utf8")).toContain("# UI contract");
  });

  it("escapes text so shot data can't inject HTML", () => {
    const html = buildReviewPage(
      [{ ...SHOTS[1], name: "x<script>", frame: "<b>" } as Shot],
      () => false,
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("x&lt;script&gt;");
  });
});

describe("visual workflows", () => {
  it("use the Playwright image pinned to the installed @playwright/test version", () => {
    const version = JSON.parse(
      readFileSync(join(process.cwd(), "node_modules/@playwright/test/package.json"), "utf8"),
    ).version as string;
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    expect(pkg.devDependencies["@playwright/test"]).toBe(version);
    for (const file of ["ci.yml", "visual-baselines.yml"]) {
      const yml = readFileSync(join(process.cwd(), ".github/workflows", file), "utf8");
      const images = [...yml.matchAll(/mcr\.microsoft\.com\/playwright:v([\d.]+)-jammy/g)];
      expect(images.length, file).toBeGreaterThan(0);
      for (const [, tag] of images) expect(tag, file).toBe(version);
    }
    const baselines = readFileSync(
      join(process.cwd(), ".github/workflows/visual-baselines.yml"),
      "utf8",
    );
    expect(baselines).toMatch(/on:\s*\n\s*workflow_dispatch:/);
    expect(baselines).not.toMatch(/\bpush:|\bpull_request:|\bschedule:/);
    expect(baselines).toContain("--project=visual --update-snapshots");
  });
});
