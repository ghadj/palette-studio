/**
 * The Technique setting row and its parameter rows (ui-contract column 3 item 4; plan Q1b, D14 to
 * D19): the technique, the Colors row, and each technique's parameters. M4-T2 shows the current
 * technique as text; M4-T11 builds the rows, the Image sample thumbnail and the Custom state, and
 * owns this file.
 */
import { TECHNIQUE_LABELS } from "../gradient/labels";
import { gradient } from "../state/signals";
import { SettingRow } from "./SettingRow";

export function TechniqueRows() {
  const g = gradient.value;
  return (
    <SettingRow label="Technique">
      <span data-testid="technique-value">
        {g.custom ? "Custom" : TECHNIQUE_LABELS[g.technique.kind]}
      </span>
    </SettingRow>
  );
}
