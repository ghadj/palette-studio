import { describe, expect, it } from "vitest";
import { hexToOklch, oklabToOklch, oklabToRgb, rgbToOklab } from "../../src/color/convert";
import { toSrgb } from "../../src/color/gamut";
import {
  type BakedStop,
  bake,
  MAX_BAKED_STOPS,
  MIN_BAKED_STOPS,
  mappedAt,
  sampleAt,
  sampler,
} from "../../src/gradient/bake";
import { makeStop, type ResolvedStop, resolveStops } from "../../src/gradient/model";
import type { EasingKind, HueMethod, InterpolationSpace } from "../../src/types";
import { FIXTURE, grad, parseHex8, rs } from "./helpers";

const ONE = 1 / 255;
const SPACES: InterpolationSpace[] = [
  "srgb",
  "srgb-linear",
  "display-p3",
  "lab",
  "oklab",
  "lch",
  "oklch",
  "hsl",
  "hwb",
  "xyz",
];
const POLAR = new Set<InterpolationSpace>(["lch", "oklch", "hsl", "hwb"]);
const HUES: HueMethod[] = ["shorter", "longer", "increasing", "decreasing"];

/** What a browser draws between baked stops: sRGB, with premultiplied alpha (CSS Images 4). */
function renderBaked(stops: readonly BakedStop[], t: number) {
  return renderer(stops)(t);
}

function renderer(stops: readonly BakedStop[]) {
  const parsed = stops.map((s) => ({ ...parseHex8(s.hex), alpha: s.alpha, position: s.position }));
  return (t: number) => draw(parsed, t);
}

function draw(parsed: Array<ReturnType<typeof parseHex8> & { position: number }>, t: number) {
  const first = parsed[0];
  const last = parsed[parsed.length - 1];
  if (!first || !last) throw new Error("no stops");
  if (t <= first.position) return first;
  if (t >= last.position) return last;
  let i = 0;
  while (i < parsed.length - 1 && (parsed[i + 1] as typeof first).position <= t) i++;
  const a = parsed[i] as typeof first;
  const b = parsed[i + 1] as typeof first;
  const s = (t - a.position) / (b.position - a.position);
  const alpha = a.alpha + (b.alpha - a.alpha) * s;
  const ch = (k: "r" | "g" | "b") =>
    alpha > 0 ? (a[k] * a.alpha + (b[k] * b.alpha - a[k] * a.alpha) * s) / alpha : a[k];
  return { r: ch("r"), g: ch("g"), b: ch("b"), alpha };
}

/** The largest premultiplied-channel or alpha difference between the baked and the true gradient. */
function worstError(resolved: ResolvedStop[], g: ReturnType<typeof grad>, stops: BakedStop[]) {
  let worst = 0;
  // sampler + toSrgb is mappedAt with the segment conversions done once.
  const f = sampler(resolved, g);
  const draw = renderer(stops);
  for (let k = 0; k <= 511; k++) {
    const t = k / 511;
    const s = f(t);
    const want = { ...toSrgb(s.color, g.gamut), alpha: s.alpha };
    const got = draw(t);
    for (const ch of ["r", "g", "b"] as const) {
      worst = Math.max(worst, Math.abs(got[ch] * got.alpha - want.rgb[ch] * want.alpha));
    }
    worst = Math.max(worst, Math.abs(got.alpha - want.alpha));
  }
  return worst;
}

/** Reference gradients: complementary pairs, a three-stop palette, alpha, hints, a hard stop. */
const REFERENCES: Array<[string, ResolvedStop[]]> = [
  ["#FF0000→#0000FF", [rs("#FF0000", 0), rs("#0000FF", 1)]],
  ["#000000→#FFFFFF", [rs("#000000", 0), rs("#FFFFFF", 1)]],
  ["#FF0000→#00FFFF", [rs("#FF0000", 0), rs("#00FFFF", 1)]],
  ["fixture", FIXTURE()],
  [
    "alpha and hints",
    [
      rs("#E8693A", 0, { hint: 0.25 }),
      rs("#1DB07A", 0.3, { alpha: 0.4, hint: 0.8 }),
      rs("#14386B", 0.3),
      rs("#FFFFFF", 1, { alpha: 0 }),
    ],
  ],
];

