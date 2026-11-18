import { afterEach, describe, expect, it, vi } from "vitest";
import { formatNumber } from "../../src/export/format";

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
