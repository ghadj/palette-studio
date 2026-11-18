/**
 * Classifying and decoding image files (spec 6 "Supported images", 6.1 "Getting images in", 6.3).
 * Raster images decode with createImageBitmap, honoring EXIF orientation (spec 2.1 step 1). SVG is
 * decoded as an image element from a blob URL and never inlined, so scripts in it never run (7.8).
 */
import { formatNumber } from "../export/format";
import { MASTER_MAX, masterSize, type Size } from "./tiers";

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
  /**
   * Reads the displayed (EXIF-oriented) size without decoding the pixels, or null when it can't.
   * Optional: without it, rasters decode at full size.
   */
  probe?(file: Blob): Promise<Size | null>;
  /** Decodes honoring EXIF orientation; `resize` is the oriented output size. */
  raster(file: Blob, resize?: Size): Promise<ImageBitmap>;
  svg(file: Blob): Promise<ImageBitmap>;
}

export const browserDecoders: Decoders = {
  // An image element knows its oriented size once loaded, before its pixels are decoded.
  async probe(file) {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("probe failed"));
        image.src = url;
      });
      const { naturalWidth: width, naturalHeight: height } = image;
      image.src = "";
      return width && height ? { width, height } : null;
    } catch {
      return null;
    } finally {
      URL.revokeObjectURL(url);
    }
  },
  raster: (file, resize) =>
    createImageBitmap(
      file,
      resize
        ? {
            imageOrientation: "from-image",
            resizeWidth: resize.width,
            resizeHeight: resize.height,
            resizeQuality: "high",
          }
        : { imageOrientation: "from-image" },
    ),
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
      /** At most the working-master size when the original size could be read first. */
      bitmap: ImageBitmap;
      /** Original size after EXIF orientation. */
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
  // Spec 7.4: a large photo is decoded straight to the working-master size where the browser can,
  // so it is never held decoded at full size. The probe gives the original size for the project.
  let original: Size | null = null;
  try {
    if (info.kind === "svg") bitmap = await decoders.svg(file);
    else {
      original = decoders.probe ? await decoders.probe(file) : null;
      const large = original && Math.max(original.width, original.height) > MASTER_MAX;
      bitmap =
        original && large
          ? await decoders.raster(file, masterSize(original.width, original.height))
          : await decoders.raster(file);
    }
  } catch {
    return {
      ok: false,
      message: info.kind === "heic" ? HEIC_MESSAGE : unreadableMessage(info.format),
    };
  }
  if (!bitmap.width || !bitmap.height) {
    bitmap.close();
    return { ok: false, message: unreadableMessage(info.format) };
  }
  const width = original?.width ?? bitmap.width;
  const height = original?.height ?? bitmap.height;
  return {
    ok: true,
    bitmap,
    width,
    height,
    format: info.format,
    note: isLargeImage(width, height) ? largeImageNote(width, height) : null,
  };
}
