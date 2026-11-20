/**
 * The responsive shell (spec 6.1, with M1 decision 4 as revised in fix L1):
 * - below 1024 px (phones, tablets and phones in landscape): one panel at a time with a bottom tab
 *   bar, the phone header and safe-area padding; on wide screens the panel is centered at a
 *   readable width. This departs on purpose, by the user's choice, from spec 6.1's two-column row.
 * - 1024 px and up: three equal columns plus the export drawer
 */
import { useLayoutEffect, useRef } from "preact/hooks";
import { activeTab } from "../state/signals";
import type { Tab } from "../types";
import { ExportDrawer } from "./ExportDrawer";
import { GradientPanel, MaterialsPanel } from "./GradientPanel";
import { PalettePanel } from "./PalettePanel";
import { SourcePanel } from "./SourcePanel";
import { panelId, TabBar, tabId } from "./TabBar";

export { type Layout, useLayout } from "./layout";

import type { Layout } from "./layout";

const PHONE_TABS: readonly Tab[] = ["source", "palette", "gradient", "materials"];

function ActivePanel({ tab }: { tab: Tab }) {
  switch (tab) {
    case "source":
      return <SourcePanel variant="phone" />;
    case "palette":
      return <PalettePanel variant="phone" />;
    case "gradient":
      return <GradientPanel variant="phone" />;
    case "materials":
      return <MaterialsPanel />;
  }
}

/**
 * Each phone and tablet tab keeps its own scroll position (M3 decision 44). The window stays the
 * scroll container. The outgoing tab's position is saved while rendering, before the DOM changes;
 * the new tab's is restored in a layout effect, before paint. A tab not visited yet starts at 0.
 */
function usePerTabScroll(tab: Tab, active: boolean): void {
  const saved = useRef(new Map<Tab, number>());
  const current = useRef(tab);
  const pending = useRef(false);
  if (active && current.current !== tab) {
    saved.current.set(current.current, window.scrollY);
    current.current = tab;
    pending.current = true;
  }
  useLayoutEffect(() => {
    if (!active || !pending.current) return;
    pending.current = false;
    const target = saved.current.get(tab) ?? 0;
    window.scrollTo(0, target);
    // Panels fill in over the next frames and the page may be too short at first, which clamps the
    // scroll. Keep restoring for a few frames, until the page reaches it or the user scrolls.
    let frames = 0;
    let frame = 0;
    const stop = () => {
      cancelAnimationFrame(frame);
      for (const type of ["wheel", "touchstart", "keydown", "pointerdown"])
        window.removeEventListener(type, stop, true);
    };
    const retry = () => {
      if (Math.abs(window.scrollY - target) > 0.5) window.scrollTo(0, target);
      if (++frames < 30 && Math.abs(window.scrollY - target) > 0.5)
        frame = requestAnimationFrame(retry);
      else stop();
    };
    if (target > 0) {
      for (const type of ["wheel", "touchstart", "keydown", "pointerdown"])
        window.addEventListener(type, stop, { capture: true, passive: true });
      frame = requestAnimationFrame(retry);
    }
  });
}

export function Shell({ layout }: { layout: Layout }) {
  const tab = activeTab.value;
  usePerTabScroll(tab, layout === "phone");

  if (layout === "desktop") {
    return (
      <main class="shell shell--desktop">
        <div class="columns columns--three">
          <section class="column" data-column="source" aria-label="Source">
            <div class="column__scroll" data-testid="column-scroll">
              <SourcePanel variant="desktop" />
            </div>
          </section>
          <section class="column" data-column="palette" aria-label="Palette">
            <div class="column__scroll" data-testid="column-scroll">
              <PalettePanel variant="desktop" />
            </div>
          </section>
          <section class="column" data-column="gradient" aria-label="Gradient">
            <div class="column__scroll" data-testid="column-scroll">
              <GradientPanel variant="desktop" />
            </div>
          </section>
        </div>
        <ExportDrawer />
      </main>
    );
  }

  return (
    <main class="shell shell--phone">
      <div role="tabpanel" id={panelId(tab)} aria-labelledby={tabId(tab)}>
        <ActivePanel tab={tab} />
      </div>
    </main>
  );
}

export function PhoneTabBar() {
  return <TabBar tabs={PHONE_TABS} selected={activeTab.value} />;
}
