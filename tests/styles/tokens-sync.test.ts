import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("design tokens", () => {
  it("src/styles/tokens.css equals docs/design/tokens.css byte for byte", () => {
    const design = readFileSync(resolve(__dirname, "../../docs/design/tokens.css"));
    const app = readFileSync(resolve(__dirname, "../../src/styles/tokens.css"));
    expect(app.equals(design)).toBe(true);
  });
});
