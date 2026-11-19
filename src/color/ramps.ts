/**
 * Tonal ramps (spec 3.4; plan D4): 11 steps from 50 to 950 in OKLCH, keeping the source's hue.
 */
import type { Oklch } from "./convert";
import { clampChroma } from "./gamut";

export const RAMP_LABELS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

export interface RampStep {
  label: number;
  color: Oklch;
  /** True for the one step nearest the source's lightness, which is the source itself. */
  isSource: boolean;
}

const STEPS = RAMP_LABELS.length - 1;

function targetL(i: number): number {
  return 0.97 - (0.72 * i) / STEPS;
}

/** The ramp for a color: L from 0.97 to 0.25, C tapering to 0.3 × the source's at both ends. */
export function ramp(source: Oklch): RampStep[] {
  let nearest = 0;
  for (let i = 1; i <= STEPS; i += 1) {
    if (Math.abs(targetL(i) - source.l) < Math.abs(targetL(nearest) - source.l)) nearest = i;
  }
  return RAMP_LABELS.map((label, i) => {
    if (i === nearest) return { label, color: clampChroma(source), isSource: true };
    const t = i / STEPS;
    const c = source.c * (0.3 + 0.7 * (1 - (2 * t - 1) ** 2));
    return { label, color: clampChroma({ l: targetL(i), c, h: source.h }), isSource: false };
  });
}
