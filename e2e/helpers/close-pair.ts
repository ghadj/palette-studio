import { encodePng } from "../../tools/png";

/**
 * A runtime-generated close-pair image (M3-T8): the left half is #E8693A and the right half
 * #F0693A (a different 5-bit histogram bin, ΔE00 about 2).
 * With the merge threshold at 0 extraction keeps them as two swatches.
 * (#E8693A/#EA6B3B falls in one bin at every histogram depth, so extraction can never keep it apart.)
 */
export function closePairImage(): { name: string; mimeType: string; buffer: Buffer } {
  const width = 64;
  const height = 32;
  const left = [0xe8, 0x69, 0x3a, 255];
  const right = [0xf0, 0x69, 0x3a, 255];
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      data.set(x < width / 2 ? left : right, (y * width + x) * 4);
    }
  }
  return { name: "close-pair.png", mimeType: "image/png", buffer: encodePng(width, height, data) };
}
