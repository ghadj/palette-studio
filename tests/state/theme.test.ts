import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { resolveInitialTheme, THEME_STORAGE_KEY, type ThemeChoice } from "../../src/state/theme";

function storage(value: string | null) {
  const reads: string[] = [];
  return {
    reads,
    getItem(key: string) {
      reads.push(key);
      return key === THEME_STORAGE_KEY ? value : null;
    },
  };
}

/** Runs public/theme-init.js against a fake document and returns the data-theme it set. */
function runThemeInit(search: string, stored: string | null) {
  const attrs: Record<string, string> = {};
  const metas = [
    { media: "(prefers-color-scheme: light)", content: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", content: "#171717" },
  ].map((m) => ({
    ...m,
    getAttribute(name: string) {
      return name === "media" ? m.media : null;
    },
    setAttribute(name: string, value: string) {
      if (name === "content") this.content = value;
    },
  }));
  const store = storage(stored);
  const writes: string[] = [];
  const context = {
    location: { search },
    localStorage: {
      getItem: store.getItem,
      setItem: (k: string) => writes.push(k),
      removeItem: (k: string) => writes.push(k),
    },
    document: {
      documentElement: {
        setAttribute: (name: string, value: string) => {
          attrs[name] = value;
        },
      },
      querySelectorAll: () => metas,
    },
    URLSearchParams,
  };
  const code = readFileSync(resolve(__dirname, "../../public/theme-init.js"), "utf8");
  runInNewContext(code, context);
  return { theme: attrs["data-theme"], reads: store.reads, writes, metas };
}

describe("theme resolution (spec 6.2)", () => {
  it("stored 'dark' resolves to data-theme dark", () => {
    expect(resolveInitialTheme("", storage("dark"))).toEqual({ choice: "dark", persist: true });
    expect(resolveInitialTheme("", storage("light")).choice).toBe("light");
    expect(runThemeInit("", "dark").theme).toBe("dark");
  });

  it("missing or invalid stored value resolves to System (no data-theme)", () => {
    for (const value of [null, "", "purple", "System", "{}"]) {
      expect(resolveInitialTheme("", storage(value)).choice).toBe<ThemeChoice>("system");
      expect(runThemeInit("", value).theme).toBeUndefined();
    }
    expect(resolveInitialTheme("", storage("system")).choice).toBe("system");
    // A storage that throws (for example, blocked cookies) also falls back to System.
    const throwing = {
      getItem(): string | null {
        throw new Error("blocked");
      },
    };
    expect(resolveInitialTheme("", throwing).choice).toBe("system");
  });

  it("demo=mockup&theme=light resolves to light without reading storage", () => {
    const store = storage("dark");
    expect(resolveInitialTheme("?demo=mockup&theme=light", store)).toEqual({
      choice: "light",
      persist: false,
    });
    expect(store.reads).toEqual([]);
    // Without a theme param, demo mode follows the device and still never reads storage.
    expect(resolveInitialTheme("?demo=mockup", store)).toEqual({
      choice: "system",
      persist: false,
    });
    expect(store.reads).toEqual([]);

    const init = runThemeInit("?demo=mockup&theme=light", "dark");
    expect(init.theme).toBe("light");
    expect(init.reads).toEqual([]);
    expect(init.writes).toEqual([]);
  });

  it("theme-init.js points both theme-color metas at the chosen theme's surface", () => {
    const dark = runThemeInit("", "dark");
    expect(dark.metas.map((m) => m.content)).toEqual(["#171717", "#171717"]);
    const system = runThemeInit("", null);
    expect(system.metas.map((m) => m.content)).toEqual(["#ffffff", "#171717"]);
  });
});
