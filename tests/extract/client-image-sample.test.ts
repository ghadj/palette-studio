/**
 * Image sample through the client and the worker (spec 3.7, 4.2; plan M4-T5): a line from marker
 * 1's point to marker 2's point, sampled on mockup-scene.png with the Auto radius and the mean.
 * The real worker module runs against a stand-in scope; the canvas stand-in serves the scene.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { oklchToHex } from "../../src/color/convert";
import type { ImageClient } from "../../src/extract/client";
import type { FromWorker, ToWorker } from "../../src/extract/messages";
import { sampleStops, scanPoints } from "../../src/gradient/image-sample";
import { MOCKUP_SWATCHES } from "../../src/state/mockup-fixture";
import { mockupScene } from "./markers-scene";

type Listener = (event: { data: unknown }) => void;

const scene = mockupScene();

/** A canvas stand-in that reads the scene, by nearest pixel, at the canvas's own size. */
class SceneCanvas {
  constructor(
    public width: number,
    public height: number,
  ) {}
  getContext() {
    const canvas = this;
    return {
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "low",
      drawImage() {},
      clearRect() {},
      getImageData(x: number, y: number, w: number, h: number) {
        const data = new Uint8ClampedArray(w * h * 4);
        for (let j = 0; j < h; j += 1) {
          for (let i = 0; i < w; i += 1) {
            const sx = Math.min(
              scene.width - 1,
              Math.floor(((x + i) * scene.width) / canvas.width),
            );
            const sy = Math.min(
              scene.height - 1,
              Math.floor(((y + j) * scene.height) / canvas.height),
            );
            data.set(
              scene.data.subarray((sy * scene.width + sx) * 4, (sy * scene.width + sx) * 4 + 4),
              (j * w + i) * 4,
            );
          }
        }
        return { width: w, height: h, data };
      },
    };
  }
}

async function connect(mainThread: boolean) {
  vi.resetModules();
  vi.stubGlobal("OffscreenCanvas", SceneCanvas);
  vi.stubGlobal("createImageBitmap", async (source: { width: number; height: number }) => ({
    width: source.width,
    height: source.height,
    close() {},
  }));
  const toWorker: Listener[] = [];
  const toClient: Listener[] = [];
  vi.stubGlobal("self", {
    postMessage: (message: FromWorker) =>
      queueMicrotask(() => {
        for (const l of toClient) l({ data: message });
      }),
    addEventListener: (_type: string, l: Listener) => toWorker.push(l),
  });
  await import("../../src/extract/worker");
  const worker = {
    addEventListener: (type: string, l: Listener) => {
      if (type === "message") toClient.push(l);
    },
    postMessage: (message: ToWorker) =>
      queueMicrotask(() => {
        for (const l of toWorker) l({ data: message });
      }),
    terminate() {},
  };
  const { ImageClient } = await import("../../src/extract/client");
  const client: ImageClient = new ImageClient({
    createWorker: () => worker as unknown as Worker,
    forceMainThread: () => mainThread,
  });
  const bitmap = { width: scene.width, height: scene.height, close() {} } as unknown as ImageBitmap;
  await client.prepare(bitmap);
  return client;
}

describe("Image sample through the client (plan M4-T5)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("a line from marker 1's point to marker 2's point, count 2, samples #E8693A and #1DB07A ± 1", async () => {
    for (const mainThread of [false, true]) {
      const client = await connect(mainThread);
      const [m1, m2] = MOCKUP_SWATCHES;
      if (!m1 || !m2) throw new Error("fixture");
      const points = scanPoints("line", 2, { a: m1.point, b: m2.point });
      const colors = await sampleStops(client, points);
      const expected = [m1.hex, m2.hex];
      for (const [i, color] of colors.entries()) {
        const hex = oklchToHex(color);
        for (const c of [1, 3, 5]) {
          const d = Math.abs(
            Number.parseInt(hex.slice(c, c + 2), 16) -
              Number.parseInt((expected[i] ?? "").slice(c, c + 2), 16),
          );
          expect(d, `${hex} vs ${expected[i]}`).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});
