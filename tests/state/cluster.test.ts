import { batch } from "@preact/signals";
import { beforeEach, describe, expect, it } from "vitest";
import { hexToOklab } from "../../src/color/convert";
import type { ClusterMap } from "../../src/extract/cluster-map";
import { createSwatch } from "../../src/palette/model";
import {
  clusterFocus,
  clusterHover,
  clusterPinned,
  clusterToggle,
  shareText,
  shownCluster,
} from "../../src/state/cluster";
import { clusterMap, palette, selectedSwatchId } from "../../src/state/signals";

const swatches = ["#E8693A", "#1DB07A", "#14386B"].map((hex, i) =>
  createSwatch(hexToOklab(hex), { id: `s${i + 1}`, origin: "extracted" }),
);
const map: ClusterMap = {
  width: 3,
  height: 1,
  labels: Uint8Array.from([0, 1, 2]),
  shares: [0.147, 0.848, 0.005],
};

describe("which cluster map shows (spec 2.6, 6.1 'No hover'; M2 decision 13)", () => {
  beforeEach(() => {
    batch(() => {
      palette.value = swatches;
      clusterMap.value = map;
      selectedSwatchId.value = "s3";
      clusterHover.value = null;
      clusterFocus.value = null;
      clusterPinned.value = null;
      clusterToggle.value = false;
    });
  });

  it("nothing shows until a swatch is hovered, focused, pinned or toggled", () => {
    expect(shownCluster.value).toBeNull();
  });

  it("hover shows the hovered swatch, with its index and share", () => {
    clusterHover.value = "s2";
    expect(shownCluster.value).toMatchObject({ id: "s2", index: 1, share: 0.848, map });
  });

  it("hover wins over focus, focus over the demo pin, the pin over the toggle", () => {
    clusterToggle.value = true;
    expect(shownCluster.value?.id).toBe("s3");
    clusterPinned.value = "s1";
    expect(shownCluster.value?.id).toBe("s1");
    clusterFocus.value = "s2";
    expect(shownCluster.value?.id).toBe("s2");
    clusterHover.value = "s3";
    expect(shownCluster.value?.id).toBe("s3");
  });

  it("the toggle shows the selected swatch and follows the selection", () => {
    clusterToggle.value = true;
    selectedSwatchId.value = "s1";
    expect(shownCluster.value?.index).toBe(0);
    selectedSwatchId.value = null;
    expect(shownCluster.value).toBeNull();
  });

  it("no map, a map for another palette, or a swatch no longer in the palette shows nothing", () => {
    clusterHover.value = "s1";
    clusterMap.value = null;
    expect(shownCluster.value).toBeNull();
    clusterMap.value = { ...map, shares: [0.5, 0.5] };
    expect(shownCluster.value).toBeNull();
    clusterMap.value = map;
    clusterHover.value = "gone";
    expect(shownCluster.value).toBeNull();
  });

  it("the share reads with one decimal and a period as the separator", () => {
    expect(shareText(0.005)).toBe("0.5%");
    expect(shareText(0.832)).toBe("83.2%");
    expect(shareText(1)).toBe("100.0%");
    expect(shareText(0)).toBe("0.0%");
  });
});