describe("sampleAt (spec 7.6 'Bake'; plan D8)", () => {
  it("returns the stops at their positions and the end colors outside them", () => {
    const stops = [rs("#FF0000", 0.2), rs("#0000FF", 0.8)];
    const g = grad();
    expect(oklabToRgb(sampleAt(stops, 0, g).color).r).toBeCloseTo(1, 6);
    expect(oklabToRgb(sampleAt(stops, 0.2, g).color).r).toBeCloseTo(1, 6);
    expect(oklabToRgb(sampleAt(stops, 0.8, g).color).b).toBeCloseTo(1, 6);
    expect(oklabToRgb(sampleAt(stops, 1, g).color).b).toBeCloseTo(1, 6);
  });

  it("applies the hint warp before easing: a hint at 0.25 puts the halfway color at 25%", () => {
    const stops = [rs("#000000", 0, { hint: 0.25 }), rs("#FFFFFF", 1)];
    const g = grad({ space: "srgb", easing: { kind: "ease-in-out" } });
    // ease-in-out(0.5) = 0.5, so the warped 0.5 lands halfway in sRGB.
    expect(oklabToRgb(sampleAt(stops, 0.25, g).color).r).toBeCloseTo(0.5, 6);
  });

  it("eases within the segment: ease-in at the middle of #000→#FFF in sRGB is 0.3154", () => {
    const g = grad({ space: "srgb", easing: { kind: "ease-in" } });
    const rgb = oklabToRgb(sampleAt([rs("#000000", 0), rs("#FFFFFF", 1)], 0.5, g).color);
    expect(Math.abs(rgb.r - 0.315357)).toBeLessThan(1e-4);
  });
});

