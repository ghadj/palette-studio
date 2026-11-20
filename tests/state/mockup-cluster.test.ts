import { describe, expect, it } from "vitest";
import { parseMockupCluster } from "../../src/state/mockup";

describe("mockup cluster parameter (mockup-state.md; M2 decision 14b)", () => {
  it("cluster=1 to 6 gives that swatch's index; anything else shows no map", () => {
    for (let n = 1; n <= 6; n += 1) {
      expect(parseMockupCluster(`?demo=mockup&cluster=${n}`)).toBe(n - 1);
    }
    for (const bad of [
      "?demo=mockup",
      "?demo=mockup&cluster=0",
      "?demo=mockup&cluster=7",
      "?demo=mockup&cluster=2.5",
      "?demo=mockup&cluster=x",
    ]) {
      expect(parseMockupCluster(bad)).toBeNull();
    }
  });
});
