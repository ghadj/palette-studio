/**
 * The Palette column (ui-contract "Column 2: PALETTE"; the phone Palette tab stacks the same
 * controls). M1 has the swatch strip and the selection label; the editor arrives in M3.
 */
import { batch } from "@preact/signals";
import { clusterPinned, clusterToggle } from "../state/cluster";
import { palette } from "../state/signals";
import { CopyButtons } from "./CopyButtons";
import { SettingRow } from "./SettingRow";
import { EmptyRolesNote, SelectionLabel, SwatchStrip } from "./SwatchStrip";
import { Toggle } from "./Toggle";

/**
 * The cluster map's path without hover (spec 6.1 "No hover"): a toggle that shows the selected
 * swatch's map over the image. Temporary on the Palette tab; M3 moves it into the swatch sheet
 * (M2 decision 13d).
 */
function ClusterMapRow() {
  return (
    <div class="setting-rows">
      <SettingRow label="Cluster map" htmlFor="cluster-map-toggle">
        <Toggle
          id="cluster-map-toggle"
          checked={clusterToggle.value}
          onChange={(on) =>
            batch(() => {
              clusterToggle.value = on;
              // The toggle takes over from the mockup state's `cluster` parameter.
              clusterPinned.value = null;
            })
          }
        />
      </SettingRow>
    </div>
  );
}

export function PalettePanel({ variant }: { variant: "desktop" | "phone" }) {
  const empty = palette.value.length === 0;
  return (
    <div class="panel" data-panel="palette">
      {variant === "desktop" && <h2 class="section-label">Palette</h2>}
      <SwatchStrip />
      <SelectionLabel />
      <EmptyRolesNote />
      {variant === "phone" && !empty && <ClusterMapRow />}
      {variant === "phone" && !empty && <CopyButtons />}
      {empty && <p class="hint">Load an image to extract a palette.</p>}
    </div>
  );
}
