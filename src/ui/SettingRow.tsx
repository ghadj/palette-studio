import type { ComponentChildren } from "preact";

/**
 * A muted label on the left and the value on the right, with a divider below (ui-contract
 * Components "Setting row"). With `htmlFor`, the label names the control on the right. An optional
 * muted note sits under the label; controls refer to it with aria-describedby. With `live`, the
 * note is a status that changes after extraction, such as "None found" (M2 decision 18): its live
 * region stays in the page, empty while there is no note, so the change is announced (spec 6.3).
 * With `disabled`, the row's control doesn't apply: the row carries `data-disabled` and its label
 * and value dim, while the note stays readable (M2 decision 20; M1 decision 14).
 */
export function SettingRow({
  label,
  htmlFor,
  note,
  noteId,
  live = false,
  disabled = false,
  children,
}: {
  label: string;
  htmlFor?: string;
  note?: string | null;
  noteId?: string;
  live?: boolean;
  /** True while the row's control is disabled (M2 decision 20). */
  disabled?: boolean;
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
    <div class="setting-row" data-disabled={disabled ? "" : undefined}>
      {note || live ? (
        <span class="setting-row__label-group">
          {labelEl}
          <span
            class="setting-row__note"
            id={noteId}
            role={live ? "status" : undefined}
            aria-live={live ? "polite" : undefined}
          >
            {note ?? ""}
          </span>
        </span>
      ) : (
        labelEl
      )}
      <span class="setting-row__value">{children}</span>
    </div>
  );
}
