/**
 * Job scheduling for extraction (spec 7.4, 6.3): settings changes are debounced (about 120 ms),
 * every job gets an id and results from older jobs are dropped, and a progress indicator shows only
 * when work takes longer than about 300 ms.
 */
export const DEBOUNCE_MS = 120;
export const PROGRESS_DELAY_MS = 300;

export interface JobSchedulerOptions<T> {
  run: (jobId: number) => Promise<T>;
  apply: (result: T, jobId: number) => void;
  onBusy?: (busy: boolean) => void;
  onProgress?: (visible: boolean) => void;
  onError?: (error: unknown, jobId: number) => void;
}

export interface JobScheduler {
  /** Debounced: runs once the requests stop for DEBOUNCE_MS. */
  request(): void;
  /** Runs at once, superseding anything pending or running. */
  runNow(): void;
}

export function createJobScheduler<T>(options: JobSchedulerOptions<T>): JobScheduler {
  let latest = 0;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let progress: ReturnType<typeof setTimeout> | undefined;
  let busy = false;
  let progressShown = false;

  const setBusy = (value: boolean) => {
    if (busy === value) return;
    busy = value;
    options.onBusy?.(value);
    if (value) {
      progress = setTimeout(() => {
        progressShown = true;
        options.onProgress?.(true);
      }, PROGRESS_DELAY_MS);
    } else {
      clearTimeout(progress);
      if (progressShown) {
        progressShown = false;
        options.onProgress?.(false);
      }
    }
  };

  const start = () => {
    clearTimeout(debounce);
    debounce = undefined;
    latest += 1;
    const jobId = latest;
    setBusy(true);
    options.run(jobId).then(
      (result) => {
        if (jobId !== latest) return;
        options.apply(result, jobId);
        setBusy(false);
      },
      (error: unknown) => {
        if (jobId !== latest) return;
        options.onError?.(error, jobId);
        setBusy(false);
      },
    );
  };

  return {
    request() {
      clearTimeout(debounce);
      debounce = setTimeout(start, DEBOUNCE_MS);
    },
    runNow: start,
  };
}
