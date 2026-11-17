import { Contrast, type LucideIcon, Moon, Sun } from "lucide-preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { setThemeChoice, type ThemeChoice, themeChoice } from "../state/theme";

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

export function ThemeButton() {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<Array<HTMLButtonElement | null>>([]);
  const choice = themeChoice.value;
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
        class="icon-pill"
        aria-label={`Theme: ${current?.label ?? "System"}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="theme-menu"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onButtonKeyDown}
      >
        <CurrentIcon size={20} strokeWidth={1.5} aria-hidden="true" />
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
              <option.Icon size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
