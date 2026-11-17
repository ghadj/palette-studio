import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createJobScheduler, DEBOUNCE_MS, PROGRESS_DELAY_MS } from "../../src/state/jobs";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("extraction jobs (spec 7.4, 6.3)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("a result with an older job id is dropped", async () => {
    const pending = [deferred<string>(), deferred<string>()];
    const applied: Array<[string, number]> = [];
    const scheduler = createJobScheduler<string>({
      run: (jobId) => (pending[jobId - 1] as ReturnType<typeof deferred<string>>).promise,
      apply: (result, jobId) => applied.push([result, jobId]),
    });
    scheduler.runNow();
    scheduler.runNow();
    pending[1]?.resolve("second");
    await vi.runAllTimersAsync();
    pending[0]?.resolve("first");
    await vi.runAllTimersAsync();
    expect(applied).toEqual([["second", 2]]);
  });

  it("settings changes within 120 ms post one job", async () => {
    expect(DEBOUNCE_MS).toBe(120);
    const run = vi.fn(async (jobId: number) => jobId);
    const applied: number[] = [];
    const scheduler = createJobScheduler<number>({ run, apply: (r) => applied.push(r) });
    scheduler.request();
    await vi.advanceTimersByTimeAsync(50);
    scheduler.request();
    await vi.advanceTimersByTimeAsync(60);
    scheduler.request();
    await vi.advanceTimersByTimeAsync(119);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.runAllTimersAsync();
    expect(applied).toEqual([1]);
  });

  it("busy stays on until the latest job settles; progress shows only after about 300 ms", async () => {
    expect(PROGRESS_DELAY_MS).toBe(300);
    const busy: boolean[] = [];
    const progress: boolean[] = [];
    const job = deferred<number>();
    const scheduler = createJobScheduler<number>({
      run: () => job.promise,
      apply: () => undefined,
      onBusy: (b) => busy.push(b),
      onProgress: (p) => progress.push(p),
    });
    scheduler.runNow();
    expect(busy).toEqual([true]);
    await vi.advanceTimersByTimeAsync(299);
    expect(progress).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(progress).toEqual([true]);
    job.resolve(1);
    await vi.runAllTimersAsync();
    expect(busy).toEqual([true, false]);
    expect(progress).toEqual([true, false]);
  });

  it("a fast job never shows progress, and a failed job reports its error", async () => {
    const progress: boolean[] = [];
    const errors: unknown[] = [];
    const scheduler = createJobScheduler<number>({
      run: async () => {
        throw new Error("boom");
      },
      apply: () => undefined,
      onProgress: (p) => progress.push(p),
      onError: (e) => errors.push(e),
    });
    scheduler.runNow();
    await vi.runAllTimersAsync();
    expect(progress).toEqual([]);
    expect(errors).toHaveLength(1);
  });
});
