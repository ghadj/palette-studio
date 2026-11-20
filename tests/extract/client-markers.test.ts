/**
 * Markers through the client and the worker (spec 3.7, 7.4; plan M3-T10): extraction sends one
 * point per color, and `sample` and `place` answer from the worker's master or from the pixels the
 * main-thread fallback sends. The real worker module runs against a stand-in scope.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { hexToOklab, oklabToHex } from "../../src/color/convert";
import type { ImageClient } from "../../src/extract/client";
import type { FromWorker, ToWorker } from "../../src/extract/messages";
import { CROP_SIZE } from "../../src/image/sample";
import { DEFAULT_SETTINGS } from "../../src/state/defaults";

type Listener = (event: { data: unknown }) => void;

/** A canvas stand-in whose pixels are red on its left half and blue on its right half. */
class HalvesCanvas {
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
      getImageData(x: number, _y: number, w: number, h: number) {
        const data = new Uint8ClampedArray(w * h * 4);
        for (let j = 0; j < h; j += 1) {
          for (let i = 0; i < w; i += 1) {
            const left = x + i < canvas.width / 2;
            data.set(left ? [255, 0, 0, 255] : [0, 0, 255, 255], (j * w + i) * 4);
          }
        }
        return { width: w, height: h, data };
      },
    };
  }
}

/** Connects a client to the real worker module, recording what each side transfers. */
async function connect(mainThread: boolean) {
  vi.resetModules();
  vi.stubGlobal("OffscreenCanvas", HalvesCanvas);
  vi.stubGlobal("createImageBitmap", async (source: { width: number; height: number }) => ({
    width: source.width,
    height: source.height,
    close() {},
  }));
  const toWorker: Listener[] = [];
  const toClient: Listener[] = [];
  const replies: Array<{ message: FromWorker; transfer: Transferable[] }> = [];
  vi.stubGlobal("self", {
    postMessage: (message: FromWorker, transfer: Transferable[] = []) => {
      replies.push({ message, transfer });
      queueMicrotask(() => {
        for (const l of toClient) l({ data: message });
      });
    },
    addEventListener: (_type: string, l: Listener) => toWorker.push(l),
  });
  await import("../../src/extract/worker");
  const worker = {
    addEventListener: (type: string, l: Listener) => {
      if (type === "message") toClient.push(l);
    },
    postMessage: (message: ToWorker) => {
      queueMicrotask(() => {
        for (const l of toWorker) l({ data: message });
      });
    },
    terminate() {},
  };
  const { ImageClient } = await import("../../src/extract/client");
  const client: ImageClient = new ImageClient({
    createWorker: () => worker as unknown as Worker,
    forceMainThread: () => mainThread,
  });
  const bitmap = { width: 400, height: 200, close() {} } as unknown as ImageBitmap;
  await client.prepare(bitmap);
  return { client, replies };
}

describe("markers through the client (plan M3-T10)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("extraction returns one point per color; sample resolves with OKLab and a transferred crop", async () => {
    for (const mainThread of [false, true]) {
      const { client, replies } = await connect(mainThread);

      const extraction = await client.extract({ ...DEFAULT_SETTINGS, colors: 2 });
      expect(extraction.colors).toHaveLength(2);
      expect(extraction.points).toHaveLength(2);
      for (const [i, c] of extraction.colors.entries()) {
        const p = extraction.points?.[i];
        if (!p) throw new Error("no point");
        // Each color's point sits on its own half, inside the image.
        const hex = oklabToHex(c.lab);
        expect(["#FF0000", "#0000FF"]).toContain(hex);
        expect(p.x < 0.5).toBe(hex === "#FF0000");
        expect(p.y).toBeGreaterThan(0);
        expect(p.y).toBeLessThan(1);
      }

      const sample = await client.sample({ x: 0.25, y: 0.5 }, "auto", "mean");
      expect(oklabToHex(sample.color)).toBe("#FF0000");
      expect(sample.color).toEqual({
        l: expect.any(Number),
        a: expect.any(Number),
        b: expect.any(Number),
      });
      expect(sample.crop.width).toBe(CROP_SIZE);
      expect(sample.crop.height).toBe(CROP_SIZE);
      expect(sample.crop.data.length).toBe(CROP_SIZE * CROP_SIZE * 4);
      const sampled = replies.find((r) => r.message.type === "sampled");
      if (sampled?.message.type !== "sampled") throw new Error("no reply");
      expect(sampled.transfer).toContain(sampled.message.crop.data);

      const blue = await client.sample({ x: 0.9, y: 0.1 }, 11, "median");
      expect(oklabToHex(blue.color)).toBe("#0000FF");

      // Place on image: the requested swatches only, in the request's order.
      const colors = ["#FF0000", "#0000FF"].map(hexToOklab);
      const points = await client.place(colors, [1, 0], DEFAULT_SETTINGS);
      expect(points).toHaveLength(2);
      expect(points[0]?.x).toBeGreaterThan(0.5);
      expect(points[1]?.x).toBeLessThan(0.5);
    }
  });
});
