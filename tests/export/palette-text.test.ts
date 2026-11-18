import { describe, expect, it } from "vitest";
import { paletteToHexText } from "../../src/export/palette-text";
import { buildMockupState } from "../../src/state/mockup";

describe("Copy HEX (spec 5.1 Text; M1 decision 7)", () => {
  it("mockup fixture gives '#E8693A\\n#1DB07A\\n#14386B\\n#D4527F\\n#1E8A2E\\n#5039B0'", () => {
    expect(paletteToHexText(buildMockupState().project.palette)).toBe(
      "#E8693A\n#1DB07A\n#14386B\n#D4527F\n#1E8A2E\n#5039B0",
    );
    expect(paletteToHexText([])).toBe("");
  });
});
