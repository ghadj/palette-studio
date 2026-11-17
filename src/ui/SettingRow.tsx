import type { ComponentChildren } from "preact";

/** A muted label on the left and the value on the right, with a divider below (ui-contract Components). */
export function SettingRow({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div class="setting-row">
      <span class="setting-row__label">{label}</span>
      <span class="setting-row__value">{children}</span>
    </div>
  );
}
