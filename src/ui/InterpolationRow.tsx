/**
 * The Interpolation setting row (ui-contract column 3 item 4): the space the colors mix in. M4-T2
 * shows the current space as text; M4-T9 builds the control (a select of ten spaces) and owns this
 * file.
 */
import { SPACE_LABELS } from "../gradient/labels";
import { gradient } from "../state/signals";
import { SettingRow } from "./SettingRow";

export function InterpolationRow() {
  return (
    <SettingRow label="Interpolation">
      <span data-testid="interpolation-value">{SPACE_LABELS[gradient.value.space]}</span>
    </SettingRow>
  );
}
