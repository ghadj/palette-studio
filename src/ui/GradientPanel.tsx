/**
 * The Gradient column and tab (ui-contract "Column 3: GRADIENT" and the phone "Gradient tab"; plan
 * M4-T2, Q4). The layout is the same on desktop and phone (spec 6.6 rule 6) and is fixed here:
 * 1. the preview, pinned in `GradientDock` (plan Q2)
 * 2. the type chips
 * 3. the stop bar
 * 4. the inline setting rows: Interpolation, then Technique and its parameter rows
 * 5. the chevron rows: Interpolation options, Stop, Geometry and Preview. They expand in place on
 *    desktop and open bottom sheets, below the dock, on phones.
 *
 * Each piece lives in its own file and owns its own styles in app.css, so the M4 tasks that fill
 * them don't edit this one. With no palette the panel shows a hint (spec 6.3).
 */
import { outputPalette } from "../state/signals";
import { GeometryRow } from "./GeometryPanel";
import { GradientDock } from "./GradientDock";
import { GradientPreview } from "./GradientPreview";
import { GradientTypeChips } from "./GradientTypeChips";
import { InterpolationOptionsRow } from "./InterpolationOptions";
import { InterpolationRow } from "./InterpolationRow";
import { PreviewRow } from "./PreviewPanel";
import { StopBar } from "./StopBar";
import { StopRow } from "./StopDetails";
import { TechniqueRows } from "./TechniqueRows";

export function GradientPanel({ variant }: { variant: "desktop" | "phone" }) {
  const empty = outputPalette.value.length === 0;
  return (
    <div class="panel" data-panel="gradient">
      {variant === "desktop" && <h2 class="section-label">Gradient</h2>}
      {empty ? (
        <p class="hint">Load an image to build a gradient.</p>
      ) : (
        <>
          <GradientDock>
            <GradientPreview />
          </GradientDock>
          <GradientTypeChips />
          <StopBar />
          <div class="setting-rows" data-testid="gradient-rows">
            <InterpolationRow />
            <TechniqueRows />
          </div>
          <div class="chevron-rows" data-testid="gradient-chevron-rows">
            <InterpolationOptionsRow />
            <StopRow />
            <GeometryRow />
            <PreviewRow />
          </div>
        </>
      )}
    </div>
  );
}
