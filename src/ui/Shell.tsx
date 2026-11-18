/**
 * The responsive shell (spec 6.1, with M1 decision 4 as revised in fix L1):
 * - below 1024 px (phones, tablets and phones in landscape): one panel at a time with a bottom tab
 *   bar, the phone header and safe-area padding; on wide screens the panel is centered at a
 *   readable width. This departs on purpose, by the user's choice, from spec 6.1's two-column row.
 * - 1024 px and up: three equal columns plus the export drawer
 */
import { useEffect, useState } from "preact/hooks";
import { activeTab } from "../state/signals";
import type { Tab } from "../types";
import { ExportDrawer } from "./ExportDrawer";
import { GradientPanel, MaterialsPanel } from "./GradientPanel";
import { PalettePanel } from "./PalettePanel";
import { SourcePanel } from "./SourcePanel";
import { panelId, TabBar, tabId } from "./TabBar";

export type Layout = "phone" | "desktop";

const DESKTOP = "(min-width: 1024px)";

function currentLayout(): Layout {
  if (typeof window === "undefined" || !window.matchMedia) return "desktop";
  return window.matchMedia(DESKTOP).matches ? "desktop" : "phone";
}

export function useLayout(): Layout {
  const [layout, setLayout] = useState<Layout>(currentLayout);
  useEffect(() => {
    const queries = [window.matchMedia(DESKTOP)];
    const update = () => setLayout(currentLayout());
    for (const q of queries) q.addEventListener("change", update);
    update();
    return () => {
      for (const q of queries) q.removeEventListener("change", update);
    };
  }, []);
  return layout;
}

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

export function Shell({ layout }: { layout: Layout }) {
  const tab = activeTab.value;

  if (layout === "desktop") {
    return (
      <main class="shell shell--desktop">
        <div class="columns columns--three">
          <section class="column" data-column="source" aria-label="Source">
            <SourcePanel variant="desktop" />
          </section>
          <section class="column" data-column="palette" aria-label="Palette">
            <PalettePanel variant="desktop" />
          </section>
          <section class="column" data-column="gradient" aria-label="Gradient">
            <GradientPanel variant="desktop" />
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
