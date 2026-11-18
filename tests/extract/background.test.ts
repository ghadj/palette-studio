import { describe, expect, it } from "vitest";
import { hexToOklab } from "../../src/color/convert";
import { deltaEOK } from "../../src/color/delta-e";
import { bandWidth, detectBackground } from "../../src/extract/background";
import { assignPixels, FILTERED } from "../../src/extract/cluster-map";
import { keepPixels, runExtraction } from "../../src/extract/pipeline";
import { DEFAULT_SETTINGS } from "../../src/state/defaults";
import type { ExtractionSettings } from "../../src/types";
import { STUDIO_BACKDROP, studioBackdropColor } from "../../tools/fixture-colors";
import { image } from "./helpers";

const studio = () => image(STUDIO_BACKDROP.width, STUDIO_BACKDROP.height, studioBackdropColor);
const settings = (patch: Partial<ExtractionSettings>): ExtractionSettings => ({
  ...DEFAULT_SETTINGS,
  ...patch,
});

describe("ignore background (spec 2.4; M2 decision 4)", () => {
  it("the border band is 2% of the shorter side, at least 1 px", () => {
    expect(bandWidth(400, 300)).toBe(6);
    expect(bandWidth(256, 192)).toBe(4);
    expect(bandWidth(40, 20)).toBe(1);
    expect(bandWidth(1, 1)).toBe(1);
  });

  it("studio-backdrop pixels: detects #ECEAE6 and removes it", () => {
    const img = studio();
    const result = detectBackground(img, { alphaCutoff: 128 });
    expect(result.found).toBe(true);
    expect(result.color).not.toBeNull();
    expect(deltaEOK(result.color ?? { l: 0, a: 0, b: 0 }, hexToOklab("#ECEAE6"))).toBeLessThan(
      0.04,
    );
    const { width, height, subject } = STUDIO_BACKDROP;
    let backdrop = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const inSubject =
          x >= subject.x &&
          x < subject.x + subject.width &&
          y >= subject.y &&
          y < subject.y + subject.height;
        const removed = result.removed[y * width + x] === 1;
        // Every backdrop pixel goes; no subject pixel does.
        if (!inSubject) {
          expect(removed, `backdrop (${x}, ${y})`).toBe(true);
          backdrop += 1;
        } else if (studioBackdropColor(x, y) !== "#ECEAE6") {
          expect(removed, `subject (${x}, ${y})`).toBe(false);
        }
      }
    }
    expect(result.count).toBe(backdrop);
    expect(runExtraction(img, settings({ ignoreBackground: "auto" })).background).toBe("found");
  });

  it("the cluster map shares extraction's keep mask, so removed background is unlabeled (spec 2.6)", () => {
    const img = studio();
    const s = settings({ ignoreBackground: "auto" });
    const keep = keepPixels(img, s);
    expect(keep.background).toBe("found");
    const removed = detectBackground(img, { alphaCutoff: s.alphaCutoff }).removed;
    const { colors } = runExtraction(img, s, keep);
    const map = assignPixels(
      img,
      keep.mask,
      colors.map((c) => c.lab),
      s.workingSpace,
    );
    let labeled = 0;
    for (let p = 0; p < map.labels.length; p += 1) {
      if (removed[p] === 1) expect(map.labels[p], `pixel ${p}`).toBe(FILTERED);
      if (map.labels[p] !== FILTERED) labeled += 1;
    }
    expect(labeled).toBe(keep.kept);
    // The share is the plain pixel share of the kept pixels, without spatial weights.
    expect(map.shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });

  it("the enclosed #ECEAE6 patch is kept", () => {
    const result = detectBackground(studio(), { alphaCutoff: 128 });
    const { width, patch } = STUDIO_BACKDROP;
    for (let y = patch.y; y < patch.y + patch.height; y += 1) {
      for (let x = patch.x; x < patch.x + patch.width; x += 1) {
        expect(studioBackdropColor(x, y)).toBe("#ECEAE6");
        expect(result.removed[y * width + x], `patch (${x}, ${y})`).toBe(0);
      }
    }
  });

  it("a border split into 4 colors, none above 50%, detects nothing", () => {
    const quads = ["#14386B", "#E8693A", "#1DB07A", "#ECEAE6"];
    const img = image(40, 40, (x, y) => quads[(y < 20 ? 0 : 2) + (x < 20 ? 0 : 1)] ?? "#000000");
    const result = detectBackground(img, { alphaCutoff: 128 });
    expect(result.found).toBe(false);
    expect(result.color).toBeNull();
    expect(result.count).toBe(0);
    expect(result.removed.every((v) => v === 0)).toBe(true);
    // The pipeline removes nothing and reports that no background was found.
    const s = settings({ ignoreBackground: "auto", algorithm: "exact", colors: 4 });
    const auto = runExtraction(img, s);
    expect(auto.background).toBe("none");
    expect(auto.colors).toEqual(runExtraction(img, { ...s, ignoreBackground: "off" }).colors);
  });

  it("a color must cover at least half of the band", () => {
    // Top and bottom rows of a 10 × 10 image: the band is 36 pixels. 18 #ECEAE6 pixels are
    // exactly half; 17 are not enough.
    const band = (n: number) =>
      image(10, 10, (x, y) => {
        const onBorder = x === 0 || y === 0 || x === 9 || y === 9;
        if (!onBorder) return "#14386B";
        const order = y === 0 ? x : y === 9 ? 10 + x : 20 + (x === 0 ? y - 1 : 8 + y - 1);
        return order < n ? "#ECEAE6" : order % 2 === 0 ? "#E8693A" : "#1DB07A";
      });
    expect(detectBackground(band(18), { alphaCutoff: 128 }).found).toBe(true);
    expect(detectBackground(band(17), { alphaCutoff: 128 }).found).toBe(false);
  });

  it("colors within ΔE OK 0.04 count as one background color", () => {
    // Two near-identical backdrop colors (#ECEAE6 and #E6E4E0, ΔE OK about 0.016), half each.
    expect(deltaEOK(hexToOklab("#ECEAE6"), hexToOklab("#E6E4E0"))).toBeLessThan(0.04);
    const img = image(30, 30, (x, y) => {
      if (x >= 10 && x < 20 && y >= 10 && y < 20) return "#14386B";
      return (x + y) % 2 === 0 ? "#ECEAE6" : "#E6E4E0";
    });
    const result = detectBackground(img, { alphaCutoff: 128 });
    expect(result.found).toBe(true);
    expect(result.count).toBe(800);
  });

  it("transparent pixels are never background, but still count in the band", () => {
    // A transparent border with an opaque subject touching one edge: no color covers half.
    const img = image(20, 20, (x) => (x < 4 ? "#ECEAE6" : ["#000000", 0]));
    const result = detectBackground(img, { alphaCutoff: 128 });
    expect(result.found).toBe(false);
  });

  it("a 1 × 1 image doesn't throw", () => {
    const one = image(1, 1, () => "#ECEAE6");
    expect(() => detectBackground(one, { alphaCutoff: 128 })).not.toThrow();
    expect(() => runExtraction(one, settings({ ignoreBackground: "auto" }))).not.toThrow();
    const empty = { width: 0, height: 0, data: new Uint8ClampedArray(0) };
    expect(() => detectBackground(empty, { alphaCutoff: 128 })).not.toThrow();
  });

  it("removing every pixel gives the 'all-filtered' reason", () => {
    const flat = image(8, 8, () => "#ECEAE6");
    const result = runExtraction(flat, settings({ ignoreBackground: "auto" }));
    expect(result.colors).toEqual([]);
    expect(result.reason).toBe("all-filtered");
    expect(result.background).toBe("found");
  });

  it("off leaves no background status", () => {
    expect(runExtraction(studio(), DEFAULT_SETTINGS).background).toBeUndefined();
  });
});
