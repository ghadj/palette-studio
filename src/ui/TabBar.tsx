/**
 * Panel tabs (spec 6.1, ui-contract "Phone" and Components "Tab"). On phones a bottom tab bar
 * with Source, Palette, Gradient and Materials; on tablets a tab row at the top of the right column.
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
  variant: "bar" | "row";
}

export const tabId = (tab: Tab) => `tab-${tab}`;
export const panelId = (tab: Tab) => `panel-${tab}`;

export function TabBar({ tabs, selected, variant }: Props) {
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
    <div class={`tabs tabs--${variant}`} role="tablist" aria-label="Panels">
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

  if (variant === "row") return list;
  return (
    <nav class="tabbar" data-testid="tabbar" aria-label="Panels">
      {list}
    </nav>
  );
}
