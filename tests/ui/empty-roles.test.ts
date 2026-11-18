import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import { afterEach, describe, expect, it } from "vitest";
import { emptyRoles } from "../../src/state/signals";
import { EmptyRolesNote, emptyRolesText } from "../../src/ui/SwatchStrip";

describe("the empty-roles note (M2 decision 10b)", () => {
  afterEach(() => {
    emptyRoles.value = [];
  });

  it("names one, two or more empty roles in a plain sentence", () => {
    expect(emptyRolesText([])).toBe("");
    expect(emptyRolesText(["Light vibrant"])).toBe("No color fits the Light vibrant role.");
    expect(emptyRolesText(["Dark vibrant", "Light vibrant"])).toBe(
      "No color fits the Dark vibrant or Light vibrant roles.",
    );
    expect(emptyRolesText(["Vibrant", "Dark vibrant", "Light vibrant"])).toBe(
      "No color fits the Vibrant, Dark vibrant or Light vibrant roles.",
    );
  });

  it("renders as a muted hint only while a role is empty", () => {
    expect(renderToString(h(EmptyRolesNote, {}))).toBe("");
    emptyRoles.value = ["Dark vibrant", "Light vibrant"];
    const html = renderToString(h(EmptyRolesNote, {}));
    expect(html).toContain('class="hint"');
    expect(html).toContain("No color fits the Dark vibrant or Light vibrant roles.");
  });
});
