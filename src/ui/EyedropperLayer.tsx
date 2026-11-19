/**
 * The eyedropper's layer over the image well (M3-T2 slot; spec 3.2, M3 decisions 5c and D11).
 * While `eyedropperMode` is on, the well's pan and pinch ignore every pointerdown (see
 * `pointerRouting.ts`), so this layer takes them: M3-T16 shows the loupe on press, updates it on
 * move and samples on release. Empty until then.
 */
export function EyedropperLayer() {
  return null;
}
