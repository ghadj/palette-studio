/**
 * Bottom sheet (ui-contract Components "Bottom sheet (phone)"; spec 6.1: below 1024 px the swatch
 * editor, adjustments and ramps open as bottom sheets). `--color-surface` with `--radius-panel` top
 * corners, a grabber, a title and a 44 px close button, over `--color-scrim`.
 *
 * It is a modal `<dialog>`, so the page behind it is inert and focus stays inside. Esc, the close
 * button, a tap on the scrim and a downward swipe on the grabber or title each close it, and focus
 * returns to the control that opened it. The panel pads for the home indicator. Its slide-in uses
 * the motion tokens, which are 0 ms when reduced motion is requested (spec 6.4).
 *
 * Where the page has a pinned swatch strip (the Source and Palette tabs below 1024 px), the sheet
 * and its scrim start under the strip, so the palette stays visible above and updates live while a
 * setting changes (M3 decision 35). The sheet scrolls inside the space left.
 */
import { X } from "lucide-preact";
import type { ComponentChildren } from "preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";
import { dockSheetBelowStrip } from "./sheetDock";

/** A downward swipe this far, in CSS px, closes the sheet; a shorter one springs back. */
export const SWIPE_CLOSE_PX = 64;

export function BottomSheet({
  title,
  onClose,
  children,
  openerId,
  testId,
  action,
}: {
  title: string;
  /** Called once the sheet has closed, however it was closed. */
  onClose: () => void;
  children: ComponentChildren;
  /**
   * The id of the control that opens the sheet, which gets focus back when it closes. Safari
   * doesn't focus a button on click, so the focused element can't stand in for it.
   */
  openerId?: string;
  testId?: string;
  /** An icon button in the title bar, beside Close (M3 decision 48). */
  action?: ComponentChildren;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const close = useRef(onClose);
  close.current = onClose;
  const [drag, setDrag] = useState<{ id: number; startY: number; dy: number } | null>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    // The control that opened the sheet gets focus back when it closes.
    const named = openerId ? document.getElementById(openerId) : null;
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const opener = named ?? active;
    // Esc closes the dialog natively; every way of closing ends here.
    const onDialogClose = () => close.current();
    el.addEventListener("close", onDialogClose);
    // Below the pinned swatch strip, when the page has one (M3 decision 35).
    const undock = dockSheetBelowStrip(el);
    if (!el.open) el.showModal();
    return () => {
      undock();
      el.removeEventListener("close", onDialogClose);
      if (el.open) el.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [openerId]);

  const dismiss = () => dialog.current?.close();

  const onPointerDown = (event: PointerEvent) => {
    if (event.target instanceof Element && event.target.closest("button")) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // Without capture the swipe still works while the pointer stays on the header.
    }
    setDrag({ id: event.pointerId, startY: event.clientY, dy: 0 });
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return;
    setDrag({ ...drag, dy: Math.max(0, event.clientY - drag.startY) });
  };
  const onPointerUp = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return;
    const dy = Math.max(0, event.clientY - drag.startY);
    setDrag(null);
    if (dy >= SWIPE_CLOSE_PX) dismiss();
  };
  const onPointerCancel = () => setDrag(null);

  return (
    <dialog ref={dialog} class="bottom-sheet" aria-labelledby={titleId} data-testid={testId}>
      {/* The scrim is a tap target only; Esc and the close button are its keyboard equivalents. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the scrim mirrors the close button */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Esc closes the sheet from the keyboard */}
      <div class="bottom-sheet__scrim" data-testid="sheet-scrim" onClick={dismiss} />
      <div
        class="bottom-sheet__panel"
        data-dragging={drag ? "" : undefined}
        style={drag && drag.dy > 0 ? { transform: `translateY(${drag.dy}px)` } : undefined}
      >
        <div
          class="bottom-sheet__header"
          data-testid="sheet-handle"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onLostPointerCapture={onPointerCancel}
        >
          <span class="bottom-sheet__grabber" aria-hidden="true" />
          <div class="bottom-sheet__title-row">
            <h2 class="bottom-sheet__title" id={titleId}>
              {title}
            </h2>
            {action}
            <button type="button" class="bottom-sheet__close" aria-label="Close" onClick={dismiss}>
              <X size={20} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div class="bottom-sheet__body">{children}</div>
      </div>
    </dialog>
  );
}
