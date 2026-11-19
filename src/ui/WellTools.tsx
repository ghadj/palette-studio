/**
 * The Markers show/hide toggle (M3-T12) and the Eyedropper toggle (M3-T16). They sit on the left of
 * the toolbar row under the image well (M3 decision 42), so they never cover the image. They belong
 * to the Image view (spec 3.7, 3.8), so they hide in the others.
 */
import { MapPin, Pipette } from "lucide-preact";
import { useEffect } from "preact/hooks";
import { canAdd } from "../palette/model";
import { eyedropperMode, markersVisible, palette, viewSettings } from "../state/signals";
import { EYEDROPPER_NOTE_ID } from "./EyedropperLayer";
import { registerShortcut } from "./shortcuts";

/** Turns the eyedropper on or off (spec 6 "Keyboard": E); it can't turn on at 12 colors. */
function toggleEyedropper(): void {
  if (viewSettings.peek().mode !== "image" || !canAdd(palette.peek())) return;
  eyedropperMode.value = eyedropperMode.peek() === "off" ? "add" : "off";
}

export function WellTools() {
  useEffect(() => registerShortcut("e", toggleEyedropper), []);
  if (viewSettings.value.mode !== "image") return null;
  const picking = eyedropperMode.value !== "off";
  const full = !canAdd(palette.value);
  const on = markersVisible.value;
  return (
    <fieldset class="well-tools" data-testid="well-tools">
      <legend class="visually-hidden">Image tools</legend>
      <button
        type="button"
        class="zoom-button well-tools__button"
        aria-label="Markers"
        aria-pressed={on}
        onClick={() => {
          markersVisible.value = !markersVisible.peek();
        }}
      >
        <MapPin size={20} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <button
        type="button"
        class="zoom-button well-tools__button"
        aria-label="Eyedropper"
        aria-pressed={picking}
        aria-disabled={full || undefined}
        aria-describedby={full ? EYEDROPPER_NOTE_ID : undefined}
        onClick={toggleEyedropper}
      >
        <Pipette size={20} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </fieldset>
  );
}
