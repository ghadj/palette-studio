import { batch } from "@preact/signals";
import { render } from "preact";
import "./styles/tokens.css";
import "./styles/app.css";
import { centered } from "./image/viewport";
import { clusterPinned } from "./state/cluster";
import { duplicateSelected } from "./state/duplicate-swatch";
import { startLiveExtraction } from "./state/extraction";
import { redo, undo } from "./state/history";
import {
  buildMockupState,
  parseMockupCluster,
  parseMockupGradient,
  parseMockupImage,
  parseMockupLoupe,
  parseMockupParams,
  parseMockupZoom,
} from "./state/mockup";
import { MOCKUP_IMAGE, MOCKUP_IMAGE_PATH } from "./state/mockup-fixture";
import { loadMockupClusterMap } from "./state/mockup-map";
import {
  activeTab,
  activeView,
  demoMode,
  gradientPreview,
  imageSrc,
  imageView,
  initialLoupe,
  initialOpenRows,
  initialThemeMenu,
  loadProject,
  selectedStopId,
  selectedSwatchId,
  surround,
  viewSettings,
} from "./state/signals";
import { initSurround } from "./state/surround";
import { initTheme } from "./state/theme";
import { App } from "./ui/App";
import { installFocusClearance } from "./ui/focusClearance";
import { copySelectedHex } from "./ui/SwatchDetails";
import { registerShortcut } from "./ui/shortcuts";
import { showToast } from "./ui/Toast";

initTheme();
initSurround();
installFocusClearance();

// The mockup state loads its fixture directly and never touches storage (mockup-state.md, spec 5.5).
const mockup = parseMockupParams(window.location.search);
if (mockup) {
  const state = buildMockupState(mockup, parseMockupGradient(window.location.search));
  batch(() => {
    demoMode.value = true;
    loadProject(state.project, state.name);
    imageSrc.value = `${import.meta.env.BASE_URL}${MOCKUP_IMAGE_PATH}`;
    selectedSwatchId.value = state.selectedSwatchId;
    selectedStopId.value = state.selectedStopId;
    activeTab.value = state.activeTab;
    activeView.value = state.activeView;
    imageView.value = centered(parseMockupZoom(window.location.search), { width: 1, height: 1 });
    initialOpenRows.value = state.openRows;
    // The gradient preview options and the surround are view state; `menu=theme` opens the menu.
    gradientPreview.value = state.preview;
    surround.value = state.surround;
    initialThemeMenu.value = state.themeMenuOpen;
    // `image=<view>` and `loupe=<n>` (plan D20). The view is view state, never in undo (3.6).
    viewSettings.value = { ...viewSettings.peek(), mode: parseMockupImage(window.location.search) };
    initialLoupe.value = parseMockupLoupe(window.location.search);
    // `cluster=<n>` shows that swatch's map once the worker has made it (decision 14b).
    const cluster = parseMockupCluster(window.location.search);
    clusterPinned.value = cluster === null ? null : (state.project.palette[cluster]?.id ?? null);
  });
  document.title = `${state.name} · Palette Studio (demo)`;
  // The fixture's cluster map comes from the worker; no extraction runs (spec 2.6).
  void loadMockupClusterMap(`${import.meta.env.BASE_URL}${MOCKUP_IMAGE_PATH}`, MOCKUP_IMAGE.name);
}
startLiveExtraction();
// Undo and redo (spec 3.6, 6 "Keyboard"). In the mockup state history lives in memory only.
registerShortcut("mod+z", undo);
registerShortcut("mod+shift+z", redo);
// C copies the selected swatch's HEX (M3 plan D17).
registerShortcut("c", () => void copySelectedHex());
// D duplicates the selected swatch: the Swatch row has no Duplicate button (decision 39).
registerShortcut("d", () => duplicateSelected(showToast));

const root = document.getElementById("app");
if (root) render(<App />, root);
