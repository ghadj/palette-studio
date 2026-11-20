import { beforeEach, describe, expect, it } from "vitest";
import { hexToOklab, oklchToHex } from "../../src/color/convert";
import type { SamplingClient } from "../../src/gradient/image-sample";
import { createSwatch } from "../../src/palette/model";
import { DEFAULT_ADJUSTMENTS, DEFAULT_GRADIENT } from "../../src/state/defaults";
import { effectiveStops } from "../../src/state/gradient";
import * as history from "../../src/state/history";
import {
  cancelSampling,
  changeTechnique,
  endWhenIdle,
  requestSampling,
  sampling,
  setSamplingClient,
} from "../../src/state/image-sample";
import { adjustments, gradient, imageMeta, masterThread, palette } from "../../src/state/signals";
import type { Technique } from "../../src/types";

const HEXES = ["#E8693A", "#1DB07A", "#14386B", "#D4527F"];
const hexAt = (x: number) => HEXES[Math.round(x * 3) % 4] as string;

/** A client whose reads are released by hand, so tests control the order they land in. */
function manualClient() {
  const waiting: Array<{ resolve: () => void }> = [];
  const client: SamplingClient = {
    sample: (point) =>
      new Promise((resolve) => {
        waiting.push({ resolve: () => resolve({ color: hexToOklab(hexAt(point.x)) }) });
      }),
    ring: async () => hexToOklab("#000000"),
  };
  return { client, waiting };
}

const instant: SamplingClient = {
  sample: async (point) => ({ color: hexToOklab(hexAt(point.x)) }),
  ring: async () => hexToOklab("#FFFFFF"),
};

const sampleTechnique = (patch: Partial<Technique["sample"]> = {}): Technique => ({
  ...DEFAULT_GRADIENT.technique,
  kind: "image-sample",
  sample: { ...DEFAULT_GRADIENT.technique.sample, count: 2, ...patch },
});

const flush = () => new Promise((r) => setTimeout(r, 0));
const sampledHexes = () => gradient.value.technique.sample.colors.map(oklchToHex);

beforeEach(() => {
  cancelSampling();
  palette.value = HEXES.map((hex, i) =>
    createSwatch(hexToOklab(hex), { id: `s${i + 1}`, point: { x: i / 3, y: 0.5 } }),
  );
  adjustments.value = { ...DEFAULT_ADJUSTMENTS };
  gradient.value = { ...DEFAULT_GRADIENT };
  imageMeta.value = null;
  masterThread.value = "main";
  history.clear();
  setSamplingClient(instant);
});

describe("live Image sample (plan M4-T11)", () => {
  it("choosing Image sample scans; the choice and its colors are one undo step", async () => {
    changeTechnique(sampleTechnique(), "Technique");
    // Nothing is committed until the scan lands.
    expect(history.canUndo.value).toBe(false);
    expect(sampling.value).toBe(true);
    await flush();
    expect(sampledHexes().length).toBe(2);
    expect(history.undoLabel.value).toBe("Technique");
    history.undo();
    expect(gradient.value.technique.kind).toBe("smooth-path");
    expect(history.canUndo.value).toBe(false);
  });

  it("the sampled colors become fixed stops", async () => {
    changeTechnique(sampleTechnique(), "Technique");
    await flush();
    expect(effectiveStops.value.map((s) => s.position)).toEqual([0, 1]);
    expect(effectiveStops.value.every((s) => s.color.kind === "value")).toBe(true);
  });

  it("drops a stale result: the older scan lands after the newer one and changes nothing", async () => {
    const { client, waiting } = manualClient();
    setSamplingClient(client);
    changeTechnique(sampleTechnique({ count: 2 }), "Technique");
    await flush();
    const first = waiting.splice(0);
    changeTechnique(sampleTechnique({ count: 3 }), "Sample count");
    for (const w of first) w.resolve();
    await flush();
    expect(gradient.value.technique.sample.colors).toEqual([]);
    // The newer scan reads its points one after the other.
    for (let i = 0; i < 3; i += 1) {
      waiting.shift()?.resolve();
      await flush();
    }
    expect(gradient.value.technique.sample.colors).toHaveLength(3);
    expect(history.undoLabel.value).toBe("Sample count");
  });

  it("cancelling (as undo does) drops a scan under way", async () => {
    const { client, waiting } = manualClient();
    setSamplingClient(client);
    changeTechnique(sampleTechnique(), "Technique");
    await flush();
    cancelSampling();
    for (const w of waiting.splice(0)) w.resolve();
    await flush();
    expect(sampling.value).toBe(false);
    expect(gradient.value.technique.sample.colors).toEqual([]);
  });

  it("marker modes make no scan: the change is one step at once", () => {
    changeTechnique(sampleTechnique({ mode: "markers-x" }), "Sample mode");
    expect(sampling.value).toBe(false);
    expect(history.undoLabel.value).toBe("Sample mode");
    expect(effectiveStops.value.map((s) => s.color.kind)).toEqual([
      "swatch",
      "swatch",
      "swatch",
      "swatch",
    ]);
  });

  it("with no image the choice is committed at once and nothing is scanned", () => {
    masterThread.value = null;
    changeTechnique(sampleTechnique(), "Technique");
    expect(sampling.value).toBe(false);
    expect(history.undoLabel.value).toBe("Technique");
  });

  it("a drag is one step: it ends once the last scan has landed", async () => {
    changeTechnique(sampleTechnique(), "Technique");
    await flush();
    history.begin();
    changeTechnique(
      sampleTechnique({ line: { a: { x: 0, y: 0 }, b: { x: 1, y: 1 } } }),
      "Sample line",
    );
    changeTechnique(
      sampleTechnique({ line: { a: { x: 0, y: 0 }, b: { x: 0.5, y: 1 } } }),
      "Sample line",
    );
    endWhenIdle((label) => history.end(label), "Sample line");
    await flush();
    await flush();
    expect(history.undoLabel.value).toBe("Sample line");
    history.undo();
    expect(history.undoLabel.value).toBe("Technique");
  });

  it("a change that leaves a live technique as it is records nothing", () => {
    changeTechnique({ ...gradient.value.technique, seed: 2 }, "Shuffle");
    expect(history.undoLabel.value).toBe("Shuffle");
    changeTechnique({ ...gradient.value.technique }, "Shuffle");
    history.undo();
    expect(history.canUndo.value).toBe(false);
  });

  it("a scan after a new image, with nothing to undo, is not an undo step", async () => {
    gradient.value = { ...DEFAULT_GRADIENT, technique: sampleTechnique() };
    history.clear();
    requestSampling("Image sample", true);
    await flush();
    expect(sampledHexes()).toHaveLength(2);
    expect(history.canUndo.value).toBe(false);
  });
});
