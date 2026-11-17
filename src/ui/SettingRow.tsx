import type { ComponentChildren } from "preact";

/**
 * A muted label on the left and the value on the right, with a divider below (ui-contract
 * Components "Setting row"). With `htmlFor`, the label names the control on the right.
 */
export function SettingRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ComponentChildren;
}) {
  return (
    <div class="setting-row">
      {htmlFor ? (
        <label class="setting-row__label" for={htmlFor}>
          {label}
        </label>
      ) : (
        <span class="setting-row__label">{label}</span>
      )}
      <span class="setting-row__value">{children}</span>
    </div>
  );
}
