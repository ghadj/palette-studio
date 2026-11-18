/**
 * Swatch roles (Vibrant style; spec 2.2, 7.6 "Labels"; M2 decision 10). The histogram is split into
 * 64 median-cut boxes; each box mean is a candidate. Each role takes the candidate, not already
 * taken, that lies inside the role's HSL lightness and saturation windows and has the highest
 * weighted mean of closeness to the targets and relative population, as in Vibrant.js:
 *
 * - lightness: Dark target 0.26, max 0.45; Normal 0.5, 0.3 to 0.7; Light 0.74, min 0.55
 * - saturation: Vibrant target 1, min 0.35; Muted 0.3, max 0.4
 * - weights: saturation 3, lightness 6, population 1
 *
 * Roles pick in Vibrant.js order (Vibrant, Light vibrant, Dark vibrant, Muted, Light muted, Dark
 * muted), so no candidate is used twice, and come back in SWATCH_ROLES order. A role with no
 * candidate in its windows stays empty and is left out (decision 10b). Pure and deterministic.
 */
import { oklabToRgb, rgbToHsl } from "../color/convert";
import { workingToOklab } from "../color/working-space";
import type { WorkingSpace } from "../types";
import type { Histogram } from "./histogram";
import { type Cluster, medianCut } from "./median-cut";

/** The six roles, in the order they are listed (M2-T6). */
export const SWATCH_ROLES = [
  "Vibrant",
  "Muted",
  "Dark vibrant",
  "Dark muted",
  "Light vibrant",
  "Light muted",
] as const;

export type SwatchRole = (typeof SWATCH_ROLES)[number];

/** Candidates come from a 64-box median cut (decision 10a). */
export const ROLE_CANDIDATES = 64;

interface Window {
  target: number;
  min: number;
  max: number;
}

const DARK: Window = { target: 0.26, min: 0, max: 0.45 };
const NORMAL: Window = { target: 0.5, min: 0.3, max: 0.7 };
const LIGHT: Window = { target: 0.74, min: 0.55, max: 1 };
const VIBRANT: Window = { target: 1, min: 0.35, max: 1 };
const MUTED: Window = { target: 0.3, min: 0, max: 0.4 };

const WEIGHT_SATURATION = 3;
const WEIGHT_LIGHTNESS = 6;
const WEIGHT_POPULATION = 1;

/** Roles in the order they pick (Vibrant.js), with their lightness and saturation windows. */
const PICK_ORDER: ReadonlyArray<{ role: SwatchRole; l: Window; s: Window }> = [
  { role: "Vibrant", l: NORMAL, s: VIBRANT },
  { role: "Light vibrant", l: LIGHT, s: VIBRANT },
  { role: "Dark vibrant", l: DARK, s: VIBRANT },
  { role: "Muted", l: NORMAL, s: MUTED },
  { role: "Light muted", l: LIGHT, s: MUTED },
  { role: "Dark muted", l: DARK, s: MUTED },
];

/** A candidate color: its HSL saturation and lightness (0 to 1) and its population. */
export interface RoleCandidate {
  s: number;
  l: number;
  population: number;
}

export interface RolePick {
  role: SwatchRole;
  /** Index into the candidates. */
  index: number;
}

/** The filled roles in SWATCH_ROLES order, each with the candidate it took. */
export function pickRoles(candidates: readonly RoleCandidate[]): RolePick[] {
  let highest = 0;
  for (const c of candidates) if (c.population > highest) highest = c.population;
  const taken = new Set<number>();
  const picks = new Map<SwatchRole, number>();
  for (const { role, l: lw, s: sw } of PICK_ORDER) {
    let best = -1;
    let bestValue = 0;
    for (let i = 0; i < candidates.length; i += 1) {
      const c = candidates[i] as RoleCandidate;
      if (taken.has(i)) continue;
      if (c.s < sw.min || c.s > sw.max || c.l < lw.min || c.l > lw.max) continue;
      const value =
        (WEIGHT_SATURATION * (1 - Math.abs(c.s - sw.target)) +
          WEIGHT_LIGHTNESS * (1 - Math.abs(c.l - lw.target)) +
          WEIGHT_POPULATION * (highest > 0 ? c.population / highest : 0)) /
        (WEIGHT_SATURATION + WEIGHT_LIGHTNESS + WEIGHT_POPULATION);
      // The first candidate wins a tie, as in Vibrant.js.
      if (best < 0 || value > bestValue) {
        best = i;
        bestValue = value;
      }
    }
    if (best >= 0) {
      taken.add(best);
      picks.set(role, best);
    }
  }
  const out: RolePick[] = [];
  for (const role of SWATCH_ROLES) {
    const index = picks.get(role);
    if (index !== undefined) out.push({ role, index });
  }
  return out;
}

export interface RoleCluster extends Cluster {
  role: SwatchRole;
}

/**
 * Swatch roles over the weighted histogram. Each swatch is a median-cut box: its mean color (working
 * space) and its share of the counted pixels.
 */
export function swatchRoles(h: Histogram, space: WorkingSpace): RoleCluster[] {
  const boxes = medianCut(h, ROLE_CANDIDATES);
  const candidates = boxes.map((box) => {
    const { s, l } = rgbToHsl(
      oklabToRgb(workingToOklab(space, box.color[0], box.color[1], box.color[2])),
    );
    return { s, l, population: box.population };
  });
  return pickRoles(candidates).map(({ role, index }) => ({
    ...(boxes[index] as Cluster),
    role,
  }));
}

/** The roles a list of swatch names leaves empty, in SWATCH_ROLES order. */
export function missingRoles(names: readonly string[]): SwatchRole[] {
  return SWATCH_ROLES.filter((role) => !names.includes(role));
}
