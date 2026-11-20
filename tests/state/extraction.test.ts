import { beforeEach, describe, expect, it, vi } from "vitest";

const extract = vi.fn();
vi.mock("../../src/extract/client", () => ({ imageClient: () => ({ extract }) }));

const { extractNewImage, extractNow, startLiveExtraction } = await import(
  "../../src/state/extraction"
);
const history = await import("../../src/state/history");
const { DEBOUNCE_MS } = await import("../../src/state/jobs");
const {
  backgroundNotFound,
  displayImage,
  emptyRoles,
  extracting,
  imageMessage,
  palette,
  selectedSwatchId,
  settings,
} = await import("../../src/state/signals");

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const color = (l: number, population: number) => ({ lab: { l, a: 0, b: 0 }, population });
const result = (...colors: Array<ReturnType<typeof color>>) => ({ colors, reason: null });

describe("live extraction state (spec 6.3, 7.4)", () => {
  beforeEach(() => {
    extract.mockReset();
    imageMessage.value = null;
    palette.value = [];
    emptyRoles.value = [];
    settings.value = { ...settings.peek(), algorithm: "balanced" };
  });

  it("an extraction error is shown, and cleared when a later extraction succeeds", async () => {
    extract.mockRejectedValueOnce(new Error("boom"));
    extractNow();
    expect(extracting.value).toBe(true);
    await flush();
    expect(extracting.value).toBe(false);
    expect(imageMessage.value?.kind).toBe("error");
    expect(imageMessage.value?.text).toMatch(/couldn't be extracted/);

    extract.mockResolvedValueOnce(result(color(0.4, 0.6), color(0.8, 0.4)));
    extractNow();
    await flush();
    expect(palette.value).toHaveLength(2);
    expect(imageMessage.value).toBeNull();
  });

  it("a stopped worker resets the working state and shows an error (evaluator note 6)", async () => {
    const { WorkerStoppedError } = await vi.importActual<typeof import("../../src/extract/client")>(
      "../../src/extract/client",
    );
    extract.mockRejectedValueOnce(new WorkerStoppedError());
    extractNow();
    await flush();
    expect(extracting.value).toBe(false);
    expect(imageMessage.value).toMatchObject({ kind: "error", fromExtraction: true });
  });

  it("if a new image's extraction fails, the previous image's palette is cleared and the error stays (L9)", async () => {
    extract.mockResolvedValueOnce(result(color(0.4, 0.6), color(0.8, 0.4)));
    extractNewImage();
    await flush();
    expect(palette.value).toHaveLength(2);
    selectedSwatchId.value = palette.value[1]?.id ?? null;

    extract.mockRejectedValueOnce(new Error("boom"));
    extractNewImage();
    expect(extracting.value).toBe(true);
    await flush();
    expect(palette.value).toEqual([]);
    expect(selectedSwatchId.value).toBeNull();
    expect(extracting.value).toBe(false);
    expect(imageMessage.value).toMatchObject({ kind: "error", fromExtraction: true });
  });

  it("a failed re-extraction of the same image keeps its palette, no longer dimmed", async () => {
    extract.mockResolvedValueOnce(result(color(0.4, 0.6), color(0.8, 0.4)));
    extractNewImage();
    await flush();
    const current = palette.value;
    extract.mockRejectedValueOnce(new Error("boom"));
    extractNow();
    await flush();
    expect(palette.value).toBe(current);
    expect(extracting.value).toBe(false);
    expect(imageMessage.value?.kind).toBe("error");
  });

  it("other messages, such as the large-image note or a file error, stay after a successful extraction", async () => {
    for (const message of [
      { kind: "note" as const, text: "This image is 31.0 megapixels, so it is scaled down." },
      { kind: "error" as const, text: "TXT files can't be loaded." },
    ]) {
      imageMessage.value = message;
      extract.mockResolvedValueOnce(result(color(0.5, 1)));
      extractNow();
      await flush();
      expect(imageMessage.value).toEqual(message);
    }
  });

  it("swatch roles name their swatches and list the empty roles; another algorithm clears them (M2 decision 10b)", async () => {
    settings.value = { ...settings.peek(), algorithm: "swatch-roles" };
    extract.mockResolvedValueOnce({
      colors: [
        { ...color(0.6, 0.7), name: "Muted" },
        { ...color(0.3, 0.3), name: "Dark muted" },
      ],
      reason: null,
    });
    extractNow();
    // Changing the algorithm while the job runs doesn't change what the result describes.
    settings.value = { ...settings.peek(), algorithm: "kmeans" };
    await flush();
    expect(palette.value.map((s) => s.name)).toEqual(["Muted", "Dark muted"]);
    expect(emptyRoles.value).toEqual(["Vibrant", "Dark vibrant", "Light vibrant", "Light muted"]);

    extract.mockResolvedValueOnce(result(color(0.5, 1)));
    extractNow();
    await flush();
    expect(palette.value.map((s) => s.name)).toEqual([""]);
    expect(emptyRoles.value).toEqual([]);
  });

  it("swatch roles with every role empty lists all six", async () => {
    settings.value = { ...settings.peek(), algorithm: "swatch-roles" };
    extract.mockResolvedValueOnce(result());
    extractNow();
    await flush();
    expect(emptyRoles.value).toHaveLength(6);
  });

  it("a cleared palette clears the empty-roles note", async () => {
    settings.value = { ...settings.peek(), algorithm: "swatch-roles" };
    extract.mockResolvedValueOnce({ colors: [{ ...color(0.5, 1), name: "Muted" }], reason: null });
    extractNewImage();
    await flush();
    expect(emptyRoles.value).toHaveLength(5);
    extract.mockRejectedValueOnce(new Error("boom"));
    extractNewImage();
    await flush();
    expect(palette.value).toEqual([]);
    expect(emptyRoles.value).toEqual([]);
  });

  it("when every pixel is filtered out, the strip empties and the message says to loosen a filter; a later palette clears it (M2 decision 18)", async () => {
    extract.mockResolvedValueOnce(result(color(0.4, 0.6), color(0.8, 0.4)));
    extractNewImage();
    await flush();
    selectedSwatchId.value = palette.value[0]?.id ?? null;

    extract.mockResolvedValueOnce({ colors: [], reason: "all-filtered" });
    extractNow();
    await flush();
    expect(palette.value).toEqual([]);
    expect(selectedSwatchId.value).toBeNull();
    expect(imageMessage.value).toEqual({
      kind: "note",
      text: "Every pixel is filtered out. Loosen a filter.",
      fromExtraction: true,
    });

    extract.mockResolvedValueOnce(result(color(0.5, 1)));
    extractNow();
    await flush();
    expect(palette.value).toHaveLength(1);
    expect(imageMessage.value).toBeNull();
  });

  it("with swatch roles, an all-filtered result shows only the filter message, not six empty roles", async () => {
    settings.value = { ...settings.peek(), algorithm: "swatch-roles" };
    extract.mockResolvedValueOnce({ colors: [], reason: "all-filtered" });
    extractNow();
    await flush();
    expect(emptyRoles.value).toEqual([]);
    expect(imageMessage.value?.text).toBe("Every pixel is filtered out. Loosen a filter.");
  });

  it("Ignore background on Auto with no background found sets backgroundNotFound; a found one or Off clears it (M2 decisions 4, 18)", async () => {
    extract.mockResolvedValueOnce({ ...result(color(0.5, 1)), background: "none" });
    extractNow();
    await flush();
    expect(backgroundNotFound.value).toBe(true);

    extract.mockResolvedValueOnce({ ...result(color(0.5, 1)), background: "found" });
    extractNow();
    await flush();
    expect(backgroundNotFound.value).toBe(false);

    extract.mockResolvedValueOnce({ ...result(color(0.5, 1)), background: "none" });
    extractNow();
    await flush();
    expect(backgroundNotFound.value).toBe(true);
    extract.mockResolvedValueOnce(result(color(0.5, 1)));
    extractNow();
    await flush();
    expect(backgroundNotFound.value).toBe(false);
  });

  it("a new image's failed extraction clears the palette", async () => {
    extract.mockResolvedValueOnce(result(color(0.4, 0.5), color(0.8, 0.5)));
    extractNewImage();
    await flush();
    expect(palette.value).toHaveLength(2);
    extract.mockRejectedValueOnce(new Error("boom"));
    extractNewImage();
    await flush();
    expect(palette.value).toEqual([]);
  });
});

describe("extraction and history (spec 3.6; plan Q3a, Q3b)", () => {
  const settle = () => new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 40));
  const hexesOf = () => palette.value.map((s) => s.color.l.toFixed(3));

  beforeEach(async () => {
    startLiveExtraction();
    extract.mockReset();
    displayImage.value = {} as ImageBitmap;
    settings.value = { ...settings.peek(), algorithm: "balanced", colors: 6 };
    extract.mockResolvedValueOnce(result(color(0.4, 0.6), color(0.8, 0.4)));
    extractNewImage();
    await settle();
    extract.mockReset();
  });

  it("extracted swatches remember their extracted color (reset to extracted, 3.7)", () => {
    for (const swatch of palette.value) {
      expect(swatch.extracted).toEqual({ color: swatch.color, point: swatch.point });
    }
  });

  it("a settings change commits one step after its result lands", async () => {
    expect(history.canUndo.value).toBe(false);
    extract.mockResolvedValueOnce(result(color(0.3, 0.5), color(0.6, 0.3), color(0.9, 0.2)));
    settings.value = { ...settings.peek(), colors: 8 };
    expect(history.canUndo.value).toBe(false);
    await settle();
    expect(extract).toHaveBeenCalledTimes(1);
    expect(palette.value).toHaveLength(3);
    expect(history.canUndo.value).toBe(true);
    expect(history.undoLabel.value).toBe("Colors");
  });

  it("undo restores settings and palette and starts no job", async () => {
    const before = { palette: palette.value, settings: settings.value };
    extract.mockResolvedValueOnce(result(color(0.3, 0.5), color(0.6, 0.3), color(0.9, 0.2)));
    settings.value = { ...settings.peek(), colors: 8 };
    await settle();
    const after = { palette: palette.value, settings: settings.value, hexes: hexesOf() };

    history.undo();
    expect(settings.value).toBe(before.settings);
    expect(palette.value).toBe(before.palette);
    await settle();
    expect(extract).toHaveBeenCalledTimes(1);
    expect(extracting.value).toBe(false);

    history.redo();
    expect(settings.value).toBe(after.settings);
    expect(palette.value).toBe(after.palette);
    expect(hexesOf()).toEqual(after.hexes);
    await settle();
    expect(extract).toHaveBeenCalledTimes(1);
  });

  it("undo while a re-extraction is pending cancels it, so its result doesn't land", async () => {
    extract.mockResolvedValueOnce(result(color(0.3, 0.5), color(0.6, 0.3), color(0.9, 0.2)));
    settings.value = { ...settings.peek(), colors: 8 };
    await settle();
    const committed = palette.value;
    let resolve!: (value: ReturnType<typeof result>) => void;
    extract.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );
    settings.value = { ...settings.peek(), colors: 9 };
    await settle();
    expect(extracting.value).toBe(true);
    history.undo();
    expect(extracting.value).toBe(false);
    resolve(result(color(0.5, 1)));
    await settle();
    expect(settings.value.colors).toBe(6);
    expect(palette.value).not.toBe(committed);
    expect(palette.value).toHaveLength(2);
    expect(history.redoLabel.value).toBe("Colors");
    history.redo();
    expect(palette.value).toBe(committed);
    expect(settings.value.colors).toBe(8);
  });

  it("a new image clears history", async () => {
    extract.mockResolvedValueOnce(result(color(0.3, 0.5), color(0.6, 0.3), color(0.9, 0.2)));
    settings.value = { ...settings.peek(), colors: 8 };
    await settle();
    history.undo();
    expect(history.canRedo.value).toBe(true);
    history.redo();
    expect(history.canUndo.value).toBe(true);

    extract.mockResolvedValueOnce(result(color(0.5, 1)));
    extractNewImage();
    expect(history.canUndo.value).toBe(false);
    expect(history.canRedo.value).toBe(false);
    await settle();
    expect(palette.value).toHaveLength(1);
    expect(history.canUndo.value).toBe(false);
  });

  it("with no image loaded (the mockup state), a settings change is one step after the debounce and starts no job", async () => {
    displayImage.value = null;
    history.clear();
    settings.value = { ...settings.peek(), colors: 7 };
    settings.value = { ...settings.peek(), colors: 8 };
    expect(history.canUndo.value).toBe(false);
    await settle();
    expect(extract).not.toHaveBeenCalled();
    expect(history.undoLabel.value).toBe("Colors");
    history.undo();
    expect(settings.value.colors).toBe(6);
    expect(history.canUndo.value).toBe(false);
  });
});
