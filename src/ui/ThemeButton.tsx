import { Contrast, type LucideIcon, Moon, Sun } from "lucide-preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { initialThemeMenu, surround } from "../state/signals";
import { setSurround } from "../state/surround";
import { setThemeChoice, type ThemeChoice, themeChoice } from "../state/theme";
import type { Surround } from "../types";

interface Option {
  value: ThemeChoice;
  label: string;
  Icon: LucideIcon;
}

// Spec 6.2 and ui-contract "Theme button behavior": half-filled circle for System, sun, moon.
const OPTIONS: Option[] = [
  { value: "system", label: "System", Icon: Contrast },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

// Spec 6.2: the surround behind the gradient preview and the image well (plan Q3b).
const SURROUND_OPTIONS: Array<{ value: Surround; label: string }> = [
  { value: "theme", label: "Match theme" },
  { value: "mid-gray", label: "Mid-gray" },
  { value: "white", label: "White" },
  { value: "black", label: "Black" },
];

/** The mockup state's `menu=theme` opens the menu once, so a remount doesn't reopen it. */
let menuConsumed = false;

/** `pill`: the desktop pill with an outline. `icon`: a plain icon button, as in the phone header. */
export function ThemeButton({ variant = "pill" }: { variant?: "pill" | "icon" }) {
  const [open, setOpen] = useState(() => {
    if (menuConsumed || !initialThemeMenu.peek()) return false;
    menuConsumed = true;
    return true;
  });
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<Array<HTMLButtonElement | null>>([]);
  const choice = themeChoice.value;
  const surroundChoice = surround.value;
  const current = OPTIONS.find((o) => o.value === choice) ?? OPTIONS[0];
  const CurrentIcon = current?.Icon ?? Contrast;

  useLayoutEffect(() => {
    if (!open) return;
    const index = Math.max(
      0,
      OPTIONS.findIndex((o) => o.value === themeChoice.peek()),
    );
    items.current[index]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  const chooseSurround = (value: Surround) => {
    setSurround(value);
    close(true);
  };

  const choose = (value: ThemeChoice) => {
    setThemeChoice(value);
    close(true);
  };

  const onMenuKeyDown = (event: KeyboardEvent) => {
    const list = items.current.filter((el): el is HTMLButtonElement => el !== null);
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    const move = (to: number) => list[(to + list.length) % list.length]?.focus();
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(index - 1);
        break;
      case "Home":
        event.preventDefault();
        move(0);
        break;
      case "End":
        event.preventDefault();
        move(list.length - 1);
        break;
      case "Escape":
        event.preventDefault();
        close(true);
        break;
      case "Tab":
        close(false);
        break;
    }
  };

  const onButtonKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
    }
  };

  return (
    <div class="theme-button" ref={wrapper}>
      <button
        ref={button}
        type="button"
        class={variant === "pill" ? "icon-pill" : "icon-button"}
        aria-label={`Theme: ${current?.label ?? "System"}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="theme-menu"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onButtonKeyDown}
      >
        <CurrentIcon size={20} strokeWidth={1.5} class={`icon-${choice}`} aria-hidden="true" />
      </button>
      {open && (
        <div
          id="theme-menu"
          class="menu"
          role="menu"
          aria-label="Theme"
          tabIndex={-1}
          onKeyDown={onMenuKeyDown}
        >
          {/* biome-ignore lint/a11y/useSemanticElements: a fieldset is not allowed inside role="menu" */}
          <div role="group" aria-label="Theme options" class="menu-group">
            {OPTIONS.map((option, i) => (
              <button
                key={option.value}
                ref={(el) => {
                  items.current[i] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={option.value === choice}
                tabIndex={-1}
                class="menu-item"
                onClick={() => choose(option.value)}
              >
                <option.Icon
                  size={16}
                  strokeWidth={1.5}
                  class={`icon-${option.value}`}
                  aria-hidden="true"
                />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
          {/* biome-ignore lint/a11y/useSemanticElements: a fieldset is not allowed inside role="menu" */}
          <div role="group" aria-label="Surround" class="menu-group menu-group--surround">
            <span class="menu-group__label" aria-hidden="true">
              Surround
            </span>
            {SURROUND_OPTIONS.map((option, i) => (
              <button
                key={option.value}
                ref={(el) => {
                  items.current[OPTIONS.length + i] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={option.value === surroundChoice}
                tabIndex={-1}
                class="menu-item"
                onClick={() => chooseSurround(option.value)}
              >
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
