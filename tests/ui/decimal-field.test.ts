import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DecimalField, formatDecimal, parseDecimal } from "../../src/ui/DecimalField";

/** Forces every locale-aware number formatter to German, which writes 0,05. */
function forceGermanLocale(): void {
  const NumberFormat = Intl.NumberFormat;
  vi.stubGlobal("Intl", {
    ...Intl,
    NumberFormat: function GermanNumberFormat(
      locales?: string | string[],
      options?: Intl.NumberFormatOptions,
    ) {
      return new NumberFormat(locales ?? "de-DE", options);
    },
  });
  const originalToLocaleString = Number.prototype.toLocaleString;
  vi.spyOn(Number.prototype, "toLocaleString").mockImplementation(function (
    this: number,
    locales?: Intl.LocalesArgument,
    options?: Intl.NumberFormatOptions,
  ) {
    return originalToLocaleString.call(this, locales ?? "de-DE", options);
  });
  expect((0.05).toLocaleString()).toBe("0,05");
  expect(new Intl.NumberFormat().format(0.05)).toBe("0,05");
}

const field = (props: Partial<Parameters<typeof DecimalField>[0]> = {}) =>
  renderToString(
    h(DecimalField, {
      id: "f",
      value: 0.05,
      min: 0,
      max: 0.15,
      decimals: 2,
      onCommit() {},
      ...props,
    }),
  );

describe("decimal field (spec 2.4, 5, 6.1)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("accepts a period or a comma as the decimal separator", () => {
    expect(parseDecimal("0.05")).toBe(0.05);
    expect(parseDecimal("0,05")).toBe(0.05);
    expect(parseDecimal(" .5 ")).toBe(0.5);
    expect(parseDecimal("1")).toBe(1);
    expect(parseDecimal("1.")).toBe(1);
  });

  it("rejects text that isn't a plain non-negative number", () => {
    for (const raw of ["", " ", "abc", "0.0.1", "1e-2", "-0.1", "0,0,1", "Infinity"]) {
      expect(parseDecimal(raw), raw).toBeNull();
    }
  });

  it("formats with a period and fixed decimals", () => {
    expect(formatDecimal(0.2, 2)).toBe("0.20");
    expect(formatDecimal(0.95, 2)).toBe("0.95");
    expect(formatDecimal(0, 2)).toBe("0.00");
  });

  it("'0,05' commits 0.05 (M2-T7)", () => {
    expect(parseDecimal("0,05")).toBe(0.05);
    expect(parseDecimal("4,5")).toBe(4.5);
    expect(parseDecimal(",1")).toBe(0.1);
  });

  it("shows '0.05' with the locale forced to de-DE (M2-T7)", () => {
    forceGermanLocale();
    expect(formatDecimal(0.05, 2)).toBe("0.05");
    expect(formatDecimal(3, 1)).toBe("3.0");
    expect(formatDecimal(0.03, 3)).toBe("0.030");
    const html = field();
    expect(html).toContain('value="0.05"');
    expect(html).not.toContain("0,05");
    expect(html).toContain('inputmode="decimal"');
  });

  it("is a text field with spinbutton semantics, so ',' can be typed (M2-T7)", () => {
    const html = field({ value: 0.5, max: 1 });
    expect(html).toContain('type="text"');
    expect(html).toContain('role="spinbutton"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="1"');
    expect(html).toContain('aria-valuenow="0.5"');
    expect(html).toContain('aria-valuetext="0.50"');
  });
});
