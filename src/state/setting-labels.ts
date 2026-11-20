/**
 * The name of an extraction-settings change, for its undo step (M3 decision 3a), such as "Undo
 * Colors". The names match the setting rows' labels.
 */
import type { ExtractionSettings } from "../types";

const LABELS: Record<keyof ExtractionSettings, string> = {
  algorithm: "Algorithm",
  colors: "Colors",
  workingSpace: "Working space",
  sampleSize: "Sample size",
  resampling: "Resampling",
  alphaCutoff: "Alpha cutoff",
  ignoreDark: "Ignore dark",
  ignoreLight: "Ignore light",
  ignoreBackground: "Ignore background",
  minChroma: "Minimum chroma",
  vividness: "Population vs. vividness",
  mergeThreshold: "Merge threshold",
  distanceMetric: "Distance metric",
  spatialWeighting: "Spatial weighting",
  keepOutlier: "Keep one outlier",
  histogramBits: "Histogram bits",
  iterations: "Iterations",
  restarts: "Restarts",
  seed: "Seed",
  sort: "Sort",
};

/** The threshold halves of Ignore dark and Ignore light have rows of their own. */
const THRESHOLD_LABELS: Partial<Record<keyof ExtractionSettings, string>> = {
  ignoreDark: "Dark threshold",
  ignoreLight: "Light threshold",
};

function changeLabel(key: keyof ExtractionSettings, before: unknown, after: unknown): string {
  const threshold = THRESHOLD_LABELS[key];
  if (threshold && typeof before === "object" && typeof after === "object" && before && after) {
    const b = before as { on: boolean; threshold: number };
    const a = after as { on: boolean; threshold: number };
    if (b.on === a.on && b.threshold !== a.threshold) return threshold;
  }
  return LABELS[key];
}

/** A change made as one action, such as applying a preset, with the name of that action. */
let named: { settings: ExtractionSettings; label: string } | null = null;

/**
 * Names the change that produces exactly `settings`, such as "Preset: Vibrant". If the settings
 * change again before the step is recorded, the name no longer applies.
 */
export function nameSettingsChange(settings: ExtractionSettings, label: string): void {
  named = { settings, label };
}

/**
 * The label of the change from `before` to `after`, and null when nothing changed:
 * - the name given to `after` through `nameSettingsChange`, such as "Preset: Vibrant";
 * - otherwise the setting's name when one setting changed, and "Settings" when several did.
 */
export function settingsChangeLabel(
  before: ExtractionSettings,
  after: ExtractionSettings,
): string | null {
  const changed = (Object.keys(LABELS) as Array<keyof ExtractionSettings>).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
  const [only] = changed;
  if (only === undefined) return null;
  if (named?.settings === after) return named.label;
  if (changed.length > 1) return "Settings";
  return changeLabel(only, before[only], after[only]);
}
