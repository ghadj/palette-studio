/**
 * Toasts (spec 6.3, ui-contract Components "Toast"): a short message on the inverse surface, with
 * at most one action in the inverse accent, announced through a polite live region that is always
 * in the DOM. A plain toast hides itself after a few seconds. A toast with an action stays until
 * it is dismissed, so there is no time limit on reaching the action (WCAG 2.2.1).
 */
import { signal } from "@preact/signals";
import { X } from "lucide-preact";

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

export const toast = signal<ToastState | null>(null);
let count = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

export function dismissToast(): void {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
  toast.value = null;
}

export function showToast(text: string, action: ToastAction | null = null): void {
  count += 1;
  toast.value = { id: count, text, action };
  if (timer !== undefined) clearTimeout(timer);
  timer = action
    ? undefined
    : setTimeout(() => {
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
          <span>{current.text}</span>
          {current.action && (
            <>
              <button
                type="button"
                class="toast__action"
                onClick={() => {
                  current.action?.run();
                  dismissToast();
                }}
              >
                {current.action.label}
              </button>
              <button
                type="button"
                class="toast__close"
                aria-label="Dismiss"
                onClick={dismissToast}
              >
                <X size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
