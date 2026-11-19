/**
 * Sample-point markers (M3-T2 slot; spec 3.7, ui-contract "Marker"). The layer sits in the image
 * well outside the transformed layer, over the whole well, so markers keep their on-screen size at
 * any zoom: it maps each normalized point through `imageView` (well fractions: `view.x + point.x ×
 * view.scale`, and the same for y). M3-T12 draws the markers and M3-T15 drags them.
 *
 * Every marker's hit area carries `data-marker`: the well's pan and pinch ignore a pointerdown on
 * one, and its arrow keys don't pan (see `pointerRouting.ts`). Empty until then.
 */
export function MarkerLayer() {
  return null;
}
