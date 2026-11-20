import { describe, expect, it } from "vitest";
import { shortcutOf } from "../../src/ui/shortcuts";

const key = (init: Partial<KeyboardEvent>) =>
  ({ ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...init }) as KeyboardEvent;

describe("shortcut names (spec 6 Keyboard)", () => {
  it("Ctrl and Cmd are both mod; Shift is named and the key is lowercased", () => {
    expect(shortcutOf(key({ key: "z", ctrlKey: true }))).toBe("mod+z");
    expect(shortcutOf(key({ key: "z", metaKey: true }))).toBe("mod+z");
    expect(shortcutOf(key({ key: "Z", metaKey: true, shiftKey: true }))).toBe("mod+shift+z");
    expect(shortcutOf(key({ key: "e" }))).toBe("e");
  });
});
