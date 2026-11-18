/**
 * Which extraction settings apply to which algorithm (decision 14). A setting not listed here
 * applies to every algorithm. Controls for a setting that doesn't apply are disabled, not hidden,
 * so the layout doesn't jump, and their values are kept. M2 extends this table when Wu, Balanced,
 * iterations and restarts arrive, without new UI logic.
 */
import type { Algorithm, ExtractionSettings } from "../types";

export type SettingKey = keyof ExtractionSettings;

const ONLY_FOR: Partial<Record<SettingKey, readonly Algorithm[]>> = {
  seed: ["kmeans"],
  iterations: ["kmeans"],
  restarts: ["kmeans"],
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

export function settingApplies(setting: SettingKey, algorithm: Algorithm): boolean {
  const only = ONLY_FOR[setting];
  return !only || only.includes(algorithm);
}

/** "Used by k-means++ only" for a setting that only some algorithms use; null otherwise. */
export function onlyForNote(setting: SettingKey): string | null {
  const only = ONLY_FOR[setting];
  if (!only) return null;
  return `Used by ${only.map((a) => IN_TEXT[a]).join(" and ")} only`;
}
