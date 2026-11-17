/**
 * Toasts (spec 6.3, ui-contract Components "Toast"): a short message on the inverse surface, with
 * at most one action in the inverse accent, announced through a polite live region that is always
 * in the DOM.
 */
import { signal } from "@preact/signals";

export interface ToastAction {
  label: string;
  run: () => void;
}

interface ToastState {
  id: number;
  text: string;
  action: ToastAction | null;
}

const TOAST_MS = 4000;
const TOAST_WITH_ACTION_MS = 8000;

export const toast = signal<ToastState | null>(null);
let count = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

export function showToast(text: string, action: ToastAction | null = null): void {
  count += 1;
  toast.value = { id: count, text, action };
  if (timer !== undefined) clearTimeout(timer);
  timer = setTimeout(
    () => {
      toast.value = null;
    },
    action ? TOAST_WITH_ACTION_MS : TOAST_MS,
  );
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
          <span>{current.text}</span>
          {current.action && (
            <button
              type="button"
              class="toast__action"
              onClick={() => {
                current.action?.run();
                toast.value = null;
              }}
            >
              {current.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
