/**
 * The Swatch row's content (M3 decision 5a): expands in place under the editor on desktop, and is
 * the swatch sheet on phones (spec 6.1). M3-T4 builds it: the format choice with editable fields,
 * Name with its suggestion chip, Copy, Duplicate, Delete, Reset to extracted, Sample radius, Mean
 * or Median, and the Cluster map toggle on desktop too (D21). M3-T13 adds Place on image.
 *
 * Until then it holds the Cluster map toggle under the "coming later" line. It moved here from
 * column 2 and the Palette tab (M2 decision 13d), and it shows wherever hover can't: in the phone
 * layout, and on any device without a fine pointer, such as an iPad in the desktop layout
 * (decision 13f). M3-T4 shows it everywhere (D21).
 */
import { batch } from "@preact/signals";
import { clusterPinned, clusterToggle } from "../state/cluster";
import { COMING_SOON } from "./comingSoon";
import { useLayout, useNoFinePointer } from "./layout";
import { SettingRow } from "./SettingRow";
import { Toggle } from "./Toggle";

/**
 * The cluster map's path without hover (spec 6.1 "No hover"): a toggle that shows the selected
 * swatch's map over the image.
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

export function SwatchDetails() {
  const layout = useLayout();
  const touchOnly = useNoFinePointer();
  return (
    <div class="swatch-details" data-testid="swatch-details">
      <p class="hint panel-stub">{COMING_SOON}</p>
      {(layout === "phone" || touchOnly) && <ClusterMapRow />}
    </div>
  );
}
