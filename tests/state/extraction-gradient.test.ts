/** Re-extraction and a new image keep a Custom gradient honest (plan M4-T1, D20; spec 4.3). */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hexToOklab, oklchToHex } from "../../src/color/convert";
import { moveStop } from "../../src/gradient/model";
import { createSwatch } from "../../src/palette/model";

const extract = vi.fn();
vi.mock("../../src/extract/client", () => ({ imageClient: () => ({ extract }) }));

const { extractNewImage, extractNow } = await import("../../src/state/extraction");
const { editStops, effectiveStops } = await import("../../src/state/gradient");
const history = await import("../../src/state/history");
const { DEFAULT_GRADIENT, DEFAULT_SETTINGS } = await import("../../src/state/defaults");
const { gradient, palette, settings } = await import("../../src/state/signals");

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const result = (...hexes: string[]) => ({
  colors: hexes.map((hex) => ({ lab: hexToOklab(hex), population: 1 / hexes.length })),
  reason: null,
});

beforeEach(() => {
  extract.mockReset();
  settings.value = { ...DEFAULT_SETTINGS };
  palette.value = ["#E8693A", "#1DB07A", "#14386B"].map((hex, i) =>
    createSwatch(hexToOklab(hex), { id: `old${i}` }),
  );
  gradient.value = {
    ...DEFAULT_GRADIENT,
    technique: { ...DEFAULT_GRADIENT.technique, kind: "palette-order" },
  };
  history.clear();
});

describe("gradient and extraction", () => {
  it("custom: re-extraction turns the stops of replaced swatches into fixed colors, in the same step", async () => {
    editStops((list) => moveStop(list, list[1]?.id ?? "", 0.4), "Move stop");
    const before = effectiveStops.value.map((s) => s.id);
    extract.mockResolvedValueOnce(result("#000000", "#FFFFFF"));
    extractNow();
    await flush();
    expect(palette.value).toHaveLength(2);
    const stops = effectiveStops.value;
    expect(stops.map((s) => s.id)).toEqual(before);
    expect(stops.every((s) => s.color.kind === "value")).toBe(true);
    expect(stops.map((s) => (s.color.kind === "value" ? oklchToHex(s.color.color) : ""))).toEqual([
      "#E8693A",
      "#1DB07A",
      "#14386B",
    ]);
    expect(history.undoLabel.value).not.toBeNull();
    history.undo();
    expect(effectiveStops.value.every((s) => s.color.kind === "swatch")).toBe(true);
  });

  it("a new image returns a custom gradient to its technique", async () => {
    editStops((list) => moveStop(list, list[1]?.id ?? "", 0.4), "Move stop");
    expect(gradient.value.custom).toBe(true);
    extract.mockResolvedValueOnce(result("#000000", "#FFFFFF", "#808080"));
    extractNewImage();
    expect(gradient.value.custom).toBe(false);
    await flush();
    expect(effectiveStops.value).toHaveLength(3);
    expect(effectiveStops.value.every((s) => s.color.kind === "swatch")).toBe(true);
  });
});
