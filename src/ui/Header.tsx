/**
 * The header (ui-contract "Header"). Desktop: app name, project name, view tabs, Undo, Redo, Share
 * and the theme button. Phones and tablets: the project name, then icon buttons and the theme button.
 * The library, views, history and sharing arrive later, so those controls show a toast (decision 6).
 */
import { ChevronDown, Redo2, Share, Undo2 } from "lucide-preact";
import { projectName } from "../state/signals";
import { comingSoon } from "./comingSoon";
import type { Layout } from "./Shell";
import { ThemeButton } from "./ThemeButton";

function ProjectButton({ strong }: { strong: boolean }) {
  return (
    <button
      type="button"
      class={strong ? "project-button project-button--strong" : "project-button"}
      onClick={comingSoon}
    >
      <span class="project-button__name">{projectName.value}</span>
      <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
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
          <button type="button" class="view-tab" onClick={comingSoon}>
            Materials
          </button>
        </nav>
        <div class="header__actions">
          <button type="button" class="text-button" onClick={comingSoon}>
            Undo
          </button>
          <button type="button" class="text-button" onClick={comingSoon}>
            Redo
          </button>
          <button type="button" class="text-button" onClick={comingSoon}>
            Share
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
        <button type="button" class="icon-button" aria-label="Undo" onClick={comingSoon}>
          <Undo2 size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <button type="button" class="icon-button" aria-label="Redo" onClick={comingSoon}>
          <Redo2 size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <button type="button" class="icon-button" aria-label="Share" onClick={comingSoon}>
          <Share size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <ThemeButton variant="icon" />
      </div>
    </header>
  );
}
