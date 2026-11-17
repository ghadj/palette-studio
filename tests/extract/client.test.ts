import { describe, expect, it } from "vitest";
import { ImageClient, WorkerStoppedError } from "../../src/extract/client";
import type { FromWorker, ToWorker } from "../../src/extract/messages";
import { DEFAULT_SETTINGS } from "../../src/state/defaults";

type Listener = (event: { data?: unknown }) => void;

/** A stand-in Worker that answers hello and prepare, and answers extract only when told to. */
class FakeWorker {
  listeners = new Map<string, Listener[]>();
  received: ToWorker[] = [];
  terminated = false;
  answerExtract = true;

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
          colors: [{ lab: { l: 0.5, a: 0, b: 0 }, population: 1 }],
          ms: 1,
        });
    });
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
      const colors = await client.extract(DEFAULT_SETTINGS);
      expect(colors).toHaveLength(1);
      expect(workers).toHaveLength(2);
      expect(restores()).toBe(1);
      expect((workers[1] as FakeWorker).received.map((m) => m.type)).toEqual([
        "hello",
        "prepare",
        "extract",
      ]);
    });
  }

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
});
