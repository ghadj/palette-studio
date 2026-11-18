/**
 * Which extraction settings apply to which algorithm (M1 decision 14). A setting is either used by
 * some algorithms only ("Used by k-means++ only") or not used by some ("Not used by swatch roles");
 * a setting in neither table applies to every algorithm. Controls for a setting that doesn't apply
 * are disabled, not hidden, so the layout doesn't jump, and their values are kept.
 */
import type { Algorithm, ExtractionSettings } from "../types";

export type SettingKey = keyof ExtractionSettings;

const ONLY_FOR: Partial<Record<SettingKey, readonly Algorithm[]>> = {
  seed: ["kmeans"],
  iterations: ["kmeans"],
  restarts: ["kmeans"],
};

/** M2 decision 10c: swatch roles pick six named swatches, so these settings don't shape them. */
const NOT_USED_BY: Partial<Record<SettingKey, readonly Algorithm[]>> = {
  colors: ["swatch-roles"],
  mergeThreshold: ["swatch-roles"],
  keepOutlier: ["swatch-roles"],
};

/** Algorithm names as they read inside a sentence. */
const IN_TEXT: Record<Algorithm, string> = {
  kmeans: "k-means++",
  "median-cut": "median cut",
  wu: "Wu",
  balanced: "Balanced",
  exact: "exact colors",
  "even-spread": "even spread",
  "swatch-roles": "swatch roles",
};

const list = (algorithms: readonly Algorithm[]): string =>
  algorithms.map((a) => IN_TEXT[a]).join(" and ");

export function settingApplies(setting: SettingKey, algorithm: Algorithm): boolean {
  const only = ONLY_FOR[setting];
  if (only && !only.includes(algorithm)) return false;
  const not = NOT_USED_BY[setting];
  return !not?.includes(algorithm);
}

/**
 * The note beside a setting that some algorithms don't use: "Used by k-means++ only" or "Not used
 * by swatch roles". Null for a setting every algorithm uses.
 */
export function settingNote(setting: SettingKey): string | null {
  const only = ONLY_FOR[setting];
  if (only) return `Used by ${list(only)} only`;
  const not = NOT_USED_BY[setting];
  if (not) return `Not used by ${list(not)}`;
  return null;
}
