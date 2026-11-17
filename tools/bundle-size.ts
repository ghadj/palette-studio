/**
 * Bundle-size report (spec 7.7): gzip size of every JavaScript chunk in a build and the total.
 * Above the 150 kB budget it warns; it never fails the build (M1 decision 11).
 *
 * Usage: tsx tools/bundle-size.ts [distDir]
 * In GitHub Actions the report is appended to the job summary and a warning annotation is emitted.
 */
import { appendFileSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

export const BUDGET_BYTES = 150 * 1024;

export interface ChunkSize {
  file: string;
  bytes: number;
  gzip: number;
}

export interface BundleReport {
  chunks: ChunkSize[];
  totalBytes: number;
  totalGzip: number;
  overBudget: boolean;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

export function measureBundle(distDir: string): BundleReport {
  const root = resolve(distDir);
  const chunks = walk(root)
    .filter((path) => /\.m?js$/.test(path))
    .map((path) => {
      const content = readFileSync(path);
      return {
        file: relative(root, path).split(sep).join("/"),
        bytes: content.length,
        gzip: gzipSync(content, { level: 9 }).length,
      };
    })
    .sort((a, b) => b.gzip - a.gzip || a.file.localeCompare(b.file));
  const totalBytes = chunks.reduce((sum, c) => sum + c.bytes, 0);
  const totalGzip = chunks.reduce((sum, c) => sum + c.gzip, 0);
  return { chunks, totalBytes, totalGzip, overBudget: totalGzip > BUDGET_BYTES };
}

const kB = (bytes: number): string => `${(bytes / 1024).toFixed(2)} kB`;

export function formatReport(report: BundleReport): string {
  const lines = [
    "## Bundle size",
    "",
    "| Chunk | Size | Gzip |",
    "| --- | ---: | ---: |",
    ...report.chunks.map((c) => `| \`${c.file}\` | ${kB(c.bytes)} | ${kB(c.gzip)} |`),
    `| **Total** | **${kB(report.totalBytes)}** | **${kB(report.totalGzip)}** |`,
    "",
  ];
  lines.push(
    report.overBudget
      ? `Warning: ${kB(report.totalGzip)} of gzipped JavaScript is above the 150 kB budget (spec 7.7).`
      : `Within the 150 kB gzip budget (spec 7.7).`,
  );
  return `${lines.join("\n")}\n`;
}

function main(): void {
  const dist = process.argv[2] ?? "dist";
  const report = measureBundle(dist);
  const text = formatReport(report);
  process.stdout.write(text);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) appendFileSync(summary, text);
  if (report.overBudget && process.env.GITHUB_ACTIONS) {
    process.stdout.write(
      `::warning title=Bundle size::${kB(report.totalGzip)} gzipped JavaScript exceeds the 150 kB budget\n`,
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
