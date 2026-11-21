/**
 * Baked stops (spec 4.5 path 2, 7.6 "Bake"; plan D8): the gradient sampled into plain sRGB stops
 * that look the same in any renderer, including ones that ignore `in <space>`. M5's exporters call
 * `bake` too. The main thread runs it: it is math on at most 64 stops, never a pixel loop (7.4).
 *
 * The color at t (`sampleAt`), in the order D8 gives:
 * 1. find the segment between two resolved stops (right-continuous, so two stops at one position
 *    are a hard step there)
 * 2. the midpoint hint's warp (CSS color-hint semantics), then the easing, within the segment
 * 3. `mix` in the interpolation space, with the hue method and premultiplied alpha (M4-T3)
 * Then `mappedAt` maps it into sRGB by the gamut handling (`toSrgb`, D12).
 *
 * `bake` subdivides adaptively: the resolved stops are the base, extra stops are spread over the
 * segments in proportion to their length until there are 16, and then the stretch whose plain sRGB
 * interpolation (what a browser draws between baked stops, premultiplied) strays furthest from the
 * true gradient is split in half, until every stretch is within `BAKE_TOLERANCE` at its check points
 * or there are 64 stops. The check uses the stops as written, rounded to bytes.
 */
import type { Oklab, Rgb } from "../color/convert";
import { oklchToOklab, rgbToHex } from "../color/convert";
import { toSrgb } from "../color/gamut";
import type { Gradient } from "../types";
import { easingFn, hintWarp } from "./easing";
import { mixer, type OklabAlpha } from "./interpolate";
import type { ResolvedStop } from "./model";

/** A baked stop: a position (0 to 1), an 8-bit `#RRGGBB` and an alpha (0 to 1). */
export interface BakedStop {
  position: number;
  hex: string;
  alpha: number;
}

export interface BakeResult {
  stops: BakedStop[];
  /** True when interpolation left sRGB and a color had to be mapped (plan D12). */
  outOfGamut: boolean;
}

/** Spec 4.5 path 2: 16 to 64 stops (plan D8). */
export const MIN_BAKED_STOPS = 16;
export const MAX_BAKED_STOPS = 64;
/**
 * The largest difference, per premultiplied sRGB channel and in alpha, allowed between the baked
 * stops' sRGB interpolation and the true gradient (spec 8 "Gradient baking": 1/255). Refinement aims
 * a little lower, since the check points are a sample of the stretch.
 */
export const BAKE_TOLERANCE = 1 / 255;
const REFINE_TOLERANCE = 0.85 / 255;
/** Check points inside each stretch: at k/8 of it, k = 1 to 7. */
const CHECKS = 8;

/** The gradient's settings that `sampleAt` reads. */
type SampleSettings = Pick<Gradient, "space" | "hue" | "premultiplied" | "easing">;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * A function of t (0 to 1) giving the gradient's color before gamut mapping, for callers that
 * sample many times: each segment's mixer converts its stops once (M4-T3's `mixer`).
 */
export function sampler(
  resolved: readonly ResolvedStop[],
  gradient: SampleSettings,
): (t: number) => OklabAlpha {
  const first = resolved[0];
  const last = resolved[resolved.length - 1];
  if (!first || !last) throw new Error("A gradient needs stops to sample");
  const ease = easingFn(gradient.easing);
  const options = {
    space: gradient.space,
    hue: gradient.hue,
    premultiplied: gradient.premultiplied,
  };
  const mixers: Array<((t: number) => OklabAlpha) | undefined> = [];
  const solid = (s: ResolvedStop): OklabAlpha => ({
    color: oklchToOklab(s.color),
    alpha: clamp01(s.alpha),
  });
  const firstColor = solid(first);
  const lastColor = solid(last);

  return (t: number): OklabAlpha => {
    if (t < first.position || resolved.length === 1) return firstColor;
    if (t >= last.position) return lastColor;
    // The last stop at or before t; the next one is after t.
    let lo = 0;
    let hi = resolved.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if ((resolved[mid] as ResolvedStop).position <= t) lo = mid;
      else hi = mid;
    }
    const a = resolved[lo] as ResolvedStop;
    const b = resolved[lo + 1] as ResolvedStop;
    let mix = mixers[lo];
    if (!mix) {
      mix = mixer({ color: a.color, alpha: a.alpha }, { color: b.color, alpha: b.alpha }, options);
      mixers[lo] = mix;
    }
    const p = (t - a.position) / (b.position - a.position);
    const out = mix(ease(hintWarp(p, a.hint)));
    return { color: out.color, alpha: clamp01(out.alpha) };
  };
}

/**
 * The gradient's color at `t` (0 to 1) between its resolved stops, before gamut mapping: hint warp,
 * easing, interpolation (plan D8). Before the first stop it is the first stop's color, from the last
 * stop on the last's.
 */
