import { describe, expect, it } from "vitest";
import { hexToOklab } from "../../src/color/convert";
import { CSS_NAMED_COLORS, nearestCssName } from "../../src/color/css-names";

describe("nearestCssName (spec 7.6, plan D15)", () => {
  it("#FF6347 is tomato", () => {
    expect(nearestCssName(hexToOklab("#FF6347"))).toBe("tomato");
  });
  it("#FE6347 is still tomato", () => {
    expect(nearestCssName(hexToOklab("#FE6347"))).toBe("tomato");
  });
  it("#FFFFFF is white", () => {
    expect(nearestCssName(hexToOklab("#FFFFFF"))).toBe("white");
  });
  it("gray and grey count once", () => {
    const names = CSS_NAMED_COLORS.map(([name]) => name);
    expect(names.filter((n) => n === "gray" || n === "grey")).toEqual(["gray"]);
    expect(names.some((n) => n.includes("grey"))).toBe(false);
    expect(nearestCssName(hexToOklab("#808080"))).toBe("gray");
  });
  it("lists 139 distinct names with distinct values", () => {
    expect(new Set(CSS_NAMED_COLORS.map(([n]) => n)).size).toBe(CSS_NAMED_COLORS.length);
    expect(new Set(CSS_NAMED_COLORS.map(([, h]) => h)).size).toBe(CSS_NAMED_COLORS.length);
    expect(CSS_NAMED_COLORS.length).toBe(139);
  });
});
