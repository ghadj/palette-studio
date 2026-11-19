import { describe, expect, it } from "vitest";
import { keysIgnored, panIgnores } from "../../src/ui/pointerRouting";

/** A stand-in element whose `closest` matches the given selectors. */
const target = (...matches: string[]) => ({
  closest: (selector: string) =>
    selector.split(",").some((s) => matches.includes(s.trim())) ? {} : null,
});

describe("image well pointer routing (plan M3-T2)", () => {
  it("pan and pinch ignore a pointerdown on a marker", () => {
    expect(panIgnores(target("[data-marker]"), "off")).toBe(true);
    expect(panIgnores(target(), "off")).toBe(false);
    expect(panIgnores(null, "off")).toBe(false);
  });

  it("pan and pinch ignore every pointerdown while the eyedropper is on", () => {
    expect(panIgnores(target(), "add")).toBe(true);
    expect(panIgnores(target(), "replace")).toBe(true);
    expect(panIgnores(null, "add")).toBe(true);
  });

  it("pan ignores pointers that start on the zoom controls or the well tools", () => {
    expect(panIgnores(target(".zoom-controls"), "off")).toBe(true);
    expect(panIgnores(target(".well-tools"), "off")).toBe(true);
  });

  it("the well's arrow keys don't pan while a marker or a well control has focus", () => {
    expect(keysIgnored(target("[data-marker]"))).toBe(true);
    expect(keysIgnored(target(".zoom-controls"))).toBe(true);
    expect(keysIgnored(target(".well-tools"))).toBe(true);
    expect(keysIgnored(target())).toBe(false);
  });
});
