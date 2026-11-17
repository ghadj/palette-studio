import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, showToast, Toast, toast } from "../../src/ui/Toast";

describe("toasts (spec 6.3; evaluator note 7)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    dismissToast();
    vi.useRealTimers();
  });

  it("a plain toast hides itself after a few seconds", () => {
    showToast("Copied HEX");
    vi.advanceTimersByTime(3999);
    expect(toast.value?.text).toBe("Copied HEX");
    vi.advanceTimersByTime(1);
    expect(toast.value).toBeNull();
  });

  it("a toast with an action stays until it is dismissed, and has a close button", () => {
    const run = vi.fn();
    showToast("Couldn't copy the CSS: the clipboard isn't available.", { label: "Download", run });
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(toast.value?.action?.label).toBe("Download");
    const html = renderToString(h(Toast, {}));
    expect(html).toContain(">Download</button>");
    expect(html).toMatch(/<button[^>]*aria-label="Dismiss"/);
    dismissToast();
    expect(toast.value).toBeNull();
  });

  it("a later plain toast replaces a persistent one and hides on its own", () => {
    showToast("Couldn't copy.", { label: "Download", run: () => undefined });
    showToast("Copied HEX");
    vi.advanceTimersByTime(4000);
    expect(toast.value).toBeNull();
  });
});
