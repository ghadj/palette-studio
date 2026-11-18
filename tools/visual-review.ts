/**
 * Writes the mockup review page (visual-testing.md section 2): artifacts/visual-review/index.html,
 * one row per shot and theme with the mockup and the build side by side, and a notes column.
 * The referenced mockups and ui-contract.md are copied next to it so the folder works on its own,
 * for example as a CI artifact.
 *
 * Usage: tsx tools/visual-review.ts (after the visual-review Playwright project has run)
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { M1_SHOTS, SHOT_THEMES, type Shot, shotFile } from "../e2e/visual/shots";

export const NOT_DRAWN = "contract text (not drawn)";

const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Builds the page. `exists` says whether a screenshot file is present next to the page. */
export function buildReviewPage(shots: readonly Shot[], exists: (file: string) => boolean): string {
  const rows: string[] = [];
  for (const shot of shots) {
    for (const theme of SHOT_THEMES) {
      const file = shotFile(shot, theme);
      const mockupFile = shot.mockup?.[theme];
      const mockup = mockupFile
        ? `<a href="mockups/${escapeHtml(mockupFile)}"><img src="mockups/${escapeHtml(mockupFile)}" alt="Mockup ${escapeHtml(mockupFile)}"></a><div class="file">${escapeHtml(mockupFile)}</div>`
        : `<div class="not-drawn">${NOT_DRAWN}</div>`;
      const build = exists(file)
        ? `<a href="${escapeHtml(file)}"><img src="${escapeHtml(file)}" alt="Build ${escapeHtml(file)}"></a><div class="file">${escapeHtml(file)}</div>`
        : `<div class="missing">Missing: ${escapeHtml(file)}</div>`;
      rows.push(
        `<tr data-shot="${escapeHtml(shot.name)}" data-theme="${theme}">` +
          `<td><strong>${escapeHtml(shot.name)}</strong><div>${theme}</div><div>${shot.viewport.width} × ${shot.viewport.height}</div><div class="path">${escapeHtml(shot.path)}</div><div class="frame">${escapeHtml(shot.frame)}</div></td>` +
          `<td>${mockup}</td>` +
          `<td>${build}</td>` +
          `<td><textarea aria-label="Notes for ${escapeHtml(shot.name)} ${theme}"></textarea></td>` +
          "</tr>",
      );
    }
  }
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Palette Studio visual review</title>
<style>
  body { font: 14px/1.4 system-ui, sans-serif; margin: 24px; color: #161616; background: #fff; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #c9c9c9; padding: 8px; vertical-align: top; text-align: left; }
  td:nth-child(2), td:nth-child(3) { width: 38%; }
  img { max-width: 100%; height: auto; display: block; border: 1px solid #e7e7e7; }
  .file, .path, .frame { color: #6a6a6a; font-size: 12px; margin-top: 4px; }
  .not-drawn { color: #6a6a6a; font-style: italic; }
  .missing { color: #b00020; font-weight: 600; }
  textarea { width: 100%; min-height: 160px; font: inherit; }
</style>
</head>
<body>
<h1>Palette Studio visual review</h1>
<p>Compare each build screenshot with its mockup, region by region, using <a href="ui-contract.md">ui-contract.md</a>. Intended deviations D1 to D3 are correct. Shots marked "${NOT_DRAWN}" are checked against the contract text.</p>
<table>
<thead><tr><th>Shot</th><th>Mockup</th><th>Build</th><th>Notes</th></tr></thead>
<tbody>
${rows.join("\n")}
</tbody>
</table>
</body>
</html>
`;
}

export interface WriteOptions {
  shots: readonly Shot[];
  outDir: string;
  repoRoot: string;
}

export function writeReviewPage({ shots, outDir, repoRoot }: WriteOptions): string {
  mkdirSync(join(outDir, "mockups"), { recursive: true });
  const mockups = new Set<string>();
  for (const shot of shots) {
    if (shot.mockup) {
      mockups.add(shot.mockup.light);
      mockups.add(shot.mockup.dark);
    }
  }
  for (const file of mockups) {
    copyFileSync(join(repoRoot, "docs/mockups", file), join(outDir, "mockups", file));
  }
  copyFileSync(join(repoRoot, "docs/design/ui-contract.md"), join(outDir, "ui-contract.md"));
  const html = buildReviewPage(shots, (file) => existsSync(join(outDir, file)));
  const page = join(outDir, "index.html");
  writeFileSync(page, html);
  return page;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const repoRoot = process.cwd();
  const page = writeReviewPage({
    shots: M1_SHOTS,
    outDir: join(repoRoot, "artifacts/visual-review"),
    repoRoot,
  });
  process.stdout.write(`Visual review page: ${page}\n`);
}
