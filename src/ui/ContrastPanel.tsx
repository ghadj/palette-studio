/**
 * The Contrast row's content (spec 3.5; M3 decision 6c): in place on desktop, a bottom sheet on
 * phones. The swatch × swatch WCAG 2.x matrix with a ratio and a text badge in each cell. The very close
 * swatches are marked on the strip, not listed (M3 decision 52). Swatch × theme colors is out of scope. Reads the adjusted palette, so it updates
 * live as a swatch is edited (spec 3.7).
 */
import { badge, contrastRatio } from "../color/contrast";
import { swatchHex } from "../palette/model";
import { outputPalette } from "../state/signals";

export function ContrastPanel() {
  const swatches = outputPalette.value;
  if (swatches.length === 0) {
    return (
      <div class="contrast-panel" data-testid="contrast-panel">
        <p class="hint">No swatches yet.</p>
      </div>
    );
  }
  const hexes = swatches.map(swatchHex);
  return (
    <div class="contrast-panel" data-testid="contrast-panel">
      <section
        class="contrast-scroll"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard reachable
        tabIndex={0}
        aria-label="Contrast between swatches, scrolls sideways"
      >
        <table class="contrast-matrix" data-testid="contrast-matrix">
          <caption class="visually-hidden">
            WCAG contrast ratio of each swatch (row) against each swatch (column)
          </caption>
          <thead>
            <tr>
              <td />
              {hexes.map((hex, col) => (
                <th scope="col" key={swatches[col]?.id ?? col}>
                  <span class="contrast-head">
                    <span
                      class="contrast-head__chip"
                      data-user-content
                      style={{ background: hex }}
                    />
                    {col + 1}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hexes.map((rowHex, row) => (
              <tr key={swatches[row]?.id ?? row}>
                <th scope="row">
                  <span class="contrast-head">
                    <span
                      class="contrast-head__chip"
                      data-user-content
                      style={{ background: rowHex }}
                    />
                    {row + 1}
                  </span>
                </th>
                {hexes.map((colHex, col) => {
                  const ratio = contrastRatio(rowHex, colHex);
                  return (
                    <td key={swatches[col]?.id ?? col} data-testid="contrast-cell">
                      <span
                        class="contrast-sample"
                        data-user-content
                        data-testid="contrast-sample"
                        style={{ background: rowHex }}
                      >
                        <span class="contrast-sample__ink" style={{ background: colHex }} />
                      </span>
                      <span class="contrast-ratio" data-testid="contrast-ratio">
                        {ratio.toFixed(2)}
                      </span>
                      {row !== col && (
                        <span class="contrast-badge" data-testid="contrast-badge">
                          {badge(ratio)}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p class="hint">
        Each cell shows the row swatch as the background and the column swatch on it. AAA is 7 or
        more, AA 4.5, AA large 3.
      </p>
    </div>
  );
}