export function sampleAt(
  resolved: readonly ResolvedStop[],
  t: number,
  gradient: Gradient,
): { color: Oklab; alpha: number } {
  return sampler(resolved, gradient)(t);
}

/** A sampled color in sRGB after gamut mapping, and whether it needed mapping. */
export interface MappedSample {
  rgb: Rgb;
  alpha: number;
  mapped: boolean;
}

/** `sampleAt`, mapped into sRGB by the gradient's gamut handling (plan D12). */
export function mappedAt(
  resolved: readonly ResolvedStop[],
  t: number,
  gradient: Gradient,
): MappedSample {
  const s = sampleAt(resolved, t, gradient);
  return { ...toSrgb(s.color, gradient.gamut), alpha: s.alpha };
}

/** A baked stop while baking: the true mapped color and the byte-rounded one CSS will draw. */
interface Knot {
  t: number;
  /** Premultiplied true channels and alpha. */
  r: number;
  g: number;
  b: number;
  alpha: number;
  /** As written: premultiplied byte channels and byte alpha. */
  qr: number;
  qg: number;
  qb: number;
  qa: number;
  hex: string;
  /** Which gamut boundary holds the color: 0 in gamut, else a bit per channel at 0 or 1. */
  sig: number;
}

/** Bisection steps that place a gamut bend between two check points. */
const BEND_STEPS = 10;
/**
 * A stretch shorter than this isn't split again: CSS positions are written to 0.01% (`cssNumber`),
 * so closer stops can't be told apart. Chroma reduction at constant L and H changes almost
 * abruptly next to a corner of the sRGB cube (pure blue, for one), and splitting there would spend
 * every stop on one step that stays a step.
 */
const MIN_STRETCH = 2e-4;
/** Errors this close count as equal: mirrored stretches differ only by float rounding. */
const TWIN_ERROR = 1e-9;

/** The boundary signature of a mapped color (see `Knot.sig`). */
function signature(rgb: Rgb, mapped: boolean): number {
  if (!mapped) return 0;
  let sig = 1;
  [rgb.r, rgb.g, rgb.b].forEach((v, i) => {
    if (v <= 1e-5) sig |= 2 << (2 * i);
    else if (v >= 1 - 1e-5) sig |= 4 << (2 * i);
  });
  return sig;
}

const toByte = (v: number): number => Math.round(clamp01(v) * 255) / 255;

/**
 * Samples the gradient into 16 to 64 stops by adaptive subdivision, with gamut mapping and sRGB
 * conversion (see the file comment). Hard stops (equal positions) stay hard. Positions run from 0
 * to 1 and never decrease.
 */
