/**
 * Toasts (spec 6.3, ui-contract Components "Toast"): a short message on the inverse surface,
 * announced through a polite live region that is always in the DOM.
 */
import { signal } from "@preact/signals";

interface ToastState {
  id: number;
  text: string;
}

const TOAST_MS = 4000;

export const toast = signal<ToastState | null>(null);
let count = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

export function showToast(text: string): void {
  count += 1;
  toast.value = { id: count, text };
  if (timer !== undefined) clearTimeout(timer);
  timer = setTimeout(() => {
    toast.value = null;
  }, TOAST_MS);
}

export function Toast() {
  const current = toast.value;
  return (
    <div
      class="toast-region"
      data-testid="toast-region"
      role="status"
      aria-live="polite"
      data-count={current?.id ?? count}
    >
      {current && (
        <div key={current.id} class="toast">
          {current.text}
        </div>
      )}
    </div>
  );
}
