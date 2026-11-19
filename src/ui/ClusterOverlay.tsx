/**
 * The cluster-map overlay (spec 2.6; M2 decision 13b). It sits in the image well's transformed
 * layer over the image, so it follows zoom and pan. The shown swatch's pixels stay clear and every
 * other pixel is dimmed toward a neutral mid-gray at about 70%, the same in both themes, so it is
 * user content (spec 6.2). The pixels are built in the worker and only put into the canvas here
 * (spec 7.4). While a new palette is being extracted the old map stays, dimmed like the strip.
 */
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { imageClient } from "../extract/client";
import type { ClusterMap } from "../extract/cluster-map";
import { shownCluster } from "../state/cluster";
import { extracting, imageLoading } from "../state/signals";

/** Overlay pixels by map and swatch index, so moving between swatches doesn't ask again. */
const cache = new WeakMap<ClusterMap, Map<number, Promise<Uint8ClampedArray<ArrayBuffer>>>>();

function overlayPixels(map: ClusterMap, index: number): Promise<Uint8ClampedArray<ArrayBuffer>> {
  let byIndex = cache.get(map);
  if (!byIndex) {
    byIndex = new Map();
    cache.set(map, byIndex);
  }
  let pixels = byIndex.get(index);
  if (!pixels) {
    pixels = imageClient().overlay(map, index);
    // A failed request may be retried on the next show.
    pixels.catch(() => byIndex?.delete(index));
    byIndex.set(index, pixels);
  }
  return pixels;
}

export function ClusterOverlay() {
  const shown = shownCluster.value;
  return shown ? <OverlayCanvas map={shown.map} index={shown.index} /> : null;
}

function OverlayCanvas({ map, index }: { map: ClusterMap; index: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState<{ map: ClusterMap; index: number } | null>(null);

  useLayoutEffect(() => {
    let current = true;
    overlayPixels(map, index).then(
      (pixels) => {
        const ctx = canvas.current?.getContext("2d");
        if (!current || !ctx) return;
        ctx.putImageData(new ImageData(pixels, map.width, map.height), 0, 0);
        setDrawn({ map, index });
      },
      () => {
        // The overlay is an aid: without it the image simply shows undimmed.
        if (current) setDrawn({ map, index });
      },
    );
    return () => {
      current = false;
    };
  }, [map, index]);

  const settled = drawn?.map === map && drawn.index === index;
  return (
    <canvas
      ref={canvas}
      class="image-well__overlay"
      width={map.width}
      height={map.height}
      data-user-content=""
      data-testid="cluster-overlay"
      data-index={index}
      data-settling={settled ? undefined : ""}
      data-busy={extracting.value || imageLoading.value || undefined}
    />
  );
}
