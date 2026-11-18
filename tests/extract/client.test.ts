import { afterEach, describe, expect, it, vi } from "vitest";
import { hexToOklab } from "../../src/color/convert";
import { ImageClient, WorkerStoppedError } from "../../src/extract/client";
import type { ClusterMap } from "../../src/extract/cluster-map";
import type { FromWorker, ToWorker } from "../../src/extract/messages";
import { DEFAULT_SETTINGS } from "../../src/state/defaults";

type Listener = (event: { data?: unknown }) => void;

/** A 2 × 1 map: one pixel per color, or both filtered when there are no colors. */
const fakeMap = (colors: number): ClusterMap => ({
  width: 2,
  height: 1,
  labels: Uint8Array.from(colors > 0 ? [0, Math.min(1, colors - 1)] : [255, 255]),
  shares: colors > 1 ? [0.5, 0.5, ...Array(colors - 2).fill(0)] : colors === 1 ? [1] : [],
});

/** A stand-in Worker that answers hello and prepare, and answers extract only when told to. */
class FakeWorker {
  listeners = new Map<string, Listener[]>();
  received: ToWorker[] = [];
  terminated = false;
  answerExtract = true;
  allFiltered = false;
  /** The maps sent in replies, to check the client hands back the same buffer. */
  maps: ClusterMap[] = [];

