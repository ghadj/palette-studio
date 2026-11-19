/**
 * Chevron row (ui-contract Components "Chevron row"; column 2 item 5): a label in text color, a
 * chevron on the right and a divider below. From 1024 px it expands in place; below that it opens
 * its content as a bottom sheet (spec 6.1, 6.6 rule 2). The button carries `aria-expanded`.
 *
 * `useRowOpen` and `RowContent` are the same behavior for other triggers, such as the editor's
 * Ramp pill. A row named in the mockup state's `rows` parameter starts open (plan D20); the
 * parameter is read once per row, so a closed sheet doesn't reopen on the next tab switch.
 */
import { ChevronRight } from "lucide-preact";
import type { ComponentChildren } from "preact";
import { useId, useState } from "preact/hooks";
import { initialOpenRows } from "../state/signals";
import { BottomSheet } from "./BottomSheet";
import { useLayout } from "./layout";

/** Rows the mockup state's `rows` parameter has already opened. */
const consumed = new Set<string>();

/** Open state for a row or panel `id`, which starts open when the mockup state names it. */
export function useRowOpen(id: string): [boolean, (open: boolean) => void] {
  return useState(() => {
    if (consumed.has(id) || !initialOpenRows.peek().includes(id)) return false;
    consumed.add(id);
    return true;
  });
}

/** The content of an open row: in place on desktop, a bottom sheet below 1024 px. */
export function RowContent({
  id,
  title,
  open,
  onClose,
  regionId,
  labelledBy,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onClose: () => void;
  /** The id the trigger's aria-controls names, on desktop. */
  regionId: string;
  /** The trigger's id: it names the region and gets focus back when a sheet closes. */
  labelledBy: string;
  children: ComponentChildren;
}) {
  const layout = useLayout();
  if (!open) return null;
  if (layout === "phone") {
    return (
      <BottomSheet title={title} onClose={onClose} openerId={labelledBy} testId={`sheet-${id}`}>
        {children}
      </BottomSheet>
    );
  }
  return (
    <section
      id={regionId}
      class="chevron-row__content"
      aria-labelledby={labelledBy}
      data-testid={`row-${id}`}
    >
      {children}
    </section>
  );
}

export function ChevronRow({
  id,
  label,
  children,
}: {
  /** Names the row for the mockup state's `rows` parameter and test ids, such as "adjustments". */
  id: string;
  label: string;
  children: ComponentChildren;
}) {
  const [open, setOpen] = useRowOpen(id);
  const layout = useLayout();
  const base = useId();
  const buttonId = `${base}-button`;
  const regionId = `${base}-region`;
  return (
    <div class="chevron-row" data-row={id}>
      <button
        id={buttonId}
        type="button"
        class="chevron-row__summary chevron-row__button"
        aria-expanded={open}
        aria-controls={layout === "desktop" && open ? regionId : undefined}
        aria-haspopup={layout === "phone" ? "dialog" : undefined}
        onClick={() => setOpen(!open)}
      >
        <span>{label}</span>
        <ChevronRight class="chevron-row__chevron" size={16} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <RowContent
        id={id}
        title={label}
        open={open}
        onClose={() => setOpen(false)}
        regionId={regionId}
        labelledBy={buttonId}
      >
        {children}
      </RowContent>
    </div>
  );
}
