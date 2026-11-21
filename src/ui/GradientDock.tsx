/**
 * The gradient preview's pinned container (M4 plan Q2; ui-contract D12). Below 1024 px it pins just
 * under the header, with the preview at most 30% of the screen tall; from 1024 px it pins at the top
 * of column 3's scroll container, as column 2's strip does (M3 decision 45). The container is opaque
 * `--color-surface`, with a `--color-border` divider while pinned. Its height goes to
 * `--dock-height`.
 *
 * `data-dock` is how `sheetDock.ts` and `focusClearance.ts` find a pinned container: every
 * Gradient-tab drawer stops below it, with the `--space-2` gap, and locks the page (M3 decisions 35,
 * 46, 59). `StripDock` carries the same attribute.
 */
import type { ComponentChildren } from "preact";
import { useRef } from "preact/hooks";
import { usePinnedDock } from "./usePinnedDock";

export function GradientDock({ children }: { children: ComponentChildren }) {
  const dock = useRef<HTMLDivElement>(null);
  usePinnedDock(dock, "--dock-height");
  return (
    <div ref={dock} class="gradient-dock" data-dock="" data-testid="gradient-dock">
      {children}
    </div>
  );
}
