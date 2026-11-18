/**
 * Toggle (ui-contract Components "Toggle"): a pill track with the control border and a round
 * thumb, with off, on, disabled and focus states. It is a switch button, so a `<label for>` names
 * it, and its hit area is at least 44 px on phones (spec 6.1).
 */
export function Toggle({
  id,
  checked,
  disabled = false,
  label,
  describedBy,
  onChange,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  /** Only when no `<label for>` names the toggle. */
  label?: string;
  describedBy?: string | undefined;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      class="toggle"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span class="toggle__track" aria-hidden="true">
        <span class="toggle__thumb" />
      </span>
    </button>
  );
}
