/**
 * Replace image (M1 decision 12): once an image is loaded, an icon button in the header opens the
 * same choices as the drop zone (Choose image, Paste and the three samples) in a menu styled like
 * the theme menu. Hidden on the empty screen, where the drop zone itself offers these choices.
 */
import { ImageIcon } from "lucide-preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { loadImageFromUrl } from "../state/load-image";
import { displayImage, imageSrc } from "../state/signals";
import { openFilePicker, pasteFromClipboard, SAMPLES, sampleUrl } from "./DropZone";

export function ReplaceImageButton() {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<Array<HTMLButtonElement | null>>([]);

  useLayoutEffect(() => {
    if (!open) return;
    items.current[0]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  if (!displayImage.value && !imageSrc.value) return null;

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  const choose = (action: () => void) => {
    close(true);
    action();
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

  const entries: Array<{ key: string; label: string; thumb?: string; run: () => void }> = [
    { key: "choose", label: "Choose image", run: openFilePicker },
    { key: "paste", label: "Paste", run: () => void pasteFromClipboard() },
    ...SAMPLES.map((s) => ({
      key: s.file,
      label: `${s.name} sample`,
      thumb: sampleUrl(s.file),
      run: () => void loadImageFromUrl(sampleUrl(s.file), `${s.name}.png`),
    })),
  ];

  return (
    <div class="menu-anchor" ref={wrapper}>
      <button
        ref={button}
        type="button"
        class="icon-button"
        aria-label="Replace image"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="replace-image-menu"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <ImageIcon size={20} strokeWidth={1.5} aria-hidden="true" />
      </button>
      {open && (
        <div
          id="replace-image-menu"
          class="menu"
          role="menu"
          aria-label="Replace image"
          tabIndex={-1}
          onKeyDown={onMenuKeyDown}
        >
          {entries.map((entry, i) => (
            <button
              key={entry.key}
              ref={(el) => {
                items.current[i] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              class="menu-item"
              onClick={() => choose(entry.run)}
            >
              {entry.thumb && (
                <img
                  class="menu-item__thumb"
                  src={entry.thumb}
                  alt=""
                  width={36}
                  height={24}
                  data-user-content=""
                />
              )}
              <span>{entry.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
