/** Changing a swatch's sample radius or statistic resamples it at once, as one undo step (spec 3.7; decision 31). */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hexToOklab, oklchToHex } from "../../src/color/convert";
import { createSwatch } from "../../src/palette/model";

const { changeSampling, imageAvailable } = await import("../../src/state/resample");
const history = await import("../../src/state/history");
const { displayImage, masterThread, palette } = await import("../../src/state/signals");

const START = { x: 0.3, y: 0.4 };

beforeEach(() => {
  displayImage.value = {} as ImageBitmap;
  masterThread.value = null;
  palette.value = [
    createSwatch(hexToOklab("#14386B"), { id: "a", point: START }),
    createSwatch(hexToOklab("#FF0000"), { id: "b", point: null }),
  ];
  history.clear();
});

describe("changeSampling", () => {
  it("sets the setting, samples the swatch's point with it, and is one undo step", async () => {
    const sample = vi.fn().mockResolvedValue({ color: hexToOklab("#1E8A2E") });
    await changeSampling("a", "Sample radius", { sampleRadius: 5 }, sample);
    expect(sample).toHaveBeenCalledWith(START, 5, "mean");
    const swatch = palette.value[0];
    expect(swatch?.sampleRadius).toBe(5);
    expect(swatch && oklchToHex(swatch.color)).toBe("#1E8A2E");
    expect(swatch?.pinned).toBe(true);
    expect(history.canUndo.value).toBe(true);
    expect(history.undoLabel.value).toBe("Sample radius");
    history.undo();
    expect(palette.value[0]?.sampleRadius).toBe("auto");
    expect(oklchToHex(palette.value[0]?.color ?? { l: 0, c: 0, h: 0 })).toBe("#14386B");
  });

  it("a statistic change samples with the new statistic", async () => {
    const sample = vi.fn().mockResolvedValue({ color: hexToOklab("#1E8A2E") });
    await changeSampling("a", "Sample statistic", { sampleStat: "median" }, sample);
    expect(sample).toHaveBeenCalledWith(START, "auto", "median");
  });

  it("a swatch with no point just stores the setting", async () => {
    const sample = vi.fn();
    await changeSampling("b", "Sample radius", { sampleRadius: 11 }, sample);
    expect(sample).not.toHaveBeenCalled();
    expect(palette.value[1]?.sampleRadius).toBe(11);
    expect(history.canUndo.value).toBe(true);
  });

  it("when the worker fails the setting is kept, the color is not, and it is still one step", async () => {
    const sample = vi.fn().mockRejectedValue(new Error("fail"));
    await changeSampling("a", "Sample radius", { sampleRadius: 3 }, sample);
    expect(palette.value[0]?.sampleRadius).toBe(3);
    expect(oklchToHex(palette.value[0]?.color ?? { l: 0, c: 0, h: 0 })).toBe("#14386B");
    expect(history.canUndo.value).toBe(true);
  });
});

describe("imageAvailable", () => {
  it("is true with a loaded image or a prepared master (the demo's fixture)", () => {
    expect(imageAvailable()).toBe(true);
    displayImage.value = null;
    expect(imageAvailable()).toBe(false);
    masterThread.value = "worker";
    expect(imageAvailable()).toBe(true);
  });
});
