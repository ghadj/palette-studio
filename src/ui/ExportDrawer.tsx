/**
 * The export drawer (ui-contract "Export drawer"): two halves split by a vertical divider, each with
 * a strong title and its formats in muted text. Palette and gradient exports stay separate (spec 5).
 */
export function ExportDrawer() {
  return (
    <section class="export-drawer" data-testid="export-drawer" aria-label="Export">
      <div class="export-half">
        <h2 class="export-title">Palette export</h2>
        <span class="export-formats">HEX, CSS</span>
      </div>
      <div class="export-half">
        <h2 class="export-title">Gradient export</h2>
        <span class="export-formats">Coming in a later version</span>
      </div>
    </section>
  );
}
