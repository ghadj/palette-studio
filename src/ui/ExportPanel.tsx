/**
 * The central Export panel (M3 decision 56; ui-contract D10). One header button opens it: from
 * 1024 px a right-side drawer under the header that overlays column 3 without moving the columns;
 * below that a bottom sheet. Sections: Palette, Gradient, Image and Project. Palette holds the
 * palette-wide Copy HEX and Copy CSS; the others are marked coming soon until M4 and M5.
 * It opens on the section that fits where the user is, and remembers the last one for the session.
 */
import { X } from "lucide-preact";
import { useEffect, useId, useRef } from "preact/hooks";
import {
  EXPORT_SECTIONS,
  type ExportSection,
  exportOpen,
  exportSection,
} from "../state/export-panel";
import { activeTab, viewSettings } from "../state/signals";
import { BottomSheet } from "./BottomSheet";
import { CopyButtons } from "./CopyButtons";
import { COMING_SOON } from "./comingSoon";
import type { Layout } from "./layout";
import { Toast } from "./Toast";

export const EXPORT_BUTTON_ID = "export-button";

const LABELS: Record<ExportSection, string> = {
  palette: "Palette",
  gradient: "Gradient",
  image: "Image",
  project: "Project",
};

let lastColumn: string | null = null;
if (typeof document !== "undefined") {
  document.addEventListener(
    "focusin",
    (event) => {
      const column = event.target instanceof Element ? event.target.closest("[data-column]") : null;
      if (column) lastColumn = column.getAttribute("data-column");
      else if (!(event.target instanceof Element && event.target.closest("header")))
        lastColumn = null;
    },
    true,
  );
}

/** The section to open on, from where the user is (decision 56); null keeps the last one. */
export function contextSection(layout: Layout): ExportSection | null {
  const mode = viewSettings.peek().mode;
  const viewed = mode === "palette" || mode === "values";
  if (layout === "phone") {
    if (activeTab.peek() === "palette") return "palette";
    if (activeTab.peek() === "source" && viewed) return "image";
    return null;
  }
  if (lastColumn === "palette") return "palette";
  if (lastColumn === "source" && viewed) return "image";
  return null;
}

/** Called by the header button: picks the section, then opens. */
export function openExportFromHeader(layout: Layout): void {
  const section = contextSection(layout);
  if (section) exportSection.value = section;
  exportOpen.value = true;
}

function Sections() {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const base = useId();
  const selected = exportSection.value;
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    let next = -1;
    const n = EXPORT_SECTIONS.length;
    if (event.key === "ArrowRight") next = (index + 1) % n;
    else if (event.key === "ArrowLeft") next = (index - 1 + n) % n;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = n - 1;
    if (next < 0) return;
    event.preventDefault();
    const section = EXPORT_SECTIONS[next];
    if (section) exportSection.value = section;
    refs.current[next]?.focus();
  };
  return (
    <>
      <div class="export-tabs" role="tablist" aria-label="Export sections">
        {EXPORT_SECTIONS.map((section, i) => (
          <button
            key={section}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${section}`}
            class="export-tab"
            aria-selected={section === selected}
            aria-controls={`${base}-panel`}
            tabIndex={section === selected ? 0 : -1}
            onClick={() => {
              exportSection.value = section;
            }}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {LABELS[section]}
          </button>
        ))}
      </div>
      <div
        class="export-section"
        role="tabpanel"
        id={`${base}-panel`}
        aria-labelledby={`${base}-tab-${selected}`}
        data-testid={`export-${selected}`}
      >
        <SectionBody section={selected} />
      </div>
      {/* The page behind a modal dialog is inert, so the toast (with its Download action) lives
          inside the dialog while the panel is open; App leaves its own out meanwhile. */}
      <Toast />
    </>
  );
}

function Soon({ label, detail }: { label: string; detail?: string }) {
  return (
    <div class="export-item" data-coming-soon="" data-testid="export-soon">
      <strong class="export-item__title">{label}</strong>
      {detail && <span class="export-item__detail">{detail}</span>}
      <span class="export-item__detail">{COMING_SOON}</span>
    </div>
  );
}

function SectionBody({ section }: { section: ExportSection }) {
  switch (section) {
    case "palette":
      return (
        <>
          <CopyButtons />
          <p class="export-note">More palette formats arrive in a later version.</p>
        </>
      );
    case "gradient":
      return <Soon label="Gradient formats" detail="CSS, SVG and more." />;
    case "image":
      return (
        <Soon
          label="Source image"
          detail="The image, its Palette view or its Values view, with or without the grid, as PNG or PDF."
        />
      );
    case "project":
      return (
        <>
          <Soon label="Project file" />
          <Soon label="Share link" />
        </>
      );
  }
}

/** The desktop drawer: a modal dialog, so focus stays inside, Esc closes, and the page is inert. */
function Drawer({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const opener = document.getElementById(EXPORT_BUTTON_ID);
    const onDialogClose = () => close.current();
    el.addEventListener("close", onDialogClose);
    if (!el.open) el.showModal();
    el.querySelector<HTMLElement>(".export-drawer__close")?.focus({ preventScroll: true });
    return () => {
      el.removeEventListener("close", onDialogClose);
      if (el.open) el.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  // Tab wraps inside the drawer; some browsers would otherwise leave for their own chrome.
  const trapTab = (event: KeyboardEvent) => {
    if (event.key !== "Tab" || !dialog.current) return;
    const items = [
      ...dialog.current.querySelectorAll<HTMLElement>("button:not([disabled]), [tabindex='0']"),
    ].filter((el) => el.tabIndex >= 0);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  return (
    <dialog
      ref={dialog}
      class="export-dialog"
      aria-labelledby={titleId}
      data-testid="export-panel"
      onKeyDown={trapTab}
    >
      {/* The area outside the drawer closes it; Esc and the close button are the keyboard routes. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: mirrors the close button */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Esc closes the drawer from the keyboard */}
      <div class="export-dialog__scrim" onClick={() => dialog.current?.close()} />
      <div class="export-drawer__panel">
        <div class="export-drawer__head">
          <h2 class="export-drawer__title" id={titleId}>
            Export
          </h2>
          <button
            type="button"
            class="export-drawer__close"
            aria-label="Close"
            onClick={() => dialog.current?.close()}
          >
            <X size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        <Sections />
      </div>
    </dialog>
  );
}

export function ExportPanel({ layout }: { layout: Layout }) {
  if (!exportOpen.value) return null;
  const close = () => {
    exportOpen.value = false;
  };
  if (layout === "desktop") return <Drawer onClose={close} />;
  return (
    <BottomSheet
      title="Export"
      onClose={close}
      openerId={EXPORT_BUTTON_ID}
      testId="export-panel"
      dock={false}
    >
      <Sections />
    </BottomSheet>
  );
}
