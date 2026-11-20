/**
 * Re-extraction keeps locked swatches, and Place on image (spec 3.6, 3.7; M3 decisions 2a to 2c,
 * 3a; plan M3-T13).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const extract = vi.fn();
const place = vi.fn();
const sample = vi.fn();
vi.mock("../../src/extract/client", () => ({
  imageClient: () => ({ extract, place, sample }),
}));

const { extractNewImage, placeOnImage, startLiveExtraction } = await import(
  "../../src/state/extraction"
);
const history = await import("../../src/state/history");
const { DEBOUNCE_MS } = await import("../../src/state/jobs");
const { displayImage, palette, settings } = await import("../../src/state/signals");
const { setLocked, setPinned } = await import("../../src/palette/model");

const settle = () => new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 50));
const color = (l: number) => ({ lab: { l, a: 0, b: 0 }, population: 0.2 });
const point = (x: number) => ({ x, y: 0.5 });
const six = (...ls: number[]) => ({
  colors: ls.map(color),
  reason: null,
  points: ls.map((_, i) => point(i / 10)),
});
const lightnesses = () => palette.value.map((s) => Math.round(s.color.l * 100));

async function start(): Promise<void> {
  startLiveExtraction();
  extract.mockReset();
  place.mockReset();
  sample.mockReset();
  displayImage.value = {} as ImageBitmap;
  settings.value = { ...settings.peek(), algorithm: "balanced", colors: 6 };
  extract.mockResolvedValueOnce(six(0.1, 0.2, 0.4, 0.6, 0.8, 0.9));
  extractNewImage();
  await settle();
  extract.mockReset();
}

describe("re-extraction with locked swatches", () => {
  beforeEach(start);

  it("with 0 locked, the new colors replace the palette", async () => {
    extract.mockResolvedValueOnce(six(0.15, 0.35, 0.55, 0.75, 0.95));
    settings.value = { ...settings.peek(), colors: 5 };
    await settle();
    expect(lightnesses()).toEqual([15, 35, 55, 75, 95]);
  });

  it("with 1 locked, the total is Colors and the locked swatch keeps id, point and position", async () => {
    const locked = palette.value[2];
    if (!locked) throw new Error("no swatch");
    palette.value = setLocked(palette.value, locked.id, true);
    const kept = palette.value[2];
    extract.mockResolvedValueOnce(six(0.15, 0.35, 0.55, 0.75, 0.95));
    settings.value = { ...settings.peek(), colors: 5 };
    await settle();
    expect(palette.value).toHaveLength(5);
    expect(palette.value[2]).toBe(kept);
    expect(palette.value[2]?.point).toEqual(point(0.2));
    // The nearest new color (0.35) is dropped for the locked 0.4.
    expect(lightnesses()).toEqual([15, 55, 40, 75, 95]);
  });

  it("with every swatch locked, nothing is replaced", async () => {
    let next = palette.value;
    for (const s of palette.value) next = setLocked(next, s.id, true);
    palette.value = next;
    const kept = palette.value;
    extract.mockResolvedValueOnce(six(0.15, 0.35, 0.55, 0.75, 0.95));
    settings.value = { ...settings.peek(), colors: 5 };
    await settle();
    expect(palette.value).toHaveLength(6);
    palette.value.forEach((s, i) => {
      expect(s).toBe(kept[i]);
    });
  });

  it("a pinned swatch is kept like a locked one (decision 24)", async () => {
    const id = palette.value[2]?.id ?? "";
    palette.value = setPinned(palette.value, id, true);
    const kept = palette.value[2];
    extract.mockResolvedValueOnce(six(0.15, 0.35, 0.55, 0.75, 0.95));
    settings.value = { ...settings.peek(), colors: 5 };
    await settle();
    expect(palette.value[2]).toBe(kept);
    expect(lightnesses()).toEqual([15, 55, 40, 75, 95]);
  });

  it("a new image keeps no locked swatch", async () => {
    palette.value = setLocked(palette.value, palette.value[0]?.id ?? "", true);
    extract.mockResolvedValueOnce(six(0.3, 0.5));
    extractNewImage();
    await settle();
    expect(lightnesses()).toEqual([30, 50]);
  });

  it("undo restores the previous palette without re-extracting", async () => {
    palette.value = setLocked(palette.value, palette.value[2]?.id ?? "", true);
    history.commit("Lock");
    const before = palette.value;
    extract.mockResolvedValueOnce(six(0.15, 0.35, 0.55, 0.75, 0.95));
    settings.value = { ...settings.peek(), colors: 5 };
    await settle();
    expect(palette.value).toHaveLength(5);
    expect(history.undoLabel.value).toBe("Colors");
    extract.mockClear();

    history.undo();
    expect(palette.value).toBe(before);
    expect(settings.value.colors).toBe(6);
    await settle();
    expect(extract).not.toHaveBeenCalled();
  });
});

describe("Place on image (spec 3.7 edge cases)", () => {
  beforeEach(start);

  it("stores the placed point on the swatch as one undo step", async () => {
    const [first] = palette.value;
    if (!first) throw new Error("no swatch");
    palette.value = palette.value.map((s) => (s === first ? { ...s, point: null } : s));
    history.commit("Remove point");
    place.mockResolvedValueOnce([point(0.7)]);
    sample.mockResolvedValueOnce({ color: { l: 0.5, a: 0, b: 0 } });
    expect(await placeOnImage(first.id)).toBe(true);
    expect(place.mock.calls[0]?.[1]).toEqual([0]);
    expect(palette.value[0]?.point).toEqual(point(0.7));
    expect(Math.round((palette.value[0]?.color.l ?? 0) * 100)).toBe(50);
    expect(history.undoLabel.value).toBe("Place on image");
    history.undo();
    expect(palette.value[0]?.point).toBeNull();
  });

  it("does nothing without an image", async () => {
    displayImage.value = null;
    expect(await placeOnImage(palette.value[0]?.id ?? "")).toBe(false);
    expect(place).not.toHaveBeenCalled();
  });
});
