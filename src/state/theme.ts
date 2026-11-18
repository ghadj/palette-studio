/**
 * Theme choice (spec 6.2): System, Light or Dark. The root's `color-scheme: light dark` follows the
 * device with no script; a manual choice sets `data-theme` and is kept in localStorage as an app
 * setting. public/theme-init.js applies the stored choice before first paint; keep the two in step.
 * In the mockup state (?demo=mockup) only the `theme` URL parameter counts and storage is never
 * touched (spec 5.5, mockup-state.md).
 */
import { computed, signal } from "@preact/signals";

export type ThemeChoice = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "palette-studio:theme";

/** Matches --color-surface in tokens.css; used for the theme-color metas (browser chrome). */
export const THEME_SURFACE: Record<ResolvedTheme, string> = { light: "#ffffff", dark: "#171717" };

interface StorageReader {
  getItem(key: string): string | null;
}

export interface InitialTheme {
  choice: ThemeChoice;
  /** False in the mockup state: the choice is never read from or written to storage. */
  persist: boolean;
}

function isDemo(params: URLSearchParams): boolean {
  return params.get("demo") === "mockup";
}

export function resolveInitialTheme(search: string, storage: StorageReader | null): InitialTheme {
  const params = new URLSearchParams(search);
  if (isDemo(params)) {
    const theme = params.get("theme");
    return { choice: theme === "light" || theme === "dark" ? theme : "system", persist: false };
  }
  let stored: string | null = null;
  try {
    stored = storage?.getItem(THEME_STORAGE_KEY) ?? null;
  } catch {
    stored = null;
  }
  const choice: ThemeChoice = stored === "light" || stored === "dark" ? stored : "system";
  return { choice, persist: true };
}

export const themeChoice = signal<ThemeChoice>("system");
export const systemPrefersDark = signal(false);
export const resolvedTheme = computed<ResolvedTheme>(() => {
  const choice = themeChoice.value;
  if (choice !== "system") return choice;
  return systemPrefersDark.value ? "dark" : "light";
});

let persistChoice = false;

function applyToDocument(choice: ThemeChoice, doc: Document): void {
  const root = doc.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
  for (const meta of doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const media = meta.getAttribute("media") ?? "";
    const own: ResolvedTheme = media.includes("dark") ? "dark" : "light";
    meta.setAttribute("content", THEME_SURFACE[choice === "system" ? own : choice]);
  }
}

/** Reads the initial choice and starts following the device setting. Call once at startup. */
export function initTheme(win: Window = window): void {
  const initial = resolveInitialTheme(win.location.search, {
    getItem: (key) => win.localStorage.getItem(key),
  });
  persistChoice = initial.persist;
  themeChoice.value = initial.choice;
  applyToDocument(initial.choice, win.document);

  const query = win.matchMedia("(prefers-color-scheme: dark)");
  systemPrefersDark.value = query.matches;
  query.addEventListener("change", (event) => {
    systemPrefersDark.value = event.matches;
  });
}

/** Sets a manual choice (or System), applies it at once and saves it outside the mockup state. */
export function setThemeChoice(choice: ThemeChoice, win: Window = window): void {
  themeChoice.value = choice;
  applyToDocument(choice, win.document);
  if (!persistChoice) return;
  try {
    if (choice === "system") win.localStorage.removeItem(THEME_STORAGE_KEY);
    else win.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage can be unavailable (private modes, blocked storage). The choice still applies.
  }
}
