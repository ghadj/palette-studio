/**
 * The surround (spec 6.2): the neutral background behind the gradient preview and the image well,
 * an app setting kept in localStorage like the theme. It is UI, not content: the preview and the
 * image keep their own colors. In the mockup state (?demo=mockup) only the `surround` URL
 * parameter counts and storage is never touched (spec 5.5).
 */
import type { Surround } from "../types";
import { surround } from "./signals";

export const SURROUND_STORAGE_KEY = "palette-studio:surround";

export const SURROUNDS: readonly Surround[] = ["theme", "mid-gray", "white", "black"];

interface StorageReader {
  getItem(key: string): string | null;
}

export interface InitialSurround {
  value: Surround;
  /** False in the mockup state: the value is never read from or written to storage. */
  persist: boolean;
}

function parse(value: string | null): Surround {
  return SURROUNDS.includes(value as Surround) ? (value as Surround) : "theme";
}

export function resolveInitialSurround(
  search: string,
  storage: StorageReader | null,
): InitialSurround {
  const params = new URLSearchParams(search);
  if (params.get("demo") === "mockup") {
    return { value: parse(params.get("surround")), persist: false };
  }
  let stored: string | null = null;
  try {
    stored = storage?.getItem(SURROUND_STORAGE_KEY) ?? null;
  } catch {
    stored = null;
  }
  return { value: parse(stored), persist: true };
}

let persistChoice = false;

/** Reads the initial surround. Call once at startup, before the mockup state is applied. */
export function initSurround(win: Window = window): void {
  const initial = resolveInitialSurround(win.location.search, {
    getItem: (key) => win.localStorage.getItem(key),
  });
  persistChoice = initial.persist;
  surround.value = initial.value;
}

/** Sets the surround at once and saves it outside the mockup state. Not an undo step. */
export function setSurround(value: Surround, win: Window = window): void {
  surround.value = value;
  if (!persistChoice) return;
  try {
    if (value === "theme") win.localStorage.removeItem(SURROUND_STORAGE_KEY);
    else win.localStorage.setItem(SURROUND_STORAGE_KEY, value);
  } catch {
    // Storage can be unavailable. The choice still applies.
  }
}
