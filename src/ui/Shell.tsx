/**
 * The responsive shell (spec 6.1):
 * - phones in portrait, up to 600 px: one panel at a time with a bottom tab bar
 * - 601 to 1023 px, and phones in landscape: two columns, Source beside the active panel (decision 4)
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

export type Layout = "phone" | "tablet" | "desktop";

const PHONE = "(max-width: 600px) and (orientation: portrait)";
const DESKTOP = "(min-width: 1024px)";

function currentLayout(): Layout {
  if (typeof window === "undefined" || !window.matchMedia) return "desktop";
  if (window.matchMedia(DESKTOP).matches) return "desktop";
  if (window.matchMedia(PHONE).matches) return "phone";
  return "tablet";
}

export function useLayout(): Layout {
  const [layout, setLayout] = useState<Layout>(currentLayout);
  useEffect(() => {
    const queries = [window.matchMedia(PHONE), window.matchMedia(DESKTOP)];
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
const TABLET_TABS: readonly Tab[] = ["palette", "gradient", "materials"];

function ActivePanel({ tab, variant }: { tab: Tab; variant: "tablet" | "phone" }) {
  switch (tab) {
    case "source":
      return <SourcePanel variant={variant} />;
    case "palette":
      return <PalettePanel variant={variant} />;
    case "gradient":
      return <GradientPanel variant={variant} />;
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

  if (layout === "tablet") {
    // Source has its own column here, so the right column shows Palette when Source is chosen.
    const right = tab === "source" ? "palette" : tab;
    return (
      <main class="shell shell--tablet">
        <div class="columns columns--two">
          <section class="column" data-column="source" aria-label="Source">
            <SourcePanel variant="tablet" />
          </section>
          <section class="column" data-column="panel" aria-label="Panels">
            <TabBar tabs={TABLET_TABS} selected={right} variant="row" />
            <div role="tabpanel" id={panelId(right)} aria-labelledby={tabId(right)}>
              <ActivePanel tab={right} variant="tablet" />
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
        <ActivePanel tab={tab} variant="phone" />
      </div>
    </main>
  );
}

export function PhoneTabBar() {
  return <TabBar tabs={PHONE_TABS} selected={activeTab.value} variant="bar" />;
}