  addEventListener(type: string, listener: Listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  emit(type: string, data?: FromWorker) {
    for (const l of this.listeners.get(type) ?? []) l({ data });
  }
  postMessage(message: ToWorker) {
    this.received.push(message);
    queueMicrotask(() => {
      if (message.type === "hello") this.emit("message", { type: "hello", offscreen: true });
      if (message.type === "prepare")
        this.emit("message", {
          type: "prepared",
          jobId: message.jobId,
          display: { close() {} } as unknown as ImageBitmap,
          masterWidth: 4,
          masterHeight: 2,
        });
      if (message.type === "extract" && this.answerExtract)
        this.emit("message", {
          type: "extracted",
          jobId: message.jobId,
          colors: this.allFiltered ? [] : [{ lab: { l: 0.5, a: 0, b: 0 }, population: 1 }],
          reason: this.allFiltered ? "all-filtered" : null,
          map: this.sent(fakeMap(this.allFiltered ? 0 : 1)),
          ms: 1,
        });
      if (message.type === "assign")
        this.emit("message", {
          type: "assigned",
          jobId: message.jobId,
          map: this.sent(fakeMap(message.colors.length)),
        });
    });
  }
  sent(map: ClusterMap): ClusterMap {
    this.maps.push(map);
    return map;
  }
  terminate() {
    this.terminated = true;
  }
}

const bitmap = () => ({ width: 4, height: 2, close() {} }) as unknown as ImageBitmap;

function setup() {
  const workers: FakeWorker[] = [];
  const client = new ImageClient({
    createWorker: () => {
      const w = new FakeWorker();
      workers.push(w);
      return w as unknown as Worker;
    },
    forceMainThread: () => false,
  });
  let restores = 0;
  client.setRestore(async () => {
    restores += 1;
    return bitmap();
  });
  return { client, workers, restores: () => restores };
}

describe("image worker client (spec 7.4; evaluator note 6)", () => {
  for (const failure of ["error", "messageerror"] as const) {
    it(`an uncaught ${failure} rejects pending requests, and the next job recreates the worker`, async () => {
      const { client, workers, restores } = setup();
      await client.prepare(bitmap());
      const first = workers[0] as FakeWorker;
      first.answerExtract = false;
      const pending = client.extract(DEFAULT_SETTINGS);
      await new Promise((r) => setTimeout(r, 0));
      first.emit(failure);
      await expect(pending).rejects.toBeInstanceOf(WorkerStoppedError);
      expect(first.terminated).toBe(true);

      // The next job gets a new worker, which rebuilds the master from the original image.
      const { colors, reason } = await client.extract(DEFAULT_SETTINGS);
      expect(colors).toHaveLength(1);
      expect(reason).toBeNull();
      expect(workers).toHaveLength(2);
      expect(restores()).toBe(1);
      expect((workers[1] as FakeWorker).received.map((m) => m.type)).toEqual([
        "hello",
        "prepare",
        "extract",
      ]);
    });
  }

  it("an all-filtered reply resolves with no colors and the reason (M2-T8)", async () => {
    const { client, workers } = setup();
    await client.prepare(bitmap());
    (workers[0] as FakeWorker).allFiltered = true;
    await expect(client.extract(DEFAULT_SETTINGS)).resolves.toEqual({
      colors: [],
      reason: "all-filtered",
      map: fakeMap(0),
    });
  });

  it("a worker that fails before it says hello rejects, and the next job tries a new one", async () => {
    const workers: FakeWorker[] = [];
    let broken = true;
    const client = new ImageClient({
      createWorker: () => {
        const w = new FakeWorker();
        workers.push(w);
        if (broken) w.postMessage = () => queueMicrotask(() => w.emit("error"));
        return w as unknown as Worker;
      },
      forceMainThread: () => false,
    });
    await expect(client.prepare(bitmap())).rejects.toBeInstanceOf(WorkerStoppedError);
    broken = false;
    await expect(client.prepare(bitmap())).resolves.toMatchObject({ thread: "worker" });
    expect(workers).toHaveLength(2);
  });

  it("assign resolves with the map; the buffer is transferred", async () => {
    const { client, workers } = setup();
    await client.prepare(bitmap());
    const colors = [hexToOklab("#E8693A"), hexToOklab("#14386B")];
    const map = await client.assign(colors, DEFAULT_SETTINGS);
    const worker = workers[0] as FakeWorker;
    expect(worker.received.at(-1)).toMatchObject({
      type: "assign",
      colors,
      settings: DEFAULT_SETTINGS,
      pixels: null,
    });
    // The client hands back the worker's map as is: the labels are not copied.
    expect(map).toBe(worker.maps.at(-1));
    expect(map.shares).toEqual([0.5, 0.5]);
    // An extraction reply carries its map too (spec 2.6).
    const extracted = await client.extract(DEFAULT_SETTINGS);
    expect(extracted.map).toBe(worker.maps.at(-1));
  });

  it("assign after the worker stopped rebuilds the master first, like extract", async () => {
    const { client, workers, restores } = setup();
    await client.prepare(bitmap());
    (workers[0] as FakeWorker).emit("error");
    const map = await client.assign([hexToOklab("#E8693A")], DEFAULT_SETTINGS);
    expect(map.shares).toEqual([1]);
    expect(restores()).toBe(1);
    expect((workers[1] as FakeWorker).received.map((m) => m.type)).toEqual([
      "hello",
      "prepare",
      "assign",
    ]);
  });
});

describe("image worker: assign (spec 2.6, 7.4)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("assign resolves with the map; the buffer is transferred", async () => {
    // Load the real worker module against a stand-in scope and send it an assign request with
    // fallback pixels: #E8693A, #14386B, and one transparent pixel.
    const posted: Array<{ message: FromWorker; transfer: Transferable[] }> = [];
    const listeners: Array<(event: { data: ToWorker }) => void> = [];
    vi.stubGlobal("self", {
      postMessage: (message: FromWorker, transfer: Transferable[] = []) =>
        posted.push({ message, transfer }),
      addEventListener: (_type: string, l: (event: { data: ToWorker }) => void) => {
        listeners.push(l);
      },
    });
    await import("../../src/extract/worker");
    const data = Uint8ClampedArray.from([232, 105, 58, 255, 20, 56, 107, 255, 0, 0, 0, 0]);
    const colors = [hexToOklab("#14386B"), hexToOklab("#E8693A")];
    for (const l of listeners) {
      l({
        data: {
          type: "assign",
          jobId: 7,
          colors,
          settings: DEFAULT_SETTINGS,
          pixels: { width: 3, height: 1, data: data.buffer },
        },
      });
    }
    expect(posted).toHaveLength(1);
    const { message, transfer } = posted[0] as (typeof posted)[number];
    if (message.type !== "assigned") throw new Error(`unexpected ${message.type}`);
    expect(message.jobId).toBe(7);
    expect([...message.map.labels]).toEqual([1, 0, 255]);
    expect(message.map.shares).toEqual([0.5, 0.5]);
    expect([message.map.width, message.map.height]).toEqual([3, 1]);
    expect(transfer).toEqual([message.map.labels.buffer]);
  });
});
