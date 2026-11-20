/**
 * The Palette view's legend and the Values view's pair text (spec 3.8, plan M3-T14, ui-contract
 * "Image views"). Shares come from the mockup's expected values (mockup-state.md).
 */
import { describe, expect, it } from "vitest";
import { legendEntries, valuePairText } from "../../src/palette/view-legend";

const MOCKUP = ["#E8693A", "#1DB07A", "#14386B", "#D4527F", "#1E8A2E", "#5039B0"];

describe("legendEntries", () => {
  it("sorts largest first and merges equal small shares into one entry", () => {
    const entries = legendEntries([0.147, 0.832, 0.005, 0.0052, 0.0049, 0.0051], MOCKUP);
    expect(entries.map((e) => e.text)).toEqual(["83.2%", "14.7%", "0.5% each"]);
    expect(entries[0]?.hexes).toEqual(["#1DB07A"]);
    expect(entries[1]?.hexes).toEqual(["#E8693A"]);
    // The merged squares keep palette order.
    expect(entries[2]?.hexes).toEqual(["#14386B", "#D4527F", "#1E8A2E", "#5039B0"]);
  });

  it("keeps different shares apart, and shares of 1% or more are never merged", () => {
    const entries = legendEntries([0.5, 0.25, 0.25], ["#111111", "#222222", "#333333"]);
    expect(entries.map((e) => e.text)).toEqual(["50.0%", "25.0%", "25.0%"]);
    const small = legendEntries([0.9, 0.06, 0.04], ["#111111", "#222222", "#333333"]);
    expect(small.map((e) => e.text)).toEqual(["90.0%", "6.0%", "4.0%"]);
  });

  it("merges small shares only when they are within 0.15 percentage points", () => {
    const entries = legendEntries([0.97, 0.005, 0.008, 0.017], ["#1", "#2", "#3", "#4"]);
    expect(entries.map((e) => e.text)).toEqual(["97.0%", "1.7%", "0.8%", "0.5%"]);
  });

  it("uses a period under any locale", () => {
    expect(legendEntries([1], ["#111111"])[0]?.text).toBe("100.0%");
  });
});

describe("valuePairText", () => {
  it("reads 'Swatch 1 and 2, ΔL 0.004' with a period", () => {
    expect(valuePairText({ first: 0, second: 1, deltaL: 0.0041 })).toBe("Swatch 1 and 2, ΔL 0.004");
  });
});
