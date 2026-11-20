import { encodePng } from "../../tools/png";

/**
 * grayscale-plus-red.png (spec 8 "grayscale"; M2 plan T6 and T8): a horizontal gray ramp from
 * #000000 to #FFFFFF with a #FF0000 band across the middle. Built in memory at 240 × 60, under the
 * default 256 px sample size, so no resampling blends the band into the ramp.
 *
 * Under swatch roles it fills Vibrant (#FF0000) and the three muted roles from the ramp, and
 * leaves Dark vibrant and Light vibrant empty.
 */
export function grayscalePlusRed(): { name: string; mimeType: string; buffer: Buffer } {
  const width = 240;
  const height = 60;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const v = Math.round((x * 255) / (width - 1));
      const red = y >= 24 && y < 36;
      data.set(red ? [255, 0, 0, 255] : [v, v, v, 255], (y * width + x) * 4);
    }
  }
  return {
    name: "grayscale-plus-red.png",
    mimeType: "image/png",
    buffer: encodePng(width, height, data),
  };
}
