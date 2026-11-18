import { batch } from "@preact/signals";
import { render } from "preact";
import "./styles/tokens.css";
import "./styles/app.css";
import { startLiveExtraction } from "./state/extraction";
import { buildMockupState, parseMockupParams } from "./state/mockup";
import { MOCKUP_IMAGE_PATH } from "./state/mockup-fixture";
import {
  activeTab,
  activeView,
  demoMode,
  imageSrc,
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
  });
  document.title = `${state.name} · Palette Studio (demo)`;
}
startLiveExtraction();

const root = document.getElementById("app");
if (root) render(<App />, root);
