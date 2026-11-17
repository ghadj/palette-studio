import { beforeEach, describe, expect, it, vi } from "vitest";

const extract = vi.fn();
vi.mock("../../src/extract/client", () => ({ imageClient: () => ({ extract }) }));

const { extractNow } = await import("../../src/state/extraction");
const { extracting, imageMessage, palette } = await import("../../src/state/signals");

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const color = (l: number, population: number) => ({ lab: { l, a: 0, b: 0 }, population });

describe("live extraction state (spec 6.3, 7.4)", () => {
  beforeEach(() => {
    extract.mockReset();
    imageMessage.value = null;
    palette.value = [];
  });

  it("an extraction error is shown, and cleared when a later extraction succeeds", async () => {
    extract.mockRejectedValueOnce(new Error("boom"));
    extractNow();
    expect(extracting.value).toBe(true);
    await flush();
    expect(extracting.value).toBe(false);
    expect(imageMessage.value?.kind).toBe("error");
    expect(imageMessage.value?.text).toMatch(/couldn't be extracted/);

    extract.mockResolvedValueOnce([color(0.4, 0.6), color(0.8, 0.4)]);
    extractNow();
    await flush();
    expect(palette.value).toHaveLength(2);
    expect(imageMessage.value).toBeNull();
  });

  it("other messages, such as the large-image note or a file error, stay after a successful extraction", async () => {
    for (const message of [
      { kind: "note" as const, text: "This image is 31.0 megapixels, so it is scaled down." },
      { kind: "error" as const, text: "TXT files can't be loaded." },
    ]) {
      imageMessage.value = message;
      extract.mockResolvedValueOnce([color(0.5, 1)]);
      extractNow();
      await flush();
      expect(imageMessage.value).toEqual(message);
    }
  });
});
