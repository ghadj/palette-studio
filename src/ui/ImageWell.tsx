/**
 * The image well (ui-contract column 1 item 1). The image is user content: it keeps its own colors
 * in both themes (spec 6.2). Sample-point markers arrive in M3.
 */
import { imageMeta, imageSrc } from "../state/signals";

export function ImageWell() {
  const src = imageSrc.value;
  const meta = imageMeta.value;
  return (
    <div class="image-well" data-testid="image-well">
      {src ? (
        <img
          class="image-well__image"
          src={src}
          alt={meta ? `Source image, ${meta.name}` : "Source image"}
          width={meta?.width}
          height={meta?.height}
          draggable={false}
          data-user-content=""
        />
      ) : (
        <p class="image-well__empty">No image yet</p>
      )}
    </div>
  );
}
