/**
 * Color distance (spec 2.3, 2.4): ΔE OK (Euclidean in OKLab) and CIEDE2000 (CIE 2001, as written
 * up by Sharma, Wu and Dalal 2005). The distance metric setting picks one for merging and for the
 * outlier distance (decision 7); clustering stays Euclidean in the working space (spec 7.6).
 */
import { type Lab, type Oklab, oklabToLab } from "./convert";

export type DistanceMetric = "ok" | "ciede2000";

/** ΔE OK: Euclidean distance in OKLab. A difference of about 0.02 is a just-noticeable step. */
export function deltaEOK(x: Oklab, y: Oklab): number {
  const dl = x.l - y.l;
  const da = x.a - y.a;
  const db = x.b - y.b;
  return Math.sqrt(dl * dl + da * da + db * db);
}

const RAD = Math.PI / 180;
const POW25_7 = 25 ** 7;

/** Hue angle in degrees, 0 to 360; 0 when a and b are both 0. */
function hue(b: number, a: number): number {
  if (a === 0 && b === 0) return 0;
  const h = Math.atan2(b, a) / RAD;
  return h < 0 ? h + 360 : h;
}

/** CIEDE2000 between two CIELAB (D65) colors, with kL = kC = kH = 1. */
export function deltaE2000(x: Lab, y: Lab): number {
  const c1 = Math.hypot(x.a, x.b);
  const c2 = Math.hypot(y.a, y.b);
  const cBar7 = ((c1 + c2) / 2) ** 7;
  const g = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + POW25_7)));
  const a1 = (1 + g) * x.a;
  const a2 = (1 + g) * y.a;
  const cp1 = Math.hypot(a1, x.b);
  const cp2 = Math.hypot(a2, y.b);
  const hp1 = hue(x.b, a1);
  const hp2 = hue(y.b, a2);

  const dL = y.l - x.l;
  const dC = cp2 - cp1;
  let dh = 0;
  if (cp1 * cp2 !== 0) {
    dh = hp2 - hp1;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  }
  const dH = 2 * Math.sqrt(cp1 * cp2) * Math.sin((dh / 2) * RAD);

  const lBar = (x.l + y.l) / 2;
  const cpBar = (cp1 + cp2) / 2;
  let hBar = hp1 + hp2;
  if (cp1 * cp2 !== 0) {
    if (Math.abs(hp1 - hp2) <= 180) hBar /= 2;
    else hBar = hBar < 360 ? (hBar + 360) / 2 : (hBar - 360) / 2;
  }
  const t =
    1 -
    0.17 * Math.cos((hBar - 30) * RAD) +
    0.24 * Math.cos(2 * hBar * RAD) +
    0.32 * Math.cos((3 * hBar + 6) * RAD) -
    0.2 * Math.cos((4 * hBar - 63) * RAD);
  const dTheta = 30 * Math.exp(-(((hBar - 275) / 25) ** 2));
  const cpBar7 = cpBar ** 7;
  const rc = 2 * Math.sqrt(cpBar7 / (cpBar7 + POW25_7));
  const l50 = (lBar - 50) ** 2;
  const sl = 1 + (0.015 * l50) / Math.sqrt(20 + l50);
  const sc = 1 + 0.045 * cpBar;
  const sh = 1 + 0.015 * cpBar * t;
  const rt = -Math.sin(2 * dTheta * RAD) * rc;

  const tl = dL / sl;
  const tc = dC / sc;
  const th = dH / sh;
  return Math.sqrt(tl * tl + tc * tc + th * th + rt * tc * th);
}

/** The distance between two OKLab colors under the chosen metric (spec 2.4 "Distance metric"). */
export function deltaE(metric: DistanceMetric, x: Oklab, y: Oklab): number {
  return metric === "ciede2000" ? deltaE2000(oklabToLab(x), oklabToLab(y)) : deltaEOK(x, y);
}

/**
 * The merge threshold in the metric's own units (decision 7). Settings store ΔE OK units (0 to
 * 0.15); under CIEDE2000 the same value reads ×100, in ΔE00 units (0 to 15, default 3.0).
 */
export function thresholdFor(metric: DistanceMetric, stored: number): number {
  return metric === "ciede2000" ? stored * 100 : stored;
}
