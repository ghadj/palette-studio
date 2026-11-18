/*
 * Sets the theme before first paint (spec 6.2). This is an external file because the
 * Content Security Policy forbids inline scripts (spec 7.8). Keep in step with src/state/theme.ts.
 *
 * - Normal pages: a stored "light" or "dark" sets data-theme; anything else follows the device.
 * - ?demo=mockup: only the theme URL parameter counts, and localStorage is never touched (spec 5.5).
 */
(() => {
  const KEY = "palette-studio:theme";
  const SURFACE = { light: "#ffffff", dark: "#171717" };
  let choice = null;
  try {
    const params = new URLSearchParams(location.search);
    const value = params.get("demo") === "mockup" ? params.get("theme") : localStorage.getItem(KEY);
    if (value === "light" || value === "dark") choice = value;
  } catch {
    choice = null;
  }
  if (!choice) return;
  document.documentElement.setAttribute("data-theme", choice);
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  for (let i = 0; i < metas.length; i++) metas[i].setAttribute("content", SURFACE[choice]);
})();