export function bake(resolved: readonly ResolvedStop[], gradient: Gradient): BakeResult {
  const first = resolved[0];
  const last = resolved[resolved.length - 1];
  if (!first || !last) return { stops: [], outOfGamut: false };
  const f = sampler(resolved, gradient);
  let outOfGamut = false;

  const knot = (t: number, s: OklabAlpha): Knot => {
    const m = toSrgb(s.color, gradient.gamut);
    if (m.mapped) outOfGamut = true;
    const qa = toByte(s.alpha);
    const r = toByte(m.rgb.r);
    const g = toByte(m.rgb.g);
    const b = toByte(m.rgb.b);
    return {
      t,
      r: m.rgb.r * s.alpha,
      g: m.rgb.g * s.alpha,
      b: m.rgb.b * s.alpha,
      alpha: s.alpha,
      qr: r * qa,
      qg: g * qa,
      qb: b * qa,
      qa,
      hex: rgbToHex({ r, g, b }),
      sig: signature(m.rgb, m.mapped),
    };
  };

  // The base: every resolved stop with its own color, plus the solid ends outside them.
  const base: Knot[] = [];
  const own = (s: ResolvedStop): OklabAlpha => ({
    color: oklchToOklab(s.color),
    alpha: clamp01(s.alpha),
  });
  const start = clamp01(first.position);
  if (start > 0) base.push(knot(0, own(first)));
  for (const s of resolved) base.push(knot(clamp01(s.position), own(s)));
  if (clamp01(last.position) < 1) base.push(knot(1, own(last)));

  // Stretches between neighbors with room between them; `live` ones lie inside a segment.
  const liveAt = (i: number): boolean => {
    const a = base[i] as Knot;
    const b = base[i + 1] as Knot;
    return b.t > a.t && a.t >= start && b.t <= clamp01(last.position);
  };
  const stretches = base.slice(0, -1).map((_, i) => i);
  const live = stretches.filter(liveAt);
  const spread =
    live.length > 0 ? live : stretches.filter((i) => (base[i + 1] as Knot).t > (base[i] as Knot).t);

  // Extra stops up to 16, by length (largest remainder), each stretch divided evenly. Stretches
  // tied for a remainder all get one, so a palindrome (mirror) bakes into a palindrome.
  const extra = new Map<number, number>();
  const missing = MIN_BAKED_STOPS - base.length;
  if (missing > 0 && spread.length > 0) {
    const lengths = spread.map((i) => (base[i + 1] as Knot).t - (base[i] as Knot).t);
    const total = lengths.reduce((sum, l) => sum + l, 0);
    const shares = lengths.map((l) => (l / total) * missing);
    const counts = shares.map((s) => Math.floor(s + 1e-9));
    let left = missing - counts.reduce((sum, c) => sum + c, 0);
    const rests = shares.map((s, k) => s - (counts[k] ?? 0));
    while (left > 0) {
      const top = Math.max(...rests);
      rests.forEach((r, k) => {
        if (r < top - 1e-9) return;
        counts[k] = (counts[k] ?? 0) + 1;
        rests[k] = -1;
        left -= 1;
      });
    }
    spread.forEach((i, k) => {
      extra.set(i, counts[k] ?? 0);
    });
  }
  const knots: Knot[] = [];
  base.forEach((k, i) => {
    knots.push(k);
    const n = extra.get(i) ?? 0;
    const next = base[i + 1];
    if (!next) return;
    for (let j = 1; j <= n; j++) {
      const t = k.t + ((next.t - k.t) * j) / (n + 1);
      knots.push(knot(t, f(t)));
    }
  });

  /**
   * The error of the stretch from `a` to `b`: what CSS draws there against the truth, at the check
   * points. Gamut mapping bends the true curve where it meets or leaves a boundary, and the bend can
   * fall between check points, so where the boundary signature changes the bend is found by
   * bisection and checked too.
   */
  const errorOf = (a: Knot, b: Knot): number => {
    const span = b.t - a.t;
    if (span <= 0) return 0;
    const at = (want: Knot): number => {
      const s = (want.t - a.t) / span;
      const qa = a.qa + (b.qa - a.qa) * s;
      return Math.max(
        Math.abs(a.qr + (b.qr - a.qr) * s - want.r),
        Math.abs(a.qg + (b.qg - a.qg) * s - want.g),
        Math.abs(a.qb + (b.qb - a.qb) * s - want.b),
        Math.abs(qa - want.alpha),
      );
    };
    let error = 0;
    let prev = a;
    for (let j = 1; j <= CHECKS; j++) {
      const want = j < CHECKS ? knot(a.t + (span * j) / CHECKS, f(a.t + (span * j) / CHECKS)) : b;
      if (j < CHECKS) error = Math.max(error, at(want));
      if (want.sig !== prev.sig) {
        let lo = prev.t;
        let hi = want.t;
        for (let k = 0; k < BEND_STEPS; k++) {
          const mid = (lo + hi) / 2;
          if (knot(mid, f(mid)).sig === prev.sig) lo = mid;
          else hi = mid;
        }
        error = Math.max(error, at(knot((lo + hi) / 2, f((lo + hi) / 2))));
      }
      prev = want;
    }
    return error;
  };

  // Split the worst stretch in half, so that when the 64 stops run out they went where the error
  // was largest. Stretches with the same error (a mirrored gradient's twins) split together, or not
  // at all when there is no room for every one, so a palindrome bakes into a palindrome.
  const errors = knots.slice(0, -1).map((k, i) => errorOf(k, knots[i + 1] as Knot));
  const splittable = (i: number): boolean =>
    (errors[i] ?? 0) > REFINE_TOLERANCE &&
    (knots[i + 1] as Knot).t - (knots[i] as Knot).t >= MIN_STRETCH;
  while (knots.length < MAX_BAKED_STOPS) {
    let top = -1;
    errors.forEach((e, i) => {
      if (splittable(i) && e > top) top = e;
    });
    if (top < 0) break;
    const twins = errors
      .map((e, i) => (splittable(i) && Math.abs(e - top) <= TWIN_ERROR ? i : -1))
      .filter((i) => i >= 0);
    if (knots.length + twins.length > MAX_BAKED_STOPS) break;
    for (const i of twins.reverse()) {
      const a = knots[i] as Knot;
      const b = knots[i + 1] as Knot;
      const t = (a.t + b.t) / 2;
      const mid = knot(t, f(t));
      knots.splice(i + 1, 0, mid);
      errors.splice(i, 1, errorOf(a, mid), errorOf(mid, b));
    }
  }

  return {
    stops: knots.map((k) => ({ position: k.t, hex: k.hex, alpha: k.qa })),
    outOfGamut,
  };
}
