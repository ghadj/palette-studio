/**
 * Harmonies (spec 3.4; plan D5): hue rotations in OKLCH that keep L and C, clamped to sRGB.
 */
import type { Oklch } from "./convert";
import { clampChroma } from "./gamut";

export interface HarmonyGroup {
  id: string;
  label: string;
  colors: Oklch[];
}

const GROUPS: ReadonlyArray<{ id: string; label: string; offsets: readonly number[] }> = [
  { id: "complementary", label: "Complementary", offsets: [180] },
  { id: "split-complementary", label: "Split-complementary", offsets: [150, -150] },
  { id: "triadic", label: "Triadic", offsets: [120, -120] },
  { id: "tetradic", label: "Tetradic", offsets: [90, 180, 270] },
  { id: "analogous", label: "Analogous", offsets: [-30, 30] },
];

const wrap = (h: number): number => ((h % 360) + 360) % 360;

export function harmonies(source: Oklch): HarmonyGroup[] {
  return GROUPS.map(({ id, label, offsets }) => ({
    id,
    label,
    colors: offsets.map((o) => clampChroma({ ...source, h: wrap(source.h + o) })),
  }));
}
