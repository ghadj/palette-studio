import { describe, expect, it } from "vitest";
import { hexToOklch, oklchToHex } from "../../src/color/convert";
import { parseHex } from "../../src/color/hex";

describe("parseHex (spec 3.2, 6.1)", () => {
  it("'#e8693a', 'E8693A' and 'e63' parse", () => {
    expect(parseHex("#e8693a")).toBe("#E8693A");
    expect(parseHex("E8693A")).toBe("#E8693A");
    expect(parseHex("e63")).toBe("#EE6633");
    expect(parseHex("  #FA0 ")).toBe("#FFAA00");
  });

  it("'xyz' and '#12345' are rejected", () => {
    expect(parseHex("xyz")).toBeNull();
    expect(parseHex("#12345")).toBeNull();
    expect(parseHex("")).toBeNull();
    expect(parseHex("#1234567")).toBeNull();
    expect(parseHex("#12g456")).toBeNull();
  });

  it("round-trips through OKLCH to the same hex", () => {
    expect(oklchToHex(hexToOklch(parseHex("14386b") ?? ""))).toBe("#14386B");
  });
});
