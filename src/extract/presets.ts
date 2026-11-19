/**
 * Extraction presets (spec 2.5; M2 decision 11). A preset is a patch over the preset fields:
 * algorithm, Colors (Dominant and Balanced only), population vs. vividness, the ignore dark and
 * light toggles, merge threshold, resampling and keep one outlier. Applying one sets the fields it
 * names and resets the other preset fields to their spec 2.4 defaults. Everything else is kept:
 * Colors (for the other presets), Working space, Sample size, Seed, the filter thresholds and the
 * filters it doesn't name, ignore background, spatial weighting and the other Advanced settings.
 */
import { SPEC_DEFAULT_SETTINGS } from "../state/defaults";
import type { Algorithm, ExtractionSettings, Resampling } from "../types";

export type PresetId =
  | "dominant"
  | "balanced"
  | "vibrant"
  | "flat-art"
  | "accents"
  | "swatch-roles";

/** The preset row reads "Custom" when no preset matches (decision 11). */
export type PresetMatch = PresetId | "custom";

/** Spec 2.5 order. */
export const PRESET_IDS: readonly PresetId[] = [
  "dominant",
  "balanced",
  "vibrant",
  "flat-art",
  "accents",
  "swatch-roles",
];

export const PRESET_LABELS: Record<PresetMatch, string> = {
  dominant: "Dominant",
  balanced: "Balanced",
  vibrant: "Vibrant",
  "flat-art": "Flat art",
  accents: "Accents",
  "swatch-roles": "Swatch roles",
  custom: "Custom",
};

interface PresetPatch {
  algorithm: Algorithm;
  colors?: number;
  vividness?: number;
  ignoreDark?: boolean;
  ignoreLight?: boolean;
  mergeThreshold?: number;
  resampling?: Resampling;
  keepOutlier?: boolean;
}

/** Spec 2.5. */
const PRESETS: Record<PresetId, PresetPatch> = {
  dominant: { algorithm: "median-cut", colors: 6, mergeThreshold: 0.03 },
  balanced: { algorithm: "balanced", colors: 6 },
  vibrant: { algorithm: "kmeans", vividness: 0.6, ignoreDark: true, ignoreLight: true },
  "flat-art": { algorithm: "exact", resampling: "nearest", mergeThreshold: 0 },
  accents: { algorithm: "even-spread", keepOutlier: true },
  "swatch-roles": { algorithm: "swatch-roles" },
};

/** Returns new settings with the preset applied; the input is not changed. */
export function applyPreset(settings: ExtractionSettings, id: PresetId): ExtractionSettings {
  const p = PRESETS[id];
  const d = SPEC_DEFAULT_SETTINGS;
  return {
    ...settings,
    algorithm: p.algorithm,
    colors: p.colors ?? settings.colors,
    vividness: p.vividness ?? d.vividness,
    ignoreDark: { ...settings.ignoreDark, on: p.ignoreDark ?? d.ignoreDark.on },
    ignoreLight: { ...settings.ignoreLight, on: p.ignoreLight ?? d.ignoreLight.on },
    mergeThreshold: p.mergeThreshold ?? d.mergeThreshold,
    resampling: p.resampling ?? d.resampling,
    keepOutlier: p.keepOutlier ?? d.keepOutlier,
  };
}

/** Decimal fields commit rounded values, so numbers compare within a small tolerance. */
const same = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;

function presetFieldsEqual(a: ExtractionSettings, b: ExtractionSettings): boolean {
  return (
    a.algorithm === b.algorithm &&
    same(a.colors, b.colors) &&
    same(a.vividness, b.vividness) &&
    a.ignoreDark.on === b.ignoreDark.on &&
    a.ignoreLight.on === b.ignoreLight.on &&
    same(a.mergeThreshold, b.mergeThreshold) &&
    a.resampling === b.resampling &&
    a.keepOutlier === b.keepOutlier
  );
}

/**
 * The preset whose fields the settings hold, or "custom". Only preset fields count, so settings a
 * preset keeps (Working space, Sample size, Seed, filter thresholds, ignore background, spatial
 * weighting and so on) never break a match. Each preset has its own algorithm, so at most one
 * matches.
 */
export function matchPreset(settings: ExtractionSettings): PresetMatch {
  for (const id of PRESET_IDS) {
    if (presetFieldsEqual(settings, applyPreset(settings, id))) return id;
  }
  return "custom";
}
