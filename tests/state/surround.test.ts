import { describe, expect, it } from "vitest";
import { resolveInitialSurround, SURROUND_STORAGE_KEY } from "../../src/state/surround";

function storage(value: string | null) {
  const reads: string[] = [];
  return {
    reads,
    getItem(key: string) {
      reads.push(key);
      return key === SURROUND_STORAGE_KEY ? value : null;
    },
  };
}

describe("surround setting (spec 6.2)", () => {
  it("the demo never reads or writes storage", () => {
    const s = storage("black");
    const r = resolveInitialSurround("?demo=mockup", s);
    expect(s.reads).toEqual([]);
    expect(r).toEqual({ value: "theme", persist: false });
  });

  it("the URL parameter wins in the demo", () => {
    const s = storage("white");
    expect(resolveInitialSurround("?demo=mockup&surround=mid-gray", s).value).toBe("mid-gray");
    expect(resolveInitialSurround("?demo=mockup&surround=bogus", s).value).toBe("theme");
    expect(s.reads).toEqual([]);
  });

  it("outside the demo the stored value counts and bad values fall back to theme", () => {
    expect(resolveInitialSurround("", storage("black"))).toEqual({ value: "black", persist: true });
    expect(resolveInitialSurround("?surround=white", storage(null)).value).toBe("theme");
    expect(resolveInitialSurround("", storage("nope")).value).toBe("theme");
  });

  it("a throwing storage falls back to theme", () => {
    const bad = {
      getItem(): string | null {
        throw new Error("blocked");
      },
    };
    expect(resolveInitialSurround("", bad).value).toBe("theme");
  });
});
