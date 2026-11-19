/**
 * The image view layer (spec 3.8; M3-T14). It sits in the image well's transformed layer over the
 * image, so it zooms and pans with it. The Palette or Values view is drawn in the worker (spec
 * 7.4); the reply is RGBA pixels, put into this canvas with `putImageData`. The worker caches the
 * views, so switching back is quick. The pixels are user content: the same in both themes (spec
 * 6.2). In the Image view this renders nothing. The colors are the adjusted palette, or the base
 * palette while Compare is on (plan D18).
 */
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { imageClient, type ViewResult } from "../extract/client";
import type { DrawnViewMode } from "../extract/messages";
import { swatchHex, swatchOklab } from "../palette/model";
import {
  compareBefore,
  displayImage,
  settings as extractionSettings,
  imageLoading,
  imageSrc,
  masterThread,
  outputPalette,
  palette,
  viewSettings,
} from "../state/signals";
import { viewShares } from "../state/view-result";
import type { ViewSettings } from "../types";

interface Drawn {
  mode: DrawnViewMode;
  key: string;
  bands: ViewSettings["bands"];
  dither: boolean;
  result: ViewResult;
}

export function ViewLayer() {
  const settings = viewSettings.value;
  const mode = settings.mode;
  const swatches = compareBefore.value ? palette.value : outputPalette.value;
  const hexes = swatches.map(swatchHex);
  const loading = imageLoading.value;
  // A new image or a restarted worker needs a new request: the dependencies below name them.
  const image = displayImage.value ?? imageSrc.value;
  const master = masterThread.value;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState<Drawn | null>(null);
  const alphaCutoff = extractionSettings.value.alphaCutoff;
  const key = `${mode}|${hexes.join(",")}|${settings.bands}|${settings.dither}|${alphaCutoff}`;

  // Ask the worker for the view; the newest request wins.
  useLayoutEffect(() => {
    if (mode === "image") {
      viewShares.value = null;
      setDrawn(null);
      return;
    }
    if (loading || !master || hexes.length === 0) return;
    let current = true;
    imageClient()
      .view({
        mode,
        colors: swatches.map(swatchOklab),
        bands: settings.bands,
        dither: settings.dither,
        alphaCutoff,
      })
      .then(
        (result) => {
          if (!current) return;
          setDrawn({ mode, key, bands: settings.bands, dither: settings.dither, result });
          viewShares.value = {
            mode,
            hexes,
            shares: result.shares,
            bandShares: result.bandShares,
          };
        },
        () => {
          // The view is an aid: without it the image simply shows.
        },
      );
    return () => {
      current = false;
    };
    // `key` names every input of the request; `image` and `master` name the image it reads.
  }, [key, image, master, loading]);

  // Draw the reply into the canvas.
  useLayoutEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx || !drawn) return;
    const { width, height, data } = drawn.result;
    ctx.putImageData(new ImageData(data, width, height), 0, 0);
  }, [drawn]);

  if (mode === "image" || !drawn || drawn.mode !== mode) return null;
  const { width, height } = drawn.result;
  return (
    <canvas
      ref={canvas}
      class="image-well__view"
      width={width}
      height={height}
      role="img"
      aria-label={mode === "palette" ? "Palette view of the image" : "Values view of the image"}
      data-user-content=""
      data-testid="view-layer"
      data-view-mode={mode}
      data-bands={mode === "values" ? String(drawn.bands) : undefined}
      data-dither={mode === "palette" && drawn.dither ? "" : undefined}
      data-settling={drawn.key === key ? undefined : ""}
    />
  );
}
