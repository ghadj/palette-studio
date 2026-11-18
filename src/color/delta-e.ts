import type { Oklab } from "./convert";

/**
 * ΔE OK (spec 2.3): Euclidean distance in OKLab. A difference of about 0.02 is a just-noticeable step.
 * CIEDE2000 arrives with the distance-metric setting in M2.
 */
export function deltaEOK(x: Oklab, y: Oklab): number {
  const dl = x.l - y.l;
  const da = x.a - y.a;
  const db = x.b - y.b;
  return Math.sqrt(dl * dl + da * da + db * db);
}
