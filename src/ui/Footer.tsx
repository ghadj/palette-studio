/**
 * App footer (M1 decision 8): the no-upload statement (spec 7.8), the MIT licence (7.10) and the
 * repository. These are navigation links, not requests, so the no-network rule holds.
 */
export const LICENSE_URL = "https://github.com/ghadj/palette-studio/blob/main/LICENSE";
export const REPO_URL = "https://github.com/ghadj/palette-studio";

export function Footer() {
  return (
    <footer class="footer">
      <p class="footer__statement">Your images never leave this browser. Nothing is uploaded.</p>
      <p class="footer__links">
        <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer">
          MIT License
        </a>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </p>
    </footer>
  );
}
