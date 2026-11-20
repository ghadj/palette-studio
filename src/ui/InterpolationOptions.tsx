/**
 * The Interpolation options chevron row (plan Q4): Hue, Easing, Premultiplied and Gamut. M4-T2
 * places the row, with its content stub; M4-T9 builds the content and the header (the count and
 * the reset-all icon, plan D24) and owns this file. The header's accessible description will carry
 * the out-of-sRGB note (plan Risks).
 */
import { ChevronRow } from "./ChevronRow";
import { COMING_SOON } from "./comingSoon";

/** The header's extras: the count badge and the reset-all icon. M4-T9 fills it. */
export function InterpolationOptionsHeader() {
  return null;
}

export function InterpolationOptions() {
  return <p class="hint">{COMING_SOON}</p>;
}

export function InterpolationOptionsRow() {
  return (
    <ChevronRow
      id="interpolation"
      label="Interpolation options"
      summaryExtra={<InterpolationOptionsHeader />}
    >
      <InterpolationOptions />
    </ChevronRow>
  );
}
