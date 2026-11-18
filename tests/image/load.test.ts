import { describe, expect, it } from "vitest";
import {
  classifyFile,
  type Decoders,
  decodeImageFile,
  isLargeImage,
  projectNameFromFile,
} from "../../src/image/load";

const file = (name: string, type: string) => new File([new Uint8Array([1, 2, 3])], name, { type });

const fakeBitmap = (width: number, height: number) => {
  let closed = false;
  return {
    width,
    height,
    close() {
      closed = true;
    },
    get closed() {
      return closed;
    },
  } as unknown as ImageBitmap & { closed: boolean };
};

const decoders = (bitmap: ImageBitmap, fail = false): Decoders & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    async raster() {
      calls.push("raster");
      if (fail) throw new Error("decode failed");
      return bitmap;
    },
    async svg() {
      calls.push("svg");
      if (fail) throw new Error("decode failed");
      return bitmap;
    },
  };
};

describe("loading image files (spec 6, 6.3)", () => {
  it("accepts JPEG, PNG, WebP, GIF, AVIF, SVG by type and extension", () => {
    const byType: Array<[string, string]> = [
      ["image/jpeg", "JPEG"],
      ["image/png", "PNG"],
      ["image/webp", "WebP"],
      ["image/gif", "GIF"],
      ["image/avif", "AVIF"],
      ["image/svg+xml", "SVG"],
    ];
    for (const [type, format] of byType) {
      const info = classifyFile(file("upload", type));
      expect(info.format).toBe(format);
      expect(info.kind).toBe(format === "SVG" ? "svg" : "raster");
    }
    const byExtension: Array<[string, string]> = [
      ["photo.jpg", "JPEG"],
      ["photo.JPEG", "JPEG"],
      ["art.png", "PNG"],
      ["art.webp", "WebP"],
      ["anim.gif", "GIF"],
      ["photo.avif", "AVIF"],
      ["logo.svg", "SVG"],
    ];
    for (const [name, format] of byExtension) {
      const info = classifyFile(file(name, ""));
      expect(info.format, name).toBe(format);
      expect(info.kind, name).toBe(format === "SVG" ? "svg" : "raster");
    }
    expect(classifyFile(file("IMG_0001.HEIC", "")).kind).toBe("heic");
    expect(classifyFile(file("x", "image/heif")).kind).toBe("heic");
  });

  it("HEIC that fails to decode gets the HEIC message", async () => {
    const result = await decodeImageFile(
      file("IMG_0001.HEIC", "image/heic"),
      decoders(fakeBitmap(1, 1), true),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/HEIC/);
    expect(result.message).toMatch(/JPEG/);
    // A HEIC the browser can decode (Safari) loads like any other image.
    const ok = await decodeImageFile(
      file("IMG_0002.heic", "image/heic"),
      decoders(fakeBitmap(4, 3)),
    );
    expect(ok.ok).toBe(true);
  });

  it("other files get a message naming the format and the formats that work", async () => {
    const d = decoders(fakeBitmap(1, 1));
    const txt = await decodeImageFile(file("notes.txt", "text/plain"), d);
    expect(txt).toEqual({
      ok: false,
      message: "TXT files can't be loaded. Use JPEG, PNG, WebP, GIF, AVIF or SVG.",
    });
    const pdf = await decodeImageFile(file("scan", "application/pdf"), d);
    expect(pdf.ok).toBe(false);
    if (!pdf.ok) expect(pdf.message).toMatch(/^PDF files can't be loaded\. Use JPEG, PNG/);
    expect(d.calls).toEqual([]);
    // A supported type that won't decode names its format too.
    const broken = await decodeImageFile(
      file("broken.png", "image/png"),
      decoders(fakeBitmap(1, 1), true),
    );
    expect(broken).toEqual({
      ok: false,
      message:
        "This PNG file couldn't be read. It may be damaged. Use JPEG, PNG, WebP, GIF, AVIF or SVG.",
    });
  });

  it("6000×5000 triggers the 30 MP note, 5000×5000 doesn't", async () => {
    expect(isLargeImage(6000, 5000)).toBe(true);
    expect(isLargeImage(5000, 5000)).toBe(false);
    const big = await decodeImageFile(
      file("big.jpg", "image/jpeg"),
      decoders(fakeBitmap(6000, 5000)),
    );
    expect(big.ok).toBe(true);
    if (big.ok) {
      expect(big.note).toMatch(/30\.0 megapixels/);
      expect(big.note).toMatch(/4096/);
      expect(big.width).toBe(6000);
      expect(big.height).toBe(5000);
    }
    const normal = await decodeImageFile(
      file("ok.jpg", "image/jpeg"),
      decoders(fakeBitmap(5000, 5000)),
    );
    expect(normal.ok && normal.note).toBeFalsy();
  });

  it("a large raster is decoded straight to the working-master size when its size can be read first", async () => {
    const calls: Array<{ width: number; height: number } | undefined> = [];
    const probing: Decoders = {
      probe: async () => ({ width: 8064, height: 6048 }),
      raster: async (_file, resize) => {
        calls.push(resize);
        return fakeBitmap(resize?.width ?? 8064, resize?.height ?? 6048);
      },
      svg: async () => fakeBitmap(1, 1),
    };
    const result = await decodeImageFile(file("IMG_48MP.jpg", "image/jpeg"), probing);
    expect(calls).toEqual([{ width: 4096, height: 3072 }]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // The project keeps the original size; the bitmap is master-sized.
      expect([result.width, result.height]).toEqual([8064, 6048]);
      expect([result.bitmap.width, result.bitmap.height]).toEqual([4096, 3072]);
      expect(result.note).toMatch(/48\.8 megapixels/);
    }
    // Small images, and files whose size can't be read first, decode at full size.
    calls.length = 0;
    await decodeImageFile(file("small.png", "image/png"), {
      ...probing,
      probe: async () => ({ width: 1600, height: 800 }),
    });
    await decodeImageFile(file("unknown.png", "image/png"), {
      ...probing,
      probe: async () => null,
    });
    expect(calls).toEqual([undefined, undefined]);
  });

  it("SVG goes through the image-element decoder; empty bitmaps are rejected and closed", async () => {
    const d = decoders(fakeBitmap(300, 150));
    const svg = await decodeImageFile(file("logo.svg", "image/svg+xml"), d);
    expect(svg.ok).toBe(true);
    expect(d.calls).toEqual(["svg"]);
    const empty = fakeBitmap(0, 0);
    const result = await decodeImageFile(file("empty.svg", "image/svg+xml"), decoders(empty));
    expect(result.ok).toBe(false);
    expect(empty.closed).toBe(true);
  });

  it("project name is the file name without its extension (spec 5.5)", () => {
    expect(projectNameFromFile("harbor mural.final.jpg")).toBe("harbor mural.final");
    expect(projectNameFromFile("IMG_0001.HEIC")).toBe("IMG_0001");
    expect(projectNameFromFile("noext")).toBe("noext");
    expect(projectNameFromFile(".png")).toBe("Untitled");
    expect(projectNameFromFile("")).toBe("Untitled");
  });
});
