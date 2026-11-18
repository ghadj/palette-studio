/**
 * Copy HEX and Copy CSS (spec 5.1 Text and CSS rows, 6.3 "Copy or export done"; M1 decision 7).
 * A copy shows a short toast; a failure says why and offers Download instead.
 */
import { paletteToCss } from "../export/palette-css";
import { paletteToHexText } from "../export/palette-text";
import { palette, projectName } from "../state/signals";
import { showToast } from "./Toast";

type Kind = "hex" | "css";

const FORMATS: Record<
  Kind,
  { label: string; ext: string; type: string; build: typeof paletteToCss }
> = {
  hex: { label: "HEX", ext: "txt", type: "text/plain", build: paletteToHexText },
  css: { label: "CSS", ext: "css", type: "text/css", build: paletteToCss },
};

function reason(error: unknown): string {
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  if (name === "NotAllowedError") return "the browser didn't allow access to the clipboard";
  if (name === "NotSupportedError") return "this browser can't write to the clipboard here";
  return "the clipboard isn't available";
}

function download(text: string, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyPalette(kind: Kind): Promise<void> {
  const format = FORMATS[kind];
  const text = format.build(palette.peek());
  try {
    if (!navigator.clipboard?.writeText)
      throw new DOMException("No clipboard", "NotSupportedError");
    await navigator.clipboard.writeText(text);
    showToast(`Copied ${format.label}`);
  } catch (error) {
    const name = `${projectName.peek()} palette.${format.ext}`;
    showToast(`Couldn't copy the ${format.label}: ${reason(error)}.`, {
      label: "Download",
      run: () => download(text, name, format.type),
    });
  }
}

export function CopyButtons() {
  const empty = palette.value.length === 0;
  return (
    <div class="copy-buttons">
      <button
        type="button"
        class="pill-button"
        disabled={empty}
        onClick={() => void copyPalette("hex")}
      >
        Copy HEX
      </button>
      <button
        type="button"
        class="pill-button"
        disabled={empty}
        onClick={() => void copyPalette("css")}
      >
        Copy CSS
      </button>
    </div>
  );
}
