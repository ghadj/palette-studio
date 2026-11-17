import { describe, expect, it } from "vitest";
import {
  analysisSize,
  DISPLAY_MAX,
  defaultSampleSize,
  displaySize,
  MASTER_MAX,
  masterSize,
} from "../../src/image/tiers";

describe("image tiers (spec 7.4, 2.4)", () => {
  it("8064×6048 (48 MP) gives a 4096×3072 master", () => {
    expect(MASTER_MAX).toBe(4096);
    expect(masterSize(8064, 6048)).toEqual({ width: 4096, height: 3072 });
    expect(masterSize(6048, 8064)).toEqual({ width: 3072, height: 4096 });
  });

  it("1600×800 master stays 1600×800", () => {
    expect(masterSize(1600, 800)).toEqual({ width: 1600, height: 800 });
    expect(masterSize(4096, 10)).toEqual({ width: 4096, height: 10 });
    // Never below one pixel.
    expect(masterSize(100000, 1)).toEqual({ width: 4096, height: 1 });
  });

  it("analysis copy of 4096×3072 at 256 is 256×192", () => {
    expect(analysisSize(4096, 3072, 256)).toEqual({ width: 256, height: 192 });
    expect(analysisSize(3072, 4096, 64)).toEqual({ width: 48, height: 64 });
    // Small images are never scaled up.
    expect(analysisSize(40, 40, 256)).toEqual({ width: 40, height: 40 });
  });

  it("'full' uses the master size", () => {
    expect(analysisSize(4096, 3072, "full")).toEqual({ width: 4096, height: 3072 });
  });

  it("default sample size is 256 on every device", () => {
    // M1 decision 5: departs from spec 6.1 "Phone defaults: 128 px", to be revisited.
    expect(defaultSampleSize({ phone: true })).toBe(256);
    expect(defaultSampleSize({ phone: false })).toBe(256);
  });

  it("the display copy is at most 2048 px and never larger than the master", () => {
    expect(DISPLAY_MAX).toBe(2048);
    expect(displaySize(4096, 3072)).toEqual({ width: 2048, height: 1536 });
    expect(displaySize(1600, 800)).toEqual({ width: 1600, height: 800 });
  });
});
