/**
 * The worker request M4-T2 reserves for M4-T5: `ring`, the mean color of an annulus of the master
 * (plan D18). The real worker module runs against a stand-in scope, so the request goes through the
 * client, the message, the worker's handler and the stub `src/image/ring.ts`, on both paths: the
 * worker holding the master, and the main-thread fallback sending pixels (spec 7.4).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ImageClient } from "../../src/extract/client";
import type { FromWorker, ToWorker } from "../../src/extract/messages";

type Listener = (event: { data: unknown }) => void;

/** A canvas stand-in: drawing does nothing and reads give transparent black. */
class FakeCanvas {
  constructor(
    public width: number,
    public height: number,
  ) {}
  getContext() {
    return {
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "low",
      drawImage() {},
      clearRect() {},
      getImageData(_x: number, _y: number, w: number, h: number) {
        return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
      },
    };
  }
}

/** Connects a client to the real worker module, loaded against a stand-in `self`. */
async function connect(mainThread: boolean) {
  vi.resetModules();
  vi.stubGlobal("OffscreenCanvas", FakeCanvas);
  vi.stubGlobal("createImageBitmap", async (source: { width: number; height: number }) => ({
    width: source.width,
    height: source.height,
    close() {},
  }));
  const toWorker: Listener[] = [];
  const toClient: Listener[] = [];
  const received: ToWorker[] = [];
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
    postMessage: (message: ToWorker) => {
      received.push(message);
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
  const prepared = await client.prepare(bitmap);
  return { client, received, prepared };
}

describe("reserved ring request (plan M4-T2)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("ring round-trips through the worker and the fallback and rejects with 'not built'", async () => {
    for (const mainThread of [false, true]) {
      const { client, received, prepared } = await connect(mainThread);
      expect(prepared.thread).toBe(mainThread ? "main" : "worker");
      await expect(client.ring({ x: 0.5, y: 0.5 }, 0.1, 0.3)).rejects.toThrow("not built");
      await expect(client.ring({ x: 0.25, y: 0.75 }, 0, 0.1)).rejects.toThrow("not built");

      const rings = received.filter((m) => m.type === "ring");
      expect(rings).toHaveLength(2);
      const [first, second] = rings;
      if (first?.type !== "ring" || second?.type !== "ring") throw new Error("not sent");
      expect(first).toMatchObject({ center: { x: 0.5, y: 0.5 }, r0: 0.1, r1: 0.3, version: 1 });
      expect(second).toMatchObject({ center: { x: 0.25, y: 0.75 }, r0: 0, r1: 0.1 });
      if (!mainThread) {
        // The worker holds the master, so no pixels travel with the request.
        expect(first.pixels).toBeNull();
        continue;
      }
      // Fallback: the display-size pixels go once per image, and the worker keeps them.
      expect(first.pixels).toMatchObject({ width: 400, height: 200 });
      expect(second.pixels).toBeNull();
    }
  });
});
