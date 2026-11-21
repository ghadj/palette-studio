import { afterEach, describe, expect, it, vi } from "vitest";
import { bake, mappedAt } from "../../src/gradient/bake";
import {
  bakedCss,
  clearSupportsCache,
  cssNumber,
  nativeCss,
  previewCss,
  supportsInterpolation,
} from "../../src/gradient/css";
import { FIXTURE, grad, parseHex8, rs } from "./helpers";

const FIXTURE_CSS = "linear-gradient(90deg in oklab, #1DB07A 0%, #D4527F 50%, #5039B0 100%)";

/** The `#HEX P%` color stops of a gradient string, in order (hint positions are skipped). */
function colorStops(css: string): Array<{ hex: string; position: number }> {
  return [...css.matchAll(/(#[0-9A-F]{6,8}) (-?[0-9.]+)%/g)].map((m) => ({
    hex: m[1] as string,
    position: Number(m[2]) / 100,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearSupportsCache();
});

describe("native CSS (spec 4.5 path 1; plan D9)", () => {
  it("fixture: `linear-gradient(90deg in oklab, #1DB07A 0%, #D4527F 50%, #5039B0 100%)`", () => {
    expect(nativeCss(FIXTURE(), grad())).toBe(FIXTURE_CSS);
  });

  it("OKLCH longer: `… in oklch longer hue, …`", () => {
    const css = nativeCss(FIXTURE(), grad({ space: "oklch", hue: "longer" }));
    expect(css).toBe(
      "linear-gradient(90deg in oklch longer hue, #1DB07A 0%, #D4527F 50%, #5039B0 100%)",
    );
  });

  it("the hue method is written only for polar spaces, and shorter is left implicit", () => {
    expect(nativeCss(FIXTURE(), grad({ space: "oklch" }))).toMatch(
      /^linear-gradient\(90deg in oklch, /,
    );
    expect(nativeCss(FIXTURE(), grad({ space: "hsl", hue: "decreasing" }))).toMatch(
      /^linear-gradient\(90deg in hsl decreasing hue, /,
    );
    expect(nativeCss(FIXTURE(), grad({ space: "lab", hue: "longer" }))).toMatch(
      /^linear-gradient\(90deg in lab, /,
    );
  });

  it("radial: `radial-gradient(circle closest-side at 30% 40% in oklab, …)`", () => {
    const g = grad({
      type: "radial",
      geometry: { shape: "circle", size: "closest-side", center: { x: 0.3, y: 0.4 } },
    });
    expect(nativeCss(FIXTURE(), g)).toBe(
      "radial-gradient(circle closest-side at 30% 40% in oklab, #1DB07A 0%, #D4527F 50%, #5039B0 100%)",
    );
  });

  it("conic: `conic-gradient(from 45deg at 50% 50% in oklab, …)`", () => {
    const g = grad({ type: "conic", geometry: { from: 45 } });
    expect(nativeCss(FIXTURE(), g)).toBe(
      "conic-gradient(from 45deg at 50% 50% in oklab, #1DB07A 0%, #D4527F 50%, #5039B0 100%)",
    );
  });

  it("a hint at 0.6 of the first segment: `#1DB07A 0%, 30%, #D4527F 50%`", () => {
    const stops = FIXTURE();
    stops[0] = { ...(stops[0] as (typeof stops)[0]), hint: 0.6 };
    expect(nativeCss(stops, grad())).toContain("#1DB07A 0%, 30%, #D4527F 50%");
  });

  it("alpha 0.5: `#D4527F80`", () => {
    const stops = FIXTURE();
    stops[1] = { ...(stops[1] as (typeof stops)[0]), alpha: 0.5 };
    expect(nativeCss(stops, grad())).toContain("#D4527F80 50%");
  });

  it("two stops at the same position stay a hard stop", () => {
    const css = nativeCss(
      [rs("#000000", 0), rs("#FF0000", 0.4), rs("#0000FF", 0.4), rs("#FFFFFF", 1)],
      grad(),
    );
    expect(css).toContain("#FF0000 40%, #0000FF 40%");
  });

  it("12.5% under de-DE", () => {
    const de = new Intl.NumberFormat("de-DE");
    vi.spyOn(Number.prototype, "toLocaleString").mockImplementation(function (this: number) {
      return de.format(this);
    });
    vi.stubGlobal(
      "Intl",
      new Proxy(Intl, {
        get: (target, key) =>
          key === "NumberFormat"
            ? (_locale?: unknown, options?: Intl.NumberFormatOptions) =>
                new target.NumberFormat("de-DE", options)
            : Reflect.get(target, key),
      }),
    );
    const g = grad({ geometry: { angle: 22.5 } });
    const native = nativeCss([rs("#000000", 0.125), rs("#FFFFFF", 0.875)], g);
    expect(native).toBe("linear-gradient(22.5deg in oklab, #000000 12.5%, #FFFFFF 87.5%)");
    expect(bakedCss([{ position: 0.125, hex: "#000000", alpha: 0.25 }], g)).toBe(
      "linear-gradient(22.5deg, #00000040 12.5%)",
    );
  });

  it("numbers have fixed precision: at most 2 decimals, no exponent, no negative zero", () => {
    expect(cssNumber(1 / 3)).toBe("0.33");
    expect(cssNumber(66.666666)).toBe("66.67");
    expect(cssNumber(1e-9)).toBe("0");
    expect(cssNumber(-1e-9)).toBe("0");
    expect(cssNumber(100)).toBe("100");
    expect(cssNumber(12.5)).toBe("12.5");
  });

  it("ease-in adds intermediate stops whose colors lie on the eased curve within 1/255", () => {
    const g = grad({ easing: { kind: "ease-in" } });
    const resolved = FIXTURE();
    const css = nativeCss(resolved, g);
    const stops = colorStops(css);
    const inner = stops.filter((s) => s.position !== 0 && s.position !== 0.5 && s.position !== 1);
    // 8 to 32 per segment (plan D7), and two segments.
    expect(inner.length).toBeGreaterThanOrEqual(16);
    expect(inner.length).toBeLessThanOrEqual(64);
    const first = inner.filter((s) => s.position < 0.5).length;
    expect(first).toBeGreaterThanOrEqual(8);
    expect(first).toBeLessThanOrEqual(32);
    for (const s of inner) {
      const want = mappedAt(resolved, s.position, g).rgb;
      const got = parseHex8(s.hex);
      for (const ch of ["r", "g", "b"] as const) {
        expect(Math.abs(got[ch] - want[ch])).toBeLessThanOrEqual(1 / 255 + 1e-9);
      }
    }
    // Positions never decrease.
    for (let i = 1; i < stops.length; i++) {
      expect((stops[i] as { position: number }).position).toBeGreaterThanOrEqual(
        (stops[i - 1] as { position: number }).position,
      );
    }
    // A linear easing adds none.
    expect(colorStops(nativeCss(resolved, grad()))).toHaveLength(3);
  });

  it("with easing, a hint is folded into the intermediate stops rather than written", () => {
    const stops = FIXTURE();
    stops[0] = { ...(stops[0] as (typeof stops)[0]), hint: 0.3 };
    const css = nativeCss(stops, grad({ easing: { kind: "smoothstep" } }));
    expect(css).not.toMatch(/, -?[0-9.]+%,/);
  });

  it("with easing in a polar space, the clause uses the shorter arc between close intermediate stops", () => {
    const g = grad({ space: "oklch", hue: "longer", easing: { kind: "ease-out" } });
    const css = nativeCss([rs("#FF0000", 0), rs("#0000FF", 1)], g);
    expect(css).toMatch(/^linear-gradient\(90deg in oklch, /);
    const stops = colorStops(css);
    const resolved = [rs("#FF0000", 0), rs("#0000FF", 1)];
    for (const s of stops) {
      const want = mappedAt(resolved, s.position, g).rgb;
      const got = parseHex8(s.hex);
      for (const ch of ["r", "g", "b"] as const) {
        expect(Math.abs(got[ch] - want[ch])).toBeLessThanOrEqual(1 / 255 + 1e-9);
      }
    }
  });
});

describe("baked CSS (spec 4.5 path 2)", () => {
  it("the baked string has no `in` clause", () => {
    const g = grad({ space: "oklch", hue: "longer" });
    const css = bakedCss(bake(FIXTURE(), g).stops, g);
    expect(css).toMatch(/^linear-gradient\(90deg, #[0-9A-F]{6} 0%, /);
    expect(css).not.toContain(" in ");
    expect(css.endsWith(" 100%)")).toBe(true);
  });

  it("radial and conic keep their geometry", () => {
    const baked = [
      { position: 0, hex: "#000000", alpha: 1 },
      { position: 1, hex: "#FFFFFF", alpha: 1 },
    ];
    expect(bakedCss(baked, grad({ type: "radial" }))).toBe(
      "radial-gradient(ellipse farthest-corner at 50% 50%, #000000 0%, #FFFFFF 100%)",
    );
    expect(
      bakedCss(
        baked,
        grad({ type: "conic", geometry: { from: 30, center: { x: 0.25, y: 0.75 } } }),
      ),
    ).toBe("conic-gradient(from 30deg at 25% 75%, #000000 0%, #FFFFFF 100%)");
  });
});

describe("feature detection (spec 4.5, 7.8; plan D10)", () => {
  it("asks CSS.supports for the clause once per space and hue", () => {
    const supports = vi.fn((_p: string, v: string) => v.includes("in oklch"));
    vi.stubGlobal("CSS", { supports });
    expect(supportsInterpolation("oklch", "longer")).toBe(true);
    expect(supportsInterpolation("oklch", "longer")).toBe(true);
    expect(supportsInterpolation("oklab", "shorter")).toBe(false);
    expect(supports).toHaveBeenCalledTimes(2);
    expect(supports.mock.calls[0]?.[1]).toContain("in oklch longer hue");
  });

  it("is false without CSS.supports (no DOM)", () => {
    vi.stubGlobal("CSS", undefined);
    expect(supportsInterpolation("oklab", "shorter")).toBe(false);
  });

  it("previewCss is native when supported and baked otherwise", () => {
    vi.stubGlobal("CSS", { supports: () => true });
    expect(previewCss(FIXTURE(), grad())).toBe(FIXTURE_CSS);
    clearSupportsCache();
    vi.stubGlobal("CSS", { supports: () => false });
    const css = previewCss(FIXTURE(), grad());
    expect(css).not.toContain(" in ");
    expect(css.startsWith("linear-gradient(90deg, #1DB07A 0%")).toBe(true);
  });
});