describe("bake (spec 4.5 path 2, 8 'Gradient baking'; plan D8)", () => {
  it("each baked stop equals sampleAt at its position within 1/255 (spec 8)", () => {
    for (const space of SPACES) {
      for (const [name, resolved] of REFERENCES) {
        const g = grad({ space });
        const { stops } = bake(resolved, g);
        for (const s of stops) {
          // At a hard stop the two baked stops are the colors on either side of the jump.
          const side = stops.filter((o) => o.position === s.position).length > 1;
          if (side) continue;
          const want = mappedAt(resolved, s.position, g);
          const got = parseHex8(s.hex);
          for (const ch of ["r", "g", "b"] as const) {
            expect(
              Math.abs(got[ch] - want.rgb[ch]),
              `${space} ${name} @${s.position}`,
            ).toBeLessThanOrEqual(ONE / 2 + 1e-9);
          }
          expect(Math.abs(s.alpha - want.alpha)).toBeLessThanOrEqual(ONE / 2 + 1e-9);
          // In gamut, the mapped color is sampleAt's own.
          const raw = sampleAt(resolved, s.position, g);
          const rgb = oklabToRgb(raw.color);
          if ([rgb.r, rgb.g, rgb.b].every((v) => v >= 0 && v <= 1)) {
            expect(Math.abs(got.g - rgb.g)).toBeLessThanOrEqual(ONE / 2 + 1e-9);
          }
        }
      }
    }
  });

  it("sRGB interpolation between baked stops stays within 1/255 of sampleAt at 512 points, or 64 stops are used; the worst case is logged", () => {
    const easings: EasingKind[] = ["linear", "ease-in-out", "smoothstep"];
    let worst = { error: 0, name: "", count: 0 };
    const counts: number[] = [];
    for (const space of SPACES) {
      for (const hue of POLAR.has(space) ? HUES : (["shorter"] as HueMethod[])) {
        for (const kind of easings) {
          for (const [name, resolved] of REFERENCES) {
            const g = grad({ space, hue, easing: { kind } });
            const { stops } = bake(resolved, g);
            const error = worstError(resolved, g, stops);
            counts.push(stops.length);
            const label = `${space} ${hue} ${kind} ${name}: ${stops.length} stops, ${(error * 255).toFixed(3)}/255`;
            if (stops.length < MAX_BAKED_STOPS) expect(error, label).toBeLessThanOrEqual(ONE);
            if (error > worst.error) worst = { error, name: label, count: stops.length };
          }
        }
      }
    }
    console.log(
      `bake: worst case ${worst.name}; stop counts ${Math.min(...counts)} to ${Math.max(...counts)}`,
    );
    expect(Math.max(...counts)).toBeLessThanOrEqual(MAX_BAKED_STOPS);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(MIN_BAKED_STOPS);
  }, 30_000); // About 2 s alone; the full suite runs files in parallel.

  it("#000000→#FFFFFF in sRGB bakes to 16 stops; OKLCH #FF0000→#0000FF with longer hue bakes to more", () => {
    const gray = bake([rs("#000000", 0), rs("#FFFFFF", 1)], grad({ space: "srgb" }));
    expect(gray.stops).toHaveLength(16);
    const longer = bake(
      [rs("#FF0000", 0), rs("#0000FF", 1)],
      grad({ space: "oklch", hue: "longer" }),
    );
    expect(longer.stops.length).toBeGreaterThan(16);
    expect(longer.stops.length).toBeLessThanOrEqual(64);
  });

  it("positions start at 0, end at 1 and never decrease", () => {
    for (const [, resolved] of [
      ...REFERENCES,
      ["inset", [rs("#FF0000", 0.2), rs("#0000FF", 0.7)]] as [string, ResolvedStop[]],
    ]) {
      const { stops } = bake(resolved, grad({ space: "oklch" }));
      expect(stops[0]?.position).toBe(0);
      expect(stops[stops.length - 1]?.position).toBe(1);
      for (let i = 1; i < stops.length; i++) {
        expect((stops[i] as BakedStop).position).toBeGreaterThanOrEqual(
          (stops[i - 1] as BakedStop).position,
        );
      }
    }
  });

  it("two stops at 40% give a jump at 0.4", () => {
    const resolved = [rs("#000000", 0), rs("#FF0000", 0.4), rs("#0000FF", 0.4), rs("#FFFFFF", 1)];
    const { stops } = bake(resolved, grad());
    const at = stops.filter((s) => s.position === 0.4);
    expect(at.map((s) => s.hex)).toEqual(["#FF0000", "#0000FF"]);
    expect(renderBaked(stops, 0.399).r).toBeGreaterThan(0.9);
    expect(renderBaked(stops, 0.401).b).toBeGreaterThan(0.9);
  });

  it("OKLCH #FF0000→#00FF00 reports outOfGamut; Reduce chroma keeps L and H within 1e-3; Clamp clips the channels", () => {
    const resolved = [rs("#FF0000", 0), rs("#00FF00", 1)];
    const chroma = grad({ space: "oklch", gamut: "chroma" });
    expect(bake(resolved, chroma).outOfGamut).toBe(true);
    expect(bake(resolved, grad({ space: "oklab" })).outOfGamut).toBe(false);
    expect(bake(FIXTURE(), grad()).outOfGamut).toBe(false);
    let mapped = 0;
    for (let k = 0; k <= 64; k++) {
      const t = k / 64;
      const raw = oklabToOklch(sampleAt(resolved, t, chroma).color);
      const out = mappedAt(resolved, t, chroma);
      for (const ch of ["r", "g", "b"] as const) {
        expect(out.rgb[ch]).toBeGreaterThanOrEqual(0);
        expect(out.rgb[ch]).toBeLessThanOrEqual(1);
      }
      if (!out.mapped) continue;
      mapped++;
      const back = oklabToOklch(rgbToOklab(out.rgb));
      expect(Math.abs(back.l - raw.l)).toBeLessThan(1e-3);
      expect(Math.abs(back.h - raw.h)).toBeLessThan(1e-3);
      expect(back.c).toBeLessThan(raw.c);
    }
    expect(mapped).toBeGreaterThan(0);

    const clamp = grad({ space: "oklch", gamut: "clamp" });
    expect(bake(resolved, clamp).outOfGamut).toBe(true);
    for (let k = 0; k <= 64; k++) {
      const t = k / 64;
      const raw = oklabToRgb(sampleAt(resolved, t, clamp).color);
      const out = mappedAt(resolved, t, clamp);
      for (const ch of ["r", "g", "b"] as const) {
        expect(out.rgb[ch]).toBeCloseTo(Math.min(1, Math.max(0, raw[ch])), 9);
      }
    }
  });

  it("mirror: bake(t) = bake(1 − t) within 1/255", () => {
    // Mirror is a palindrome of the stops, made by resolveStops (plan D21). Easing applies per
    // segment along the stop axis, so only a symmetric curve keeps the palindrome exact.
    const value = (hex: string) => ({ kind: "value" as const, color: hexToOklch(hex), from: null });
    const stored = [
      makeStop(0, value("#1DB07A")),
      makeStop(0.5, value("#D4527F")),
      makeStop(1, value("#5039B0")),
    ];
    const cases: Array<[InterpolationSpace, EasingKind]> = [
      ["oklab", "linear"],
      ["oklch", "linear"],
      ["srgb", "linear"],
      ["oklab", "ease-in-out"],
      ["hsl", "smoothstep"],
    ];
    for (const [space, kind] of cases) {
      const g = grad({ space, easing: { kind }, geometry: { mirror: true } });
      const mirrored = resolveStops(g, stored, []);
      expect(mirrored).toHaveLength(5);
      const { stops } = bake(mirrored, g);
      for (let k = 0; k <= 512; k++) {
        const t = k / 512;
        const a = renderBaked(stops, t);
        const b = renderBaked(stops, 1 - t);
        for (const ch of ["r", "g", "b"] as const) {
          expect(Math.abs(a[ch] - b[ch]), `${space} ${kind} ${t}`).toBeLessThanOrEqual(ONE + 1e-9);
        }
      }
    }
  });

  it("bakes a 32-stop OKLCH gradient in under 20 ms (60 fps drags, spec 7.7)", () => {
    const hexes = ["#E8693A", "#1DB07A", "#14386B", "#D4527F", "#1E8A2E", "#5039B0"];
    const resolved = Array.from({ length: 32 }, (_, i) =>
      rs(hexes[i % hexes.length] as string, i / 31),
    );
    const g = grad({ space: "oklch", hue: "longer", easing: { kind: "ease-in-out" } });
    bake(resolved, g);
    // The best of 10 runs, so a busy machine (parallel test files) doesn't count against it.
    let ms = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      bake(resolved, g);
      ms = Math.min(ms, performance.now() - start);
    }
    console.log(`bake: 32 stops, OKLCH longer, ease-in-out: ${ms.toFixed(2)} ms`);
    expect(ms).toBeLessThan(20);
  });
});
