/**
 * The header (ui-contract "Header"). Desktop: app name, project name, view tabs, Undo, Redo, Export
 * and the theme button. Below 1024 px: the project name, then icon buttons and the theme button.
 * Undo and Redo work (spec 3.6); the library, views and sharing arrive later, so those controls
 * show a toast (M1 decision 6).
 */
import { ChevronDown, Download, Redo2, Undo2 } from "lucide-preact";
import { canRedo, canUndo, redo, redoLabel, undo, undoLabel } from "../state/history";
import { projectName } from "../state/signals";
import { comingSoon } from "./comingSoon";
import { EXPORT_BUTTON_ID, openExportFromHeader } from "./ExportPanel";
import { ReplaceImageButton } from "./ReplaceImageButton";
import type { Layout } from "./Shell";
import { ThemeButton } from "./ThemeButton";

function ProjectButton({ strong }: { strong: boolean }) {
  return (
    <button
      type="button"
      class={strong ? "project-button project-button--strong" : "project-button"}
      data-coming-soon=""
      onClick={comingSoon}
    >
      <span class="project-button__name">{projectName.value}</span>
      <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
    </button>
  );
}

/**
 * Undo or Redo. With nothing to undo it is aria-disabled, so keyboard focus stays on it. Its
 * accessible name includes the step, such as "Undo Colors".
 */
function HistoryButton({ kind, icon }: { kind: "undo" | "redo"; icon: boolean }) {
  const name = kind === "undo" ? "Undo" : "Redo";
  const enabled = kind === "undo" ? canUndo.value : canRedo.value;
  const step = kind === "undo" ? undoLabel.value : redoLabel.value;
  const run = kind === "undo" ? undo : redo;
  const Icon = kind === "undo" ? Undo2 : Redo2;
  return (
    <button
      type="button"
      class={icon ? "icon-button" : "text-button"}
      aria-label={step ? `${name} ${step}` : icon ? name : undefined}
      aria-disabled={!enabled || undefined}
      onClick={() => enabled && run()}
    >
      {icon ? <Icon size={20} strokeWidth={1.5} aria-hidden="true" /> : name}
    </button>
  );
}

export function Header({ layout }: { layout: Layout }) {
  if (layout === "desktop") {
    return (
      <header class="header header--desktop">
        <div class="header__brand">
          <span class="brand-dot" aria-hidden="true" />
          <h1 class="app-name">Palette Studio</h1>
          <span class="header__slash" aria-hidden="true">
            /
          </span>
          <ProjectButton strong={false} />
        </div>
        <nav class="view-tabs" aria-label="Views">
          <button type="button" class="view-tab" aria-current="page">
            Studio
          </button>
          <button type="button" class="view-tab" data-coming-soon="" onClick={comingSoon}>
            Materials
          </button>
        </nav>
        <div class="header__actions">
          <ReplaceImageButton />
          <HistoryButton kind="undo" icon={false} />
          <HistoryButton kind="redo" icon={false} />
          <button
            type="button"
            id={EXPORT_BUTTON_ID}
            class="text-button"
            aria-haspopup="dialog"
            onClick={() => openExportFromHeader("desktop")}
          >
            Export
          </button>
          <ThemeButton variant="pill" />
        </div>
      </header>
    );
  }
  return (
    <header class="header header--compact">
      <h1 class="visually-hidden">Palette Studio</h1>
      <ProjectButton strong />
      <div class="header__actions header__actions--icons">
        <ReplaceImageButton />
        <HistoryButton kind="undo" icon />
        <HistoryButton kind="redo" icon />
        <button
          type="button"
          id={EXPORT_BUTTON_ID}
          class="icon-button"
          aria-label="Export"
          aria-haspopup="dialog"
          onClick={() => openExportFromHeader("phone")}
        >
          <Download size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <ThemeButton variant="icon" />
      </div>
    </header>
  );
}
