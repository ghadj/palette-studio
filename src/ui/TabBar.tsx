/**
 * Panel tabs (spec 6.1, ui-contract "Phone" and Components "Tab"). On phones a bottom tab bar
 * with Source, Palette, Gradient and Materials, below 1024 px (spec 6.1; decision 4 as revised).
 */
import { useRef } from "preact/hooks";
import { activeTab } from "../state/signals";
import type { Tab } from "../types";

export const TAB_LABELS: Record<Tab, string> = {
  source: "Source",
  palette: "Palette",
  gradient: "Gradient",
  materials: "Materials",
};

interface Props {
  tabs: readonly Tab[];
  selected: Tab;
}

export const tabId = (tab: Tab) => `tab-${tab}`;
export const panelId = (tab: Tab) => `panel-${tab}`;

export function TabBar({ tabs, selected }: Props) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    event.preventDefault();
    const tab = tabs[next];
    if (tab) activeTab.value = tab;
    refs.current[next]?.focus();
  };

  const list = (
    <div class="tabs" role="tablist" aria-label="Panels">
      {tabs.map((tab, i) => (
        <button
          key={tab}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="tab"
          id={tabId(tab)}
          class="tab"
          aria-selected={tab === selected}
          aria-controls={panelId(tab)}
          tabIndex={tab === selected ? 0 : -1}
          onClick={() => {
            activeTab.value = tab;
          }}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          {TAB_LABELS[tab]}
        </button>
      ))}
    </div>
  );

  return (
    <nav class="tabbar" data-testid="tabbar" aria-label="Panels">
      {list}
    </nav>
  );
}
