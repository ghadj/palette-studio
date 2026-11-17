import { afterEach, describe, expect, it, vi } from "vitest";
import { paletteToCss } from "../../src/export/palette-css";
import { buildMockupState } from "../../src/state/mockup";

const EXPECTED = [
  ":root {",
  "  --palette-1: #E8693A;",
  "  --palette-2: #1DB07A;",
  "  --palette-3: #14386B;",
  "  --palette-4: #D4527F;",
  "  --palette-5: #1E8A2E;",
  "  --palette-6: #5039B0;",
  "}",
].join("\n");

describe("Copy CSS (spec 5.1 CSS; M1 decision 7)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mockup fixture gives ':root {\\n  --palette-1: #E8693A;\\n  …\\n  --palette-6: #5039B0;\\n}' (uppercase hex, --palette-N in palette order)", () => {
    expect(paletteToCss(buildMockupState().project.palette)).toBe(EXPECTED);
    expect(paletteToCss([])).toBe(":root {\n}");
  });

  it("output is identical with the locale forced to de-DE", () => {
    const Native = Intl.NumberFormat;
    vi.spyOn(Intl, "NumberFormat").mockImplementation(
      (locales?: Intl.LocalesArgument, options?: Intl.NumberFormatOptions) =>
        new Native(locales ?? "de-DE", options),
    );
    const toLocale = Number.prototype.toLocaleString;
    vi.spyOn(Number.prototype, "toLocaleString").mockImplementation(function (
      this: number,
      locales?: Intl.LocalesArgument,
      options?: Intl.NumberFormatOptions,
    ) {
      return toLocale.call(this, locales ?? "de-DE", options);
    });
    expect((1.5).toLocaleString()).toBe("1,5");
    expect(paletteToCss(buildMockupState().project.palette)).toBe(EXPECTED);
  });
});
