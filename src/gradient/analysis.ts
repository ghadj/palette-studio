/**
 * Analysis of a gradient's baked stops (spec 3.5, 4.4): the vision simulation (M4-T12) and the
 * lowest text contrast (M4-T13). M4-T2 reserves the signatures. T12 and T13 run one after the
 * other, so each replaces its own function here.
 */
import type { CvdType } from "../color/cvd";
import type { BakedStop } from "./bake";

/** The baked stops as seen with a color vision deficiency. Not built yet (M4-T12). */
export function simulateBaked(_baked: readonly BakedStop[], _type: CvdType): BakedStop[] {
  throw new Error("not built");
}

/**
 * The lowest WCAG contrast between a text color (`textHex`) and the gradient's `samples`, composing
 * alpha over `backdropHex` (the surround color, or white for Match theme: spec 6.2, plan D22). Not
 * built yet (M4-T13).
 */
export function lowestContrast(
  _textHex: string,
  _samples: readonly BakedStop[],
  _backdropHex: string,
): number {
  throw new Error("not built");
}
