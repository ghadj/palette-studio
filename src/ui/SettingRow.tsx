import type { ComponentChildren } from "preact";

/**
 * A muted label on the left and the value on the right, with a divider below (ui-contract
 * Components "Setting row"). With `htmlFor`, the label names the control on the right. An optional
 * muted note sits under the label; controls refer to it with aria-describedby.
 */
export function SettingRow({
  label,
  htmlFor,
  note,
  noteId,
  children,
}: {
  label: string;
  htmlFor?: string;
  note?: string | null;
  noteId?: string;
  children: ComponentChildren;
}) {
  const labelEl = htmlFor ? (
    <label class="setting-row__label" for={htmlFor}>
      {label}
    </label>
  ) : (
    <span class="setting-row__label">{label}</span>
  );
  return (
    <div class="setting-row">
      {note ? (
        <span class="setting-row__label-group">
          {labelEl}
          <span class="setting-row__note" id={noteId}>
            {note}
          </span>
        </span>
      ) : (
        labelEl
      )}
      <span class="setting-row__value">{children}</span>
    </div>
  );
}
