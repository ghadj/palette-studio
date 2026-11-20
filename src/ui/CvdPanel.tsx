/**
 * The CVD row's content (spec 3.5; plan D6): in place on desktop, a bottom sheet on phones. A
 * Normal strip plus one simulated strip per type (protanopia, deuteranopia, tritanopia,
 * achromatopsia), each labelled and made of the output palette's swatches (so adjustments show).
 * The simulation is Machado 2009 at severity 1 in `src/color/cvd.ts`. The strips are user content
 * and keep the same colors in both themes (spec 6.2); each strip also has a text label and a
 * HEX list for assistive tech, so it is not color-only.
 */
import { hexToRgb, rgbToHex } from "../color/convert";
import { CVD_TYPES, type CvdType, simulateCvd } from "../color/cvd";
import { swatchHex } from "../palette/model";
import { outputPalette } from "../state/signals";

function Strip({ id, label, hexes }: { id: string; label: string; hexes: readonly string[] }) {
  return (
    <div class="cvd-strip" data-testid={`cvd-strip-${id}`}>
      <div class="cvd-strip__label section-label">{label}</div>
      <div class="cvd-strip__swatches" role="img" aria-label={`${label}: ${hexes.join(", ")}`}>
        {hexes.map((hex, i) => (
          <span
            key={i}
            class="cvd-strip__swatch"
            data-user-content=""
            data-cvd-swatch=""
            data-hex={hex}
            style={{ background: hex }}
          />
        ))}
      </div>
    </div>
  );
}

export function CvdPanel() {
  const normal = outputPalette.value.map(swatchHex);
  const simulated = (type: CvdType) =>
    normal.map((hex) => rgbToHex(simulateCvd(hexToRgb(hex), type)));
  return (
    <div class="cvd-panel" data-testid="cvd-panel">
      <Strip id="normal" label="Normal" hexes={normal} />
      {CVD_TYPES.map((t) => (
        <Strip key={t.id} id={t.id} label={t.label} hexes={simulated(t.id)} />
      ))}
    </div>
  );
}
