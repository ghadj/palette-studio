/**
 * The two layouts (spec 6.1, with M1 decision 4 as revised in fix L1): below 1024 px one panel at a
 * time with a bottom tab bar, where secondary tools open as bottom sheets; from 1024 px three
 * columns, where chevron rows expand in place (spec 6.6 rule 2).
 */
import { useEffect, useState } from "preact/hooks";

export type Layout = "phone" | "desktop";

const DESKTOP = "(min-width: 1024px)";

function currentLayout(): Layout {
  if (typeof window === "undefined" || !window.matchMedia) return "desktop";
  return window.matchMedia(DESKTOP).matches ? "desktop" : "phone";
}

const NO_FINE_POINTER = "(hover: none), (pointer: coarse)";

/**
 * True on a device without a fine pointer, at any width (M2 decision 13f), such as an iPad in
 * landscape in the desktop layout: there is no hover, so hover-only paths need a control.
 */
export function useNoFinePointer(): boolean {
  const [touchOnly, setTouchOnly] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.(NO_FINE_POINTER).matches,
  );
  useEffect(() => {
    const query = window.matchMedia(NO_FINE_POINTER);
    const update = () => setTouchOnly(query.matches);
    query.addEventListener("change", update);
    update();
    return () => query.removeEventListener("change", update);
  }, []);
  return touchOnly;
}

export function useLayout(): Layout {
  const [layout, setLayout] = useState<Layout>(currentLayout);
  useEffect(() => {
    const query = window.matchMedia(DESKTOP);
    const update = () => setLayout(currentLayout());
    query.addEventListener("change", update);
    update();
    return () => query.removeEventListener("change", update);
  }, []);
  return layout;
}
