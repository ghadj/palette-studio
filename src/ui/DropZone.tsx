/**
 * Getting images in (spec 6 "Input", 6.1, 6.3 "First visit, no image"): a drop zone with Choose
 * image, Paste and three sample images. Drag and drop and paste also work anywhere on the page.
 * The file input has no `capture`, so phones offer Photo Library, Take Photo and Files.
 */
import { signal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { loadImageFile, loadImageFromUrl } from "../state/load-image";
import { imageMessage } from "../state/signals";

export const SAMPLES = [
  { file: "sample-dunes.png", name: "Dunes" },
  { file: "sample-tiles.png", name: "Tiles" },
  { file: "sample-orbits.png", name: "Orbits" },
] as const;

export const sampleUrl = (file: string): string => `${import.meta.env.BASE_URL}samples/${file}`;

const dragging = signal(false);
let input: HTMLInputElement | null = null;

export function openFilePicker(): void {
  input?.click();
}

const isEditable = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target.matches("input, textarea, select"));

const PASTE_HINT = "Press Ctrl+V, or ⌘V on a Mac, to paste an image.";

export async function pasteFromClipboard(): Promise<void> {
  if (!navigator.clipboard?.read) {
    imageMessage.value = { kind: "note", text: PASTE_HINT };
    return;
  }
  try {
    for (const item of await navigator.clipboard.read()) {
      const type = item.types.find((t) => t.startsWith("image/"));
      if (!type) continue;
      const blob = await item.getType(type);
      const ext = type.split("/")[1]?.split("+")[0] ?? "png";
      await loadImageFile(new File([blob], `Pasted image.${ext}`, { type }));
      return;
    }
    imageMessage.value = {
      kind: "note",
      text: "The clipboard has no image. Copy an image, then paste again.",
    };
  } catch {
    imageMessage.value = {
      kind: "note",
      text: `The browser didn't allow reading the clipboard. ${PASTE_HINT}`,
    };
  }
}

/** The hidden file input plus page-wide paste and drag-and-drop. Rendered once, in App. */
export function ImageInputs() {
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (isEditable(event.target)) return;
      const files = Array.from(event.clipboardData?.files ?? []);
      const file = files.find((f) => f.type.startsWith("image/")) ?? files[0];
      if (!file) return;
      event.preventDefault();
      void loadImageFile(file);
    };
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;
    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      dragging.value = true;
    };
    const onDragLeave = (event: DragEvent) => {
      if (event.relatedTarget === null) dragging.value = false;
    };
    const onDrop = (event: DragEvent) => {
      dragging.value = false;
      const file = event.dataTransfer?.files[0];
      if (!file) return;
      event.preventDefault();
      void loadImageFile(file);
    };
    document.addEventListener("paste", onPaste);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("paste", onPaste);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return (
    <input
      ref={(el) => {
        input = el;
      }}
      type="file"
      accept="image/*"
      hidden
      data-testid="file-input"
      onChange={(event) => {
        const target = event.currentTarget;
        const file = target.files?.[0];
        if (file) void loadImageFile(file);
        target.value = "";
      }}
    />
  );
}

/** The first-visit drop zone, shown in the image well until an image is loaded. */
export function DropZone() {
  return (
    <div class="drop-zone" data-testid="drop-zone" data-dragging={dragging.value || undefined}>
      <h2 class="drop-zone__title">Drop an image here</h2>
      <p class="hint">{"JPEG, PNG, WebP, GIF, AVIF or SVG. It stays in this browser."}</p>
      <div class="drop-zone__actions">
        <button type="button" class="primary-button" onClick={openFilePicker}>
          Choose image
        </button>
        <button type="button" class="pill-button" onClick={() => void pasteFromClipboard()}>
          Paste
        </button>
      </div>
      <p class="hint">Or try a sample</p>
      <div class="drop-zone__samples">
        {SAMPLES.map((sample) => (
          <button
            key={sample.file}
            type="button"
            class="sample-button"
            aria-label={`Load the ${sample.name} sample`}
            onClick={() => void loadImageFromUrl(sampleUrl(sample.file), `${sample.name}.png`)}
          >
            <img src={sampleUrl(sample.file)} alt="" width={96} height={64} data-user-content="" />
          </button>
        ))}
      </div>
    </div>
  );
}
