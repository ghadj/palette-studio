import { batch } from "@preact/signals";
import { render } from "preact";
import "./styles/tokens.css";
import "./styles/app.css";
import { centered } from "./image/viewport";
import { clusterPinned } from "./state/cluster";
import { startLiveExtraction } from "./state/extraction";
import {
  buildMockupState,
  parseMockupCluster,
  parseMockupParams,
  parseMockupZoom,
} from "./state/mockup";
import { MOCKUP_IMAGE, MOCKUP_IMAGE_PATH } from "./state/mockup-fixture";
import { loadMockupClusterMap } from "./state/mockup-map";
import {
  activeTab,
  activeView,
  demoMode,
  imageSrc,
  imageView,
  initialOpenRows,
  loadProject,
  selectedSwatchId,
} from "./state/signals";
import { initTheme } from "./state/theme";
import { App } from "./ui/App";

initTheme();

// The mockup state loads its fixture directly and never touches storage (mockup-state.md, spec 5.5).
const mockup = parseMockupParams(window.location.search);
if (mockup) {
  const state = buildMockupState(mockup);
  batch(() => {
    demoMode.value = true;
    loadProject(state.project, state.name);
    imageSrc.value = `${import.meta.env.BASE_URL}${MOCKUP_IMAGE_PATH}`;
    selectedSwatchId.value = state.selectedSwatchId;
    activeTab.value = state.activeTab;
    activeView.value = state.activeView;
    imageView.value = centered(parseMockupZoom(window.location.search), { width: 1, height: 1 });
    initialOpenRows.value = state.openRows;
    // `cluster=<n>` shows that swatch's map once the worker has made it (decision 14b).
    const cluster = parseMockupCluster(window.location.search);
    clusterPinned.value = cluster === null ? null : (state.project.palette[cluster]?.id ?? null);
  });
  document.title = `${state.name} · Palette Studio (demo)`;
  // The fixture's cluster map comes from the worker; no extraction runs (spec 2.6).
  void loadMockupClusterMap(`${import.meta.env.BASE_URL}${MOCKUP_IMAGE_PATH}`, MOCKUP_IMAGE.name);
}
startLiveExtraction();

const root = document.getElementById("app");
if (root) render(<App />, root);
