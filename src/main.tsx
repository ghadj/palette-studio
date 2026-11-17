import { render } from "preact";
import "./styles/tokens.css";
import "./styles/app.css";
import { initTheme } from "./state/theme";
import { App } from "./ui/App";

initTheme();

const root = document.getElementById("app");
if (root) render(<App />, root);
