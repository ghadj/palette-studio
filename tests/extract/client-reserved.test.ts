/**
 * The worker requests M3-T2 reserves for later tasks (plan M3-T2): `sample` and `place` (T10) and
 * `view` (T11). The real worker module runs against a stand-in scope, so each request goes through
 * the client, the message, the worker's handler and the stub module it calls, on both paths: the
 * worker holding the master, and the main-thread fallback sending pixels (spec 7.4).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { hexToOklab } from "../../src/color/convert";
import type { ImageClient } from "../../src/extract/client";
import type { FromWorker, ToWorker } from "../../src/extract/messages";
import { SAMPLE_WINDOW_HALF } from "../../src/image/tiers";
import { DEFAULT_SETTINGS } from "../../src/state/defaults";

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

const COLORS = [hexToOklab("#E8693A"), hexToOklab("#14386B")];

describe("reserved worker requests (plan M3-T2)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("sample, place and view round-trip through the worker and the fallback and reject with 'not built'", async () => {
    for (const mainThread of [false, true]) {
      const { client, received, prepared } = await connect(mainThread);
      expect(prepared.thread).toBe(mainThread ? "main" : "worker");

      await expect(client.sample({ x: 0.5, y: 0.25 }, "auto", "mean")).rejects.toThrow(/not built/);
      await expect(client.place(COLORS, [1], DEFAULT_SETTINGS)).rejects.toThrow(/not built/);
      const view = { mode: "palette", colors: COLORS, bands: 5, dither: false } as const;
      await expect(client.view(view)).rejects.toThrow(/not built/);
      await expect(client.view({ ...view, mode: "values" })).rejects.toThrow(/not built/);

      const byType = (type: ToWorker["type"]) => received.filter((m) => m.type === type);
      const [sample] = byType("sample");
      const [place] = byType("place");
      const views = byType("view");
      if (sample?.type !== "sample" || place?.type !== "place") throw new Error("not sent");
      expect(sample).toMatchObject({ point: { x: 0.5, y: 0.25 }, radius: "auto", stat: "mean" });
      expect(place).toMatchObject({ colors: COLORS, indexes: [1], settings: DEFAULT_SETTINGS });
      expect(views).toHaveLength(2);
      for (const v of views) if (v.type === "view") expect(v.version).toBe(1);

      if (!mainThread) {
        // The worker holds the master, so no pixels travel with the requests.
        expect(sample.window).toBeNull();
        expect(place.pixels).toBeNull();
        for (const v of views) if (v.type === "view") expect(v.pixels).toBeNull();
        continue;
      }
      // Fallback: the master pixels around the point (clamped to the 400 × 200 master), the
      // analysis copy, and the display copy once per image.
      const half = SAMPLE_WINDOW_HALF;
      expect(sample.window).toMatchObject({
        left: 200 - half,
        top: 50 - half,
        width: 2 * half + 1,
        height: 2 * half + 1,
        masterWidth: 400,
        masterHeight: 200,
      });
      expect(sample.window?.data.byteLength).toBe((2 * half + 1) ** 2 * 4);
      expect(place.pixels).toMatchObject({ width: 256, height: 128 });
      const [first, second] = views;
      if (first?.type !== "view" || second?.type !== "view") throw new Error("not sent");
      expect(first.pixels).toMatchObject({ width: 400, height: 200 });
      expect(second.pixels).toBeNull();
    }
  });

  it("a sample window near a corner is clamped to the master", async () => {
    const { client, received } = await connect(true);
    await expect(client.sample({ x: 0, y: 1 }, 11, "median")).rejects.toThrow(/not built/);
    const sample = received.find((m) => m.type === "sample");
    if (sample?.type !== "sample") throw new Error("not sent");
    const half = SAMPLE_WINDOW_HALF;
    expect(sample.window).toMatchObject({
      left: 0,
      top: 199 - half,
      width: half + 1,
      height: half + 1,
    });
  });
});
