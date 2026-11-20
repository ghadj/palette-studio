/** Place on image takes the image color at the placed point, as one undo step (decision 66). */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hexToOklab, oklchToHex } from "../../src/color/convert";
import { createSwatch } from "../../src/palette/model";

const { placeOnImage } = await import("../../src/state/extraction");
const history = await import("../../src/state/history");
const { displayImage, masterThread, palette } = await import("../../src/state/signals");

const AT = { x: 0.8, y: 0.2 };

beforeEach(() => {
  displayImage.value = {} as ImageBitmap;
  masterThread.value = null;
  palette.value = [
    createSwatch(hexToOklab("#14386B"), { id: "a", point: { x: 0.1, y: 0.1 } }),
    createSwatch(hexToOklab("#FF0000"), {
      id: "b",
      point: null,
      sampleRadius: 5,
      sampleStat: "median",
    }),
  ];
  history.clear();
});

describe("placeOnImage", () => {
  it("sets the point and the sampled color in one undo step, pinned", async () => {
    const place = vi.fn().mockResolvedValue(AT);
    const sample = vi.fn().mockResolvedValue({ color: hexToOklab("#1E8A2E") });
    expect(await placeOnImage("b", place, sample)).toBe(true);
    expect(sample).toHaveBeenCalledWith(AT, 5, "median");
    const s = palette.value[1];
    expect(s?.point).toEqual(AT);
    expect(s && oklchToHex(s.color)).toBe("#1E8A2E");
    expect(s?.pinned).toBe(true);
    expect(history.undoLabel.value).toBe("Place on image");
    history.undo();
    expect(palette.value[1]?.point).toBeNull();
    expect(oklchToHex(palette.value[1]?.color ?? { l: 0, c: 0, h: 0 })).toBe("#FF0000");
    expect(history.canUndo.value).toBe(false);
  });

  it("changes nothing when sampling fails", async () => {
    const before = palette.value;
    const place = vi.fn().mockResolvedValue(AT);
    const sample = vi.fn().mockRejectedValue(new Error("x"));
    expect(await placeOnImage("b", place, sample)).toBe(false);
    expect(palette.value).toBe(before);
    expect(history.canUndo.value).toBe(false);
  });
});
