/**
 * The toolbar row directly under the image well (M3 decision 42, ui-contract D7): Markers and
 * Eyedropper on the left (Image view only), Zoom out, Fit and Zoom in on the right (every view).
 * Nothing here covers the image. It shows once an image is loaded. DOM order puts it after the well
 * and its markers, so Tab goes well, markers, then these controls.
 */
import { displayImage, imageSrc } from "../state/signals";
import { WellTools } from "./WellTools";
import { ZoomControls } from "./ZoomControls";

export function ImageToolbar() {
  const hasImage = displayImage.value !== null || Boolean(imageSrc.value);
  if (!hasImage) return null;
  return (
    <div class="image-toolbar" data-testid="image-toolbar">
      <WellTools />
      <ZoomControls />
    </div>
  );
}
