/**
 * Generates the image fixtures in tests/fixtures (M1-T9). PNGs come from tools/png.ts; the JPEG is
 * encoded by Chromium (through Playwright) and then given an EXIF orientation 6 tag.
 *
 * Usage: tsx tools/make-fixtures.ts
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { SINGLE_COLOR, TWELVE_COLORS, TWO_COLOR } from "./fixture-colors";
import { encodePng, hexBytes } from "./png";

const dir = resolve(process.cwd(), "tests/fixtures");

function solid(width: number, height: number, fill: (x: number, y: number) => number[]) {
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) out.set(fill(x, y), (y * width + x) * 4);
  }
  return out;
}

export { SINGLE_COLOR, TWELVE_COLORS, TWO_COLOR };

/** EXIF APP1 segment holding only Orientation (0x0112) = value. Little-endian TIFF. */
function exifOrientation(value: number): Buffer {
  const tiff = Buffer.alloc(26);
  tiff.write("II", 0, "latin1");
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4); // first IFD offset
  tiff.writeUInt16LE(1, 8); // one entry
  tiff.writeUInt16LE(0x0112, 10); // Orientation
  tiff.writeUInt16LE(3, 12); // SHORT
  tiff.writeUInt32LE(1, 14); // count
  tiff.writeUInt16LE(value, 18);
  tiff.writeUInt32LE(0, 22); // no next IFD
  const payload = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
  const header = Buffer.alloc(4);
  header.writeUInt16BE(0xffe1, 0);
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([header, payload]);
}

async function main() {
  // 40 × 40, 75% (30 columns) one color, 25% (10 columns) another.
  const [ma, mb] = [hexBytes(TWO_COLOR.major), hexBytes(TWO_COLOR.minor)];
  writeFileSync(
    resolve(dir, "two-color.png"),
    encodePng(
      40,
      40,
      solid(40, 40, (x) => [...(x < 30 ? ma : mb), 255]),
    ),
  );
  writeFileSync(
    resolve(dir, "single-color.png"),
    encodePng(
      16,
      16,
      solid(16, 16, () => [...hexBytes(SINGLE_COLOR), 255]),
    ),
  );
  writeFileSync(
    resolve(dir, "transparent.png"),
    encodePng(
      16,
      16,
      solid(16, 16, () => [0, 0, 0, 0]),
    ),
  );
  writeFileSync(resolve(dir, "not-an-image.txt"), "This is not an image.\n");

  // 120 × 20: twelve distinct flat stripes, for the 12-color strip layout (decision 13).
  const twelve = TWELVE_COLORS.map(hexBytes);
  writeFileSync(
    resolve(dir, "twelve-colors.png"),
    encodePng(
      120,
      20,
      solid(120, 20, (x) => [...(twelve[Math.floor(x / 10)] ?? [0, 0, 0]), 255]),
    ),
  );

  // Stored landscape, 80 × 40: left half red, right half blue. Orientation 6 rotates it 90° clockwise,
  // so it displays as 40 × 80 portrait with red on top.
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // The large one (5000 × 2500 stored, 2500 × 5000 shown) exercises decoding straight to the
  // working-master size (spec 7.4).
  for (const [name, width, height, quality] of [
    ["exif-orientation-6.jpg", 80, 40, 1],
    ["exif-orientation-6-large.jpg", 5000, 2500, 0.8],
  ] as const) {
    const dataUrl = await page.evaluate(
      ({ width, height, quality }) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no 2d context");
        ctx.fillStyle = "#ff0000";
        ctx.fillRect(0, 0, width / 2, height);
        ctx.fillStyle = "#0000ff";
        ctx.fillRect(width / 2, 0, width / 2, height);
        return canvas.toDataURL("image/jpeg", quality);
      },
      { width, height, quality },
    );
    const jpeg = Buffer.from(dataUrl.split(",")[1] ?? "", "base64");
    if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error("not a JPEG");
    const withExif = Buffer.concat([jpeg.subarray(0, 2), exifOrientation(6), jpeg.subarray(2)]);
    writeFileSync(resolve(dir, name), withExif);
  }
  await browser.close();
  process.stdout.write("fixtures written\n");
}

await main();
