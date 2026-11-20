import { afterEach, describe, expect, it, vi } from "vitest";
import { hexToOklch } from "../../src/color/convert";
import { formatHsl, formatNumber, formatOklch, formatRgb } from "../../src/export/format";

describe("formatNumber (spec 5)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formatNumber(0.5, 3) is '0.500' with the default locale forced to de-DE", () => {
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
    // Sanity check that the forcing works: the default locale now uses a comma.
    expect((0.5).toLocaleString(undefined, { minimumFractionDigits: 3 })).toBe("0,500");

    expect(formatNumber(0.5, 3)).toBe("0.500");
    expect(formatNumber(1234.5678, 2)).toBe("1234.57");
    expect(formatNumber(-0.0001, 3)).toBe("0.000");
    expect(formatNumber(2, 0)).toBe("2");
  });

  it("rejects non-finite values", () => {
    expect(() => formatNumber(Number.NaN, 2)).toThrow();
    expect(() => formatNumber(Number.POSITIVE_INFINITY, 2)).toThrow();
  });
});

describe("CSS color strings (plan D14)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("#E8693A is rgb(232 105 58)", () => {
    expect(formatRgb(hexToOklch("#E8693A"))).toBe("rgb(232 105 58)");
  });

  it("#E8693A is hsl(16 79% 57%)", () => {
    expect(formatHsl(hexToOklch("#E8693A"))).toBe("hsl(16 79% 57%)");
  });

  it("black and white round-trip", () => {
    expect(formatRgb(hexToOklch("#000000"))).toBe("rgb(0 0 0)");
    expect(formatHsl(hexToOklch("#FFFFFF"))).toBe("hsl(0 0% 100%)");
  });

  it("oklch keeps 3 decimals for L and C and 1 for H, with periods under de-DE", () => {
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
    expect(formatOklch({ l: 0.7, c: 0.15, h: 40 })).toBe("oklch(0.700 0.150 40.0)");
    expect(formatOklch({ l: 0.123456, c: 0.0004, h: 359.96 })).toBe("oklch(0.123 0.000 0.0)");
  });
});
