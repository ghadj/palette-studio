/**
 * Classifying and decoding image files (spec 6 "Supported images", 6.1 "Getting images in", 6.3).
 * Raster images decode with createImageBitmap, honoring EXIF orientation (spec 2.1 step 1). SVG is
 * decoded as an image element from a blob URL and never inlined, so scripts in it never run (7.8).
 */
import { formatNumber } from "../export/format";

export const WORKING_FORMATS = "JPEG, PNG, WebP, GIF, AVIF or SVG";

/** Above about 30 MP the app shows a note, then downscales to the working master (spec 6.3). */
export const LARGE_IMAGE_PIXELS = 30_000_000;

export type FileKind = "raster" | "svg" | "heic" | "unsupported";

export interface FileInfo {
  kind: FileKind;
  /** A short format name for messages, such as "PNG" or "TXT". */
  format: string;
}

const BY_TYPE: Record<string, FileInfo> = {
  "image/jpeg": { kind: "raster", format: "JPEG" },
  "image/jpg": { kind: "raster", format: "JPEG" },
  "image/pjpeg": { kind: "raster", format: "JPEG" },
  "image/png": { kind: "raster", format: "PNG" },
  "image/apng": { kind: "raster", format: "PNG" },
  "image/webp": { kind: "raster", format: "WebP" },
  "image/gif": { kind: "raster", format: "GIF" },
  "image/avif": { kind: "raster", format: "AVIF" },
  "image/svg+xml": { kind: "svg", format: "SVG" },
  "image/heic": { kind: "heic", format: "HEIC" },
  "image/heif": { kind: "heic", format: "HEIC" },
  "image/heic-sequence": { kind: "heic", format: "HEIC" },
  "image/heif-sequence": { kind: "heic", format: "HEIC" },
};

const BY_EXTENSION: Record<string, FileInfo> = {
  jpg: { kind: "raster", format: "JPEG" },
  jpeg: { kind: "raster", format: "JPEG" },
  jpe: { kind: "raster", format: "JPEG" },
  jfif: { kind: "raster", format: "JPEG" },
  png: { kind: "raster", format: "PNG" },
  apng: { kind: "raster", format: "PNG" },
  webp: { kind: "raster", format: "WebP" },
  gif: { kind: "raster", format: "GIF" },
  avif: { kind: "raster", format: "AVIF" },
  svg: { kind: "svg", format: "SVG" },
  heic: { kind: "heic", format: "HEIC" },
  heif: { kind: "heic", format: "HEIC" },
};

function extension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function classifyFile(file: { name: string; type: string }): FileInfo {
  const type = file.type.toLowerCase();
  const byType = BY_TYPE[type];
  if (byType) return byType;
  const ext = extension(file.name);
  const byExt = BY_EXTENSION[ext];
  // Browsers often leave the type empty, or generic, for files they don't know.
  if (byExt && (type === "" || type === "application/octet-stream")) return byExt;
  let format = ext.toUpperCase();
  if (!format && type) {
    const subtype = type.split("/")[1] ?? "";
    format = subtype.replace(/^x-/, "").split(/[+.;]/)[0]?.toUpperCase() ?? "";
  }
  return { kind: "unsupported", format: format || "These" };
}

export const unsupportedMessage = (format: string): string =>
  `${format} files can't be loaded. Use ${WORKING_FORMATS}.`;

export const unreadableMessage = (format: string): string =>
  `This ${format} file couldn't be read. It may be damaged. Use ${WORKING_FORMATS}.`;

export const HEIC_MESSAGE =
  "This browser can't open HEIC photos. Save the photo as JPEG first, or open Palette Studio in Safari, which reads HEIC.";

export const isLargeImage = (width: number, height: number): boolean =>
  width * height >= LARGE_IMAGE_PIXELS;

export const largeImageNote = (width: number, height: number): string =>
  `This image is ${formatNumber((width * height) / 1e6, 1)} megapixels, so it is scaled down to 4096 px on the longest edge.`;

/** Spec 5.5 "First visit": a project is named after its image file, without the extension. */
export function projectNameFromFile(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : dot === 0 ? "" : name).trim();
  return base || "Untitled";
}

export interface Decoders {
  raster(file: Blob): Promise<ImageBitmap>;
  svg(file: Blob): Promise<ImageBitmap>;
}

export const browserDecoders: Decoders = {
  raster: (file) => createImageBitmap(file, { imageOrientation: "from-image" }),
  async svg(file) {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.decoding = "async";
      image.src = url;
      await image.decode();
      if (!image.naturalWidth || !image.naturalHeight) throw new Error("SVG has no size");
      return await createImageBitmap(image);
    } finally {
      URL.revokeObjectURL(url);
    }
  },
};

export type DecodeResult =
  | {
      ok: true;
      bitmap: ImageBitmap;
      /** Size after EXIF orientation. */
      width: number;
      height: number;
      format: string;
      note: string | null;
    }
  | { ok: false; message: string };

export async function decodeImageFile(
  file: File,
  decoders: Decoders = browserDecoders,
): Promise<DecodeResult> {
  const info = classifyFile(file);
  if (info.kind === "unsupported") return { ok: false, message: unsupportedMessage(info.format) };
  let bitmap: ImageBitmap;
  try {
    bitmap = info.kind === "svg" ? await decoders.svg(file) : await decoders.raster(file);
  } catch {
    return {
      ok: false,
      message: info.kind === "heic" ? HEIC_MESSAGE : unreadableMessage(info.format),
    };
  }
  const { width, height } = bitmap;
  if (!width || !height) {
    bitmap.close();
    return { ok: false, message: unreadableMessage(info.format) };
  }
  return {
    ok: true,
    bitmap,
    width,
    height,
    format: info.format,
    note: isLargeImage(width, height) ? largeImageNote(width, height) : null,
  };
}
