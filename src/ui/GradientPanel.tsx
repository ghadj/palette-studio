/** The Gradient column and tab. Gradients arrive in M4; until then a one-line hint (spec 6.3). */
export function GradientPanel({ variant }: { variant: "desktop" | "tablet" | "phone" }) {
  return (
    <div class="panel" data-panel="gradient">
      {variant === "desktop" && <h2 class="section-label">Gradient</h2>}
      <p class="hint">Gradients built from your palette arrive in a later version.</p>
    </div>
  );
}

/** The Materials tab. Paint matching is Part 2 (M7 to M9); until then a one-line hint. */
export function MaterialsPanel() {
  return (
    <div class="panel" data-panel="materials">
      <p class="hint">Matching your palette to real paints arrives in a later version.</p>
    </div>
  );
}
