import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { BUDGET_BYTES, formatReport, measureBundle } from "../../tools/bundle-size";

/** Deterministic, poorly compressible bytes (xorshift), so gzip size stays close to raw size. */
function noise(length: number, seed: number): Buffer {
  const out = Buffer.alloc(length);
  let x = seed >>> 0 || 1;
  for (let i = 0; i < length; i += 1) {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    out[i] = x & 0xff;
  }
  return out;
}

const dirs: string[] = [];
function fixtureDist(files: Record<string, Buffer | string>): string {
  const dir = mkdtempSync(join(tmpdir(), "bundle-size-"));
  dirs.push(dir);
  mkdirSync(join(dir, "assets"));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("bundle-size", () => {
  it("sums gzip sizes of a fixture dist and flags totals above 150 kB", () => {
    const small = "export const a = 1;\n".repeat(200);
    const big = noise(160 * 1024, 7);
    const css = "body{color:red}";

    const under = measureBundle(
      fixtureDist({ "assets/index-a.js": small, "assets/index-a.css": css, "index.html": "<p>" }),
    );
    expect(under.chunks.map((c) => c.file)).toEqual(["assets/index-a.js"]);
    expect(under.totalGzip).toBe(gzipSync(small, { level: 9 }).length);
    expect(under.overBudget).toBe(false);

    const over = measureBundle(
      fixtureDist({ "assets/index-a.js": small, "assets/worker-b.js": big }),
    );
    expect(over.chunks).toHaveLength(2);
    expect(over.totalGzip).toBe(
      gzipSync(small, { level: 9 }).length + gzipSync(big, { level: 9 }).length,
    );
    expect(over.totalGzip).toBeGreaterThan(BUDGET_BYTES);
    expect(over.overBudget).toBe(true);

    const report = formatReport(over);
    expect(report).toContain("assets/worker-b.js");
    expect(report).toMatch(/above the 150 kB budget/);
    expect(formatReport(under)).not.toMatch(/above the 150 kB budget/);
  });
});
