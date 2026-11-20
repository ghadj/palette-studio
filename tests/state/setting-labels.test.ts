import { describe, expect, it } from "vitest";
import { applyPreset, PRESET_LABELS } from "../../src/extract/presets";
import { DEFAULT_SETTINGS } from "../../src/state/defaults";
import { nameSettingsChange, settingsChangeLabel } from "../../src/state/setting-labels";

describe("settings undo labels (M3 decision 3a)", () => {
  const base = { ...DEFAULT_SETTINGS };

  it("names the one setting that changed, as its row does", () => {
    expect(settingsChangeLabel(base, { ...base, colors: 8 })).toBe("Colors");
    expect(settingsChangeLabel(base, { ...base, algorithm: "wu" })).toBe("Algorithm");
    expect(settingsChangeLabel(base, { ...base, vividness: 0.5 })).toBe("Population vs. vividness");
    expect(
      settingsChangeLabel(base, { ...base, ignoreDark: { ...base.ignoreDark, on: true } }),
    ).toBe("Ignore dark");
    expect(
      settingsChangeLabel(base, { ...base, ignoreLight: { ...base.ignoreLight, threshold: 0.9 } }),
    ).toBe("Light threshold");
  });

  it("says Settings when several changed, and null when none did", () => {
    expect(settingsChangeLabel(base, { ...base, colors: 8, seed: 3 })).toBe("Settings");
    expect(settingsChangeLabel(base, { ...base })).toBeNull();
  });

  it("applying a preset reads 'Preset: <name>' (user decision, 2026-11-19)", () => {
    const vibrant = applyPreset(base, "vibrant");
    nameSettingsChange(vibrant, `Preset: ${PRESET_LABELS.vibrant}`);
    expect(settingsChangeLabel(base, vibrant)).toBe("Preset: Vibrant");
    // A further change before the step is recorded is no longer just the preset.
    expect(settingsChangeLabel(base, { ...vibrant, colors: 9 })).toBe("Settings");
    // The name belongs to those settings only.
    expect(settingsChangeLabel(base, { ...base, colors: 8 })).toBe("Colors");
  });
});
