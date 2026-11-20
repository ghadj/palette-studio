/** The "+" tile adds the image's next most distinct color, or a hue-rotated one (decision 40). */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hexToOklab, oklchToHex } from "../../src/color/convert";
import { deltaE } from "../../src/color/delta-e";
import { createSwatch, FULL_MESSAGE, MAX_SWATCHES, swatchOklab } from "../../src/palette/model";

const { addColor, hueRotated, mostDistinct } = await import("../../src/state/add-color");
const history = await import("../../src/state/history");
const { displayImage, masterThread, palette, selectedSwatchId, settings } = await import(
  "../../src/state/signals"
);

const POINT = { x: 0.25, y: 0.75 };

beforeEach(() => {
  displayImage.value = {} as ImageBitmap;
  masterThread.value = null;
  palette.value = ["#14386B", "#E8693A", "#1DB07A"].map((hex, i) =>
    createSwatch(hexToOklab(hex), { id: `s${i}`, origin: "extracted" }),
  );
  selectedSwatchId.value = "s1";
  history.clear();
});

const candidates = (...hexes: string[]) =>
  hexes.map((hex) => ({ lab: hexToOklab(hex), population: 0.1 }));

describe("mostDistinct", () => {
  it("takes the candidate farthest from every swatch, and none within the merge threshold", () => {
    const labs = palette.value.map(swatchOklab);
    const found = mostDistinct(
      labs,
      candidates("#14386C", "#E8693B", "#D4D4D4", "#9B30B0"),
      "ok",
      0.03,
    );
    const nearest = (c: ReturnType<typeof hexToOklab>) =>
      Math.min(...labs.map((l) => deltaE("ok", l, c)));
    expect(nearest(found as ReturnType<typeof hexToOklab>)).toBeGreaterThan(0.03);
    // Every other candidate is nearer to the palette than the one chosen.
    for (const c of candidates("#14386C", "#E8693B", "#D4D4D4", "#9B30B0")) {
      expect(nearest(c.lab)).toBeLessThanOrEqual(nearest(found as ReturnType<typeof hexToOklab>));
    }
    expect(mostDistinct(labs, candidates("#14386C", "#E8693B"), "ok", 0.03)).toBeNull();
  });
});

describe("hueRotated", () => {
  it("rotates the hue by 30 degrees and stays in sRGB", () => {
    const base = { l: 0.6, c: 0.35, h: 350 };
    const out = hueRotated(base);
    expect(out.h).toBeCloseTo(20, 9);
    expect(out.l).toBe(0.6);
    expect(out.c).toBeLessThanOrEqual(0.35);
    expect(oklchToHex(out)).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe("addColor with an image", () => {
  it("adds the most distinct color at the end, as a manual swatch with a marker, selected, in one step", async () => {
    const extract = vi.fn().mockResolvedValue({ colors: candidates("#9B30B0", "#14386C") });
    const place = vi.fn().mockResolvedValue([POINT]);
    await addColor({ extract, place }, vi.fn());
    expect(extract).toHaveBeenCalledOnce();
    expect(extract.mock.calls[0]?.[0].colors).toBe(MAX_SWATCHES);
    expect(palette.value).toHaveLength(4);
    const added = palette.value[3];
    expect(added && oklchToHex(added.color)).toBe("#9B30B0");
    expect(added).toMatchObject({ origin: "manual", pinned: false, locked: false, point: POINT });
    expect(place.mock.calls[0]?.[1]).toEqual([3]);
    expect(selectedSwatchId.value).toBe(added?.id);
    expect(history.undoLabel.value).toBe("Add color");
    history.undo();
    expect(palette.value).toHaveLength(3);
  });

  it("falls back to the hue-rotated color when the image has nothing more distinct, or fails", async () => {
    const same = vi.fn().mockResolvedValue({ colors: candidates("#14386C") });
    const place = vi.fn();
    await addColor({ extract: same, place }, vi.fn());
    expect(palette.value).toHaveLength(4);
    expect(palette.value[3]?.point).toBeNull();
    expect(place).not.toHaveBeenCalled();
    const failing = vi.fn().mockRejectedValue(new Error("fail"));
    await addColor({ extract: failing, place }, vi.fn());
    expect(palette.value).toHaveLength(5);
  });
});

describe("addColor with no image", () => {
  it("adds the selected swatch's color with its hue rotated 30 degrees", async () => {
    displayImage.value = null;
    const extract = vi.fn();
    await addColor({ extract, place: vi.fn() }, vi.fn());
    expect(extract).not.toHaveBeenCalled();
    const source = palette.value[1];
    const added = palette.value[3];
    expect(added?.color.h).toBeCloseTo(((source?.color.h ?? 0) + 30) % 360, 6);
    expect(added?.origin).toBe("manual");
    expect(selectedSwatchId.value).toBe(added?.id);
  });

  it("uses the last swatch when nothing is selected", async () => {
    displayImage.value = null;
    selectedSwatchId.value = null;
    await addColor({ extract: vi.fn(), place: vi.fn() }, vi.fn());
    const last = palette.value[2];
    expect(palette.value[3]?.color.h).toBeCloseTo(((last?.color.h ?? 0) + 30) % 360, 6);
  });
});

describe("addColor at 12", () => {
  it("adds nothing and announces the limit", async () => {
    palette.value = Array.from({ length: MAX_SWATCHES }, (_, i) =>
      createSwatch(hexToOklab("#808080"), { id: `t${i}` }),
    );
    const before = palette.value;
    const notify = vi.fn();
    await addColor({ extract: vi.fn(), place: vi.fn() }, notify);
    expect(palette.value).toBe(before);
    expect(notify).toHaveBeenCalledWith(FULL_MESSAGE);
    expect(settings.value.mergeThreshold).toBeGreaterThan(0);
  });
});
