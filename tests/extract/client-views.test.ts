/**
 * The worker's image-view cache (spec 3.8 "cached per view", plan M3-T11): the real worker module
 * runs against a stand-in scope, and the view functions are wrapped to count how often they run.
 * Both paths are covered: the worker holding the master, and the main-thread fallback (spec 7.4).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { hexToOklab, type Oklab } from "../../src/color/convert";
import type { ImageClient, ViewRequest } from "../../src/extract/client";
import type { FromWorker, ToWorker } from "../../src/extract/messages";

vi.mock("../../src/image/views", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/image/views")>();
  return {
    ...actual,
    paletteView: vi.fn(actual.paletteView),
    valuesView: vi.fn(actual.valuesView),
  };
});

type Listener = (event: { data: unknown }) => void;

/** A canvas stand-in whose reads give opaque pixels: the left half #E8693A, the right #14386B. */
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
        const data = new Uint8ClampedArray(w * h * 4);
        for (let p = 0; p < w * h; p += 1) {
          data.set(p % w < w / 2 ? [0xe8, 0x69, 0x3a, 255] : [0x14, 0x38, 0x6b, 255], p * 4);
        }
        return { width: w, height: h, data };
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
  const views = await import("../../src/image/views");
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
  const load = () =>
    client.prepare({ width: 400, height: 200, close() {} } as unknown as ImageBitmap);
  await load();
  const palette = vi.mocked(views.paletteView);
  const values = vi.mocked(views.valuesView);
  // The mocked module outlives resetModules, so its counts start again here.
  palette.mockClear();
  values.mockClear();
  return { client, received, load, palette, values };
}

const COLORS: Oklab[] = [hexToOklab("#E8693A"), hexToOklab("#14386B")];
const PALETTE: ViewRequest = { mode: "palette", colors: COLORS, bands: 5, dither: false };
const VALUES: ViewRequest = { ...PALETTE, mode: "values" };

describe("image view cache (spec 3.8, plan M3-T11)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("a second request with the same key is served from the cache (no recompute)", async () => {
    for (const mainThread of [false, true]) {
      const { client, palette, values } = await connect(mainThread);
      const first = await client.view(PALETTE);
      const second = await client.view({ ...PALETTE, colors: COLORS.map((c) => ({ ...c })) });
      expect(palette).toHaveBeenCalledTimes(1);
      // Each reply carries its own pixels, so the cached copy survives the transfer.
      expect([first.width, first.height]).toEqual([400, 200]);
      expect(second.data).toEqual(first.data);
      expect(second.data.buffer).not.toBe(first.data.buffer);
      expect(second.shares).toEqual([0.5, 0.5]);

      await client.view(VALUES);
      await client.view(VALUES);
      expect(values).toHaveBeenCalledTimes(1);
      // Switching back to the Palette view doesn't recompute it: each view keeps its own entry.
      await client.view(PALETTE);
      expect(palette).toHaveBeenCalledTimes(1);
    }
  });

  it("a different palette, dither, bands or image recomputes", async () => {
    const { client, load, palette, values } = await connect(false);
    await client.view(PALETTE);
    await client.view({ ...PALETTE, dither: true });
    expect(palette).toHaveBeenCalledTimes(2);
    await client.view({ ...PALETTE, colors: [COLORS[1] as Oklab, COLORS[0] as Oklab] });
    expect(palette).toHaveBeenCalledTimes(3);

    await client.view(VALUES);
    await client.view({ ...VALUES, bands: 3 });
    await client.view({ ...VALUES, bands: "continuous" });
    expect(values).toHaveBeenCalledTimes(3);
    // The Values view doesn't depend on the palette or dither, so they don't recompute it.
    await client.view({ ...VALUES, bands: "continuous", colors: [], dither: true });
    expect(values).toHaveBeenCalledTimes(3);

    await load();
    await client.view({ ...VALUES, bands: "continuous" });
    expect(values).toHaveBeenCalledTimes(4);
  });

  it("the key uses palette hexes: a change below one 8-bit step is served from the cache", async () => {
    const { client, palette } = await connect(false);
    await client.view(PALETTE);
    const nudged = COLORS.map((c) => ({ ...c, l: c.l + 1e-6 }));
    await client.view({ ...PALETTE, colors: nudged });
    expect(palette).toHaveBeenCalledTimes(1);
  });

  it("switching views never extracts", async () => {
    const { client, received } = await connect(false);
    await client.view(PALETTE);
    await client.view(VALUES);
    await client.view(PALETTE);
    expect(received.filter((m) => m.type === "extract" || m.type === "assign")).toEqual([]);
  });
});
