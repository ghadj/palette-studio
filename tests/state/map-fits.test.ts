import { describe, expect, it } from "vitest";
import { hexToOklab, hexToOklch } from "../../src/color/convert";
import type { ClusterMap } from "../../src/extract/cluster-map";
import { createSwatch, moveSwatch, setSwatchColor } from "../../src/palette/model";
import { adoptClusterMap, mapFits } from "../../src/state/extraction";
import { clusterMap } from "../../src/state/signals";
import type { Swatch } from "../../src/types";

const make = (hex: string, i: number): Swatch => {
  const s = createSwatch(hexToOklab(hex), { id: `s${i}`, origin: "extracted" });
  return { ...s, extracted: { color: s.color, point: s.point } };
};
const list = ["#E8693A", "#1DB07A", "#14386B"].map(make);
const map: ClusterMap = {
  width: 3,
  height: 1,
  labels: Uint8Array.from([0, 1, 2]),
  shares: [0.3, 0.3, 0.4],
};

describe("a cluster map fits only the palette it was made for (spec 2.6)", () => {
  it("fits the extracted palette and nothing else", () => {
    adoptClusterMap(list, map);
    expect(clusterMap.value).toBe(map);
    expect(mapFits(map, list)).toBe(true);
    // A manual edit, a reorder and a removal each break it.
    const id = list[1]?.id ?? "";
    expect(mapFits(map, setSwatchColor(list, id, hexToOklch("#123456")))).toBe(false);
    expect(mapFits(map, moveSwatch(list, 0, 1))).toBe(false);
    expect(mapFits(map, list.slice(1))).toBe(false);
  });

  it("does not fit a map nobody registered", () => {
    const other: ClusterMap = { ...map };
    expect(mapFits(other, list)).toBe(false);
  });
});
