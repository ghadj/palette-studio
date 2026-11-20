/**
 * Keyboard shortcuts (spec 6 "Keyboard"; plan D17): one keydown listener on the document. A
 * shortcut is a key with optional modifiers, written like "mod+shift+z", where "mod" is Ctrl or
 * Cmd. Shortcuts are off while a text field has focus, so typing and the field's own undo work.
 */

type Handler = (event: KeyboardEvent) => void;

const handlers = new Map<string, Handler>();
let listening = false;

/** Input types that take typed text; range, checkbox and the like don't. */
const TEXT_INPUTS = new Set([
  "text",
  "search",
  "email",
  "url",
  "tel",
  "password",
  "number",
  "date",
  "datetime-local",
  "month",
  "time",
  "week",
]);

/** True when the element takes typed text: a text-like input, a textarea or editable content. */
export function isTextField(element: Element | null): boolean {
  if (!element) return false;
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) return TEXT_INPUTS.has(element.type);
  return element instanceof HTMLElement && element.isContentEditable;
}

/** The shortcut an event names, such as "mod+shift+z". */
export function shortcutOf(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push("mod");
  if (event.altKey) parts.push("alt");
  if (event.shiftKey) parts.push("shift");
  parts.push(event.key.toLowerCase());
  return parts.join("+");
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.isComposing) return;
  if (isTextField(document.activeElement)) return;
  const handler = handlers.get(shortcutOf(event));
  if (!handler) return;
  event.preventDefault();
  handler(event);
}

/** Registers a shortcut, such as "mod+z". Returns a function that removes it. */
export function registerShortcut(key: string, handler: Handler): () => void {
  if (!listening) {
    document.addEventListener("keydown", onKeyDown);
    listening = true;
  }
  handlers.set(key, handler);
  return () => {
    if (handlers.get(key) === handler) handlers.delete(key);
  };
}
