import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import { describe, expect, it } from "vitest";
import { App } from "../src/ui/App";

describe("smoke", () => {
  it("Vitest runs with strict TS and Preact JSX", () => {
    const html = renderToString(h(App, {}));
    expect(html).toContain('id="app-root"');
  });
});
