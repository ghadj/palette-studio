/**
 * The color editor (ui-contract column 2 items 3 and 4; spec 3.2, 3.5, 6.1): L, C and H sliders
 * with number fields, then the HEX field, the out-of-sRGB indicator and the Lock and Ramp pills.
 * The Ramp pill opens `RampPanel`: in place on desktop, a bottom sheet on phones (spec 6.1;
 * `rows=ramp` opens it).
 *
 * An edit sets the swatch to exactly that color and locks it (M3 decision 1b), like a marker
 * drag; its origin and `extracted` are unchanged. The editor shows the displayed (output) color
 * and the sliders edit one component of it. The color is kept as typed, even beyond sRGB: the
 * HEX shows the clipped value and the indicator says so (spec 3.5).
 *
 * Undo (plan D16): a slider drag is one step (begin on press, end on release); a keyboard step
 * is one step; a text entry in a number field or HEX is one step, committed on Enter or blur.
 */
import { useEffect, useId, useRef, useState } from "preact/hooks";
import { hexToOklch, oklchToHex } from "../color/convert";
import { inGamut } from "../color/gamut";
import { parseHex } from "../color/hex";
import { setLocked, setSwatchColor } from "../palette/model";
import { begin, commit, end } from "../state/history";
import { outputPalette, palette, selectedSwatchId } from "../state/signals";
import type { Oklch } from "../types";
import { RowContent, useRowOpen } from "./ChevronRow";
import { useLayout } from "./layout";
import { RAMP_TITLE, RampPanel } from "./RampPanel";
import { Slider } from "./Slider";

/** The axes: label, name, range, step and shown decimals (spec 3.2; plan T3). */
const AXES = [
  { key: "l", letter: "L", name: "Lightness", min: 0, max: 1, step: 0.001, decimals: 3 },
  { key: "c", letter: "C", name: "Chroma", min: 0, max: 0.4, step: 0.001, decimals: 3 },
  { key: "h", letter: "H", name: "Hue", min: 0, max: 360, step: 1, decimals: 1 },
] as const;

/** True while a text field (not a slider) has focus: its edits commit on Enter or blur. */
function typing(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLInputElement && el.type !== "range";
}

export function SwatchEditor() {
  const [rampOpen, setRampOpen] = useRowOpen("ramp");
  const layout = useLayout();
  const base = useId();
  const rampButton = `${base}-ramp`;
  const rampRegion = `${base}-ramp-region`;
  const root = useRef<HTMLDivElement>(null);
  const pending = useRef<string | null>(null);
  const [hexDraft, setHexDraft] = useState<string | null>(null);

  const id = selectedSwatchId.value;
  const swatch = outputPalette.value.find((s) => s.id === id) ?? null;
  const color = swatch?.color ?? null;
  const hex = color ? oklchToHex(color) : "";

  /** Records the pending step, now or (for a text entry) when the entry ends. */
  const record = (label: string) => {
    if (typing()) pending.current = label;
    else commit(label);
  };
  const flush = () => {
    const label = pending.current;
    pending.current = null;
    if (label !== null) commit(label);
  };

  /** Sets the exact color and locks the swatch (decision 1b). */
  const setColor = (next: Oklch, label: string) => {
    if (id === null) return;
    palette.value = setLocked(setSwatchColor(palette.peek(), id, next), id, true);
    record(label);
  };

  const applyHex = (text: string) => {
    const parsed = parseHex(text);
    if (parsed !== null && parsed !== hex) setColor(hexToOklch(parsed), "HEX");
    setHexDraft(null);
  };

  // A text entry ends on Enter (a change event) or when focus leaves it; native listeners keep the wrapper a plain div.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" && typing()) flush();
    };
    el.addEventListener("focusout", flush);
    el.addEventListener("change", flush);
    el.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("focusout", flush);
      el.removeEventListener("change", flush);
      el.removeEventListener("keydown", onKey);
    };
  });

  return (
    <div class="swatch-editor" data-testid="swatch-editor" ref={root}>
      {AXES.map((axis) => {
        const value = color ? Number(color[axis.key].toFixed(axis.decimals)) : 0;
        const fieldId = `${base}-${axis.key}`;
        return (
          <div class="swatch-editor__axis" key={axis.key}>
            <label class="swatch-editor__letter" for={fieldId}>
              <span aria-hidden="true">{axis.letter}</span>
              <span class="visually-hidden">{axis.name}</span>
            </label>
            <Slider
              id={fieldId}
              label={axis.name}
              value={value}
              min={axis.min}
              max={axis.max}
              step={axis.step}
              decimals={axis.decimals}
              disabled={color === null}
              onChange={(v) => color && setColor({ ...color, [axis.key]: v }, axis.name)}
              onDragStart={begin}
              onDragEnd={() => end()}
            />
          </div>
        );
      })}
      <div class="swatch-editor__row">
        <input
          class="hex-field"
          type="text"
          aria-label="HEX"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellcheck={false}
          maxLength={7}
          disabled={color === null}
          aria-invalid={hexDraft !== null && parseHex(hexDraft) === null ? true : undefined}
          value={hexDraft ?? hex}
          onInput={(event) => setHexDraft(event.currentTarget.value)}
          onChange={(event) => applyHex(event.currentTarget.value)}
          onBlur={() => setHexDraft(null)}
        />
        {color && !inGamut(color) && (
          <span class="gamut-flag" data-testid="gamut-flag">
            <span class="gamut-flag__dot" aria-hidden="true" />
            Out of sRGB
          </span>
        )}
        <button
          type="button"
          class="pill-button"
          aria-pressed={swatch?.locked ?? false}
          disabled={swatch === null}
          onClick={() => {
            if (id === null || !swatch) return;
            palette.value = setLocked(palette.peek(), id, !swatch.locked);
            commit(swatch.locked ? "Unlock" : "Lock");
          }}
        >
          Lock
        </button>
        <button
          id={rampButton}
          type="button"
          class="pill-button"
          aria-expanded={rampOpen}
          aria-controls={layout === "desktop" && rampOpen ? rampRegion : undefined}
          aria-haspopup={layout === "phone" ? "dialog" : undefined}
          onClick={() => setRampOpen(!rampOpen)}
        >
          Ramp
        </button>
      </div>
      <RowContent
        id="ramp"
        title={RAMP_TITLE}
        open={rampOpen}
        onClose={() => setRampOpen(false)}
        regionId={rampRegion}
        labelledBy={rampButton}
      >
        <RampPanel />
      </RowContent>
    </div>
  );
}
