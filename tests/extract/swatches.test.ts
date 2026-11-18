import { describe, expect, it } from "vitest";
import { oklabToHex } from "../../src/color/convert";
import { buildHistogram } from "../../src/extract/histogram";
import { extractPalette } from "../../src/extract/pipeline";
import {
  missingRoles,
  pickRoles,
  type RoleCandidate,
  SWATCH_ROLES,
  swatchRoles,
} from "../../src/extract/swatches";
import { SPEC_DEFAULT_SETTINGS } from "../../src/state/defaults";
import type { ExtractionSettings, WorkingSpace } from "../../src/types";
import { image, pixels, row } from "./helpers";

const settings = (patch: Partial<ExtractionSettings> = {}): ExtractionSettings => ({
  ...SPEC_DEFAULT_SETTINGS,
  algorithm: "swatch-roles",
  ...patch,
});
const named = (out: ReturnType<typeof extractPalette>) =>
  out.map((c) => [c.name, oklabToHex(c.lab)] as const);
const SPACES: WorkingSpace[] = ["oklab", "cielab", "linear-srgb", "srgb"];

/** Every role's HSL target (M2 decision 10a, the Vibrant.js windows). */
const TARGETS: Record<(typeof SWATCH_ROLES)[number], { s: number; l: number }> = {
  Vibrant: { s: 1, l: 0.5 },
  Muted: { s: 0.3, l: 0.5 },
  "Dark vibrant": { s: 1, l: 0.26 },
  "Dark muted": { s: 0.3, l: 0.26 },
  "Light vibrant": { s: 1, l: 0.74 },
  "Light muted": { s: 0.3, l: 0.74 },
};

describe("swatch roles (Vibrant.js windows; spec 2.2, M2 decision 10)", () => {
  it("lists the six roles in order: Vibrant, Muted, Dark vibrant, Dark muted, Light vibrant, Light muted", () => {
    expect(SWATCH_ROLES).toEqual([
      "Vibrant",
      "Muted",
      "Dark vibrant",
      "Dark muted",
      "Light vibrant",
      "Light muted",
    ]);
  });

  it("six candidates placed exactly on each role's targets map to their roles, in role order, with role names", () => {
    // Shuffled, so the order of the result comes from the roles and not from the input.
    const order = [
      "Light muted",
      "Dark vibrant",
      "Muted",
      "Light vibrant",
      "Vibrant",
      "Dark muted",
    ];
    const candidates: RoleCandidate[] = order.map((role) => ({
      ...TARGETS[role as keyof typeof TARGETS],
      population: 1,
    }));
    const picked = pickRoles(candidates);
    expect(picked.map((p) => p.role)).toEqual([...SWATCH_ROLES]);
    for (const p of picked) expect(order[p.index], p.role).toBe(p.role);

    // The same through the pipeline: six flat colors at the targets (red hue), named by role.
    const flat = {
      Vibrant: "#FF0000",
      Muted: "#A65959",
      "Dark vibrant": "#850000",
      "Dark muted": "#562E2E",
      "Light vibrant": "#FF7A7A",
      "Light muted": "#D1A9A9",
    };
    const img = row(pixels(Object.values(flat).map((hex) => [hex, 10] as [string, number])));
    for (const workingSpace of SPACES) {
      const h = buildHistogram(img.data, { space: workingSpace });
      const out = swatchRoles(h, workingSpace);
      expect(
        out.map((c) => c.role),
        workingSpace,
      ).toEqual([...SWATCH_ROLES]);
      const result = extractPalette(img, settings({ workingSpace }));
      expect(new Map(named(result)), workingSpace).toEqual(new Map(Object.entries(flat)));
    }
  });

  it("a grayscale image leaves the vibrant roles empty and returns only filled roles", () => {
    const ramp = image(256, 8, (x) => {
      const v = x.toString(16).padStart(2, "0");
      return `#${v}${v}${v}`;
    });
    const h = buildHistogram(ramp.data);
    const roles = swatchRoles(h, "oklab").map((c) => c.role);
    expect(roles).toEqual(["Muted", "Dark muted", "Light muted"]);
    const out = extractPalette(ramp, settings());
    expect(out.map((c) => c.name).sort()).toEqual(["Dark muted", "Light muted", "Muted"]);
    expect(missingRoles(out.map((c) => c.name ?? ""))).toEqual([
      "Vibrant",
      "Dark vibrant",
      "Light vibrant",
    ]);
  });

  it("no candidate is used twice", () => {
    // S 0.7 and L 0.4 fits both Vibrant and Dark vibrant: Vibrant claims it, Dark vibrant stays empty.
    expect(pickRoles([{ s: 0.7, l: 0.4, population: 1 }])).toEqual([{ role: "Vibrant", index: 0 }]);
    // Many candidates that fit several windows each.
    const candidates: RoleCandidate[] = [];
    for (let i = 0; i < 40; i += 1) {
      candidates.push({
        s: ((i * 37) % 100) / 100,
        l: ((i * 53) % 100) / 100,
        population: 1 + (i % 7),
      });
    }
    const picked = pickRoles(candidates);
    expect(picked.length).toBeGreaterThan(3);
    expect(new Set(picked.map((p) => p.index)).size).toBe(picked.length);
    expect(new Set(picked.map((p) => p.role)).size).toBe(picked.length);
  });

  it("each role's pick lies inside its windows and scores by saturation 3, lightness 6, population 1", () => {
    // Two Vibrant candidates: the one nearer the targets wins over a more populous one only when
    // the weighted mean says so.
    const near = { s: 0.95, l: 0.5, population: 1 };
    const crowd = { s: 0.6, l: 0.5, population: 10 };
    // near: (3 × 0.95 + 6 × 1 + 1 × 0.1) / 10 = 0.895; crowd: (3 × 0.6 + 6 × 1 + 1 × 1) / 10 = 0.88.
    expect(pickRoles([crowd, near])[0]).toEqual({ role: "Vibrant", index: 1 });
    const far = { s: 0.4, l: 0.5, population: 10 };
    // far: (3 × 0.4 + 6 + 1) / 10 = 0.82 < near's 0.895.
    expect(pickRoles([far, near])[0]).toEqual({ role: "Vibrant", index: 1 });
    // S 0.37 at L 0.5 fits both Vibrant (min 0.35) and Muted (max 0.4). Vibrant picks first, as
    // in Vibrant.js, so Muted stays empty.
    expect(pickRoles([{ s: 0.37, l: 0.5, population: 1 }])).toEqual([
      { role: "Vibrant", index: 0 },
    ]);
    // S 0.2 at L 0.5 fits Muted only; at L 0.75 Light muted only; at L 0.1 Dark muted only.
    expect(pickRoles([{ s: 0.2, l: 0.5, population: 1 }])).toEqual([{ role: "Muted", index: 0 }]);
    expect(pickRoles([{ s: 0.2, l: 0.75, population: 1 }])).toEqual([
      { role: "Light muted", index: 0 },
    ]);
    expect(pickRoles([{ s: 0.2, l: 0.1, population: 1 }])).toEqual([
      { role: "Dark muted", index: 0 },
    ]);
  });

  it("ignores Colors, merge threshold, keep one outlier and vividness (decision 10c)", () => {
    const img = image(64, 16, (x) => (x < 20 ? "#FF0000" : x < 40 ? "#562E2E" : "#D1A9A9"));
    const base = extractPalette(img, settings());
    expect(base.length).toBe(3);
    for (const patch of [
      { colors: 2 },
      { colors: 12 },
      { mergeThreshold: 0.15 },
      { keepOutlier: true },
      { vividness: 1 },
    ]) {
      expect(extractPalette(img, settings(patch)), JSON.stringify(patch)).toEqual(base);
    }
  });

  it("deterministic", () => {
    const img = image(48, 32, (x, y) => {
      const r = (x * 5).toString(16).padStart(2, "0");
      const g = (y * 7).toString(16).padStart(2, "0");
      return `#${r}${g}80`;
    });
    const a = extractPalette(img, settings());
    expect(a.length).toBeGreaterThan(1);
    expect(extractPalette(img, settings())).toEqual(a);
    expect(extractPalette(img, settings({ seed: 99 }))).toEqual(a);
  });

  it("stable on single-color, two-color and fully transparent inputs in every working space (spec 8)", () => {
    const single = row(pixels([["#14386B", 100]]));
    const two = row(
      pixels([
        ["#1DB07A", 75],
        ["#5039B0", 25],
      ]),
    );
    const clear = row(pixels([["#FFFFFF", 50, 0]]));
    for (const workingSpace of SPACES) {
      const s = settings({ workingSpace });
      // #14386B is S 0.685, L 0.249: dark and vivid.
      const one = extractPalette(single, s);
      expect(named(one), workingSpace).toEqual([["Dark vibrant", "#14386B"]]);
      expect(one[0]?.population).toBe(1);
      // #1DB07A (S 0.717, L 0.402) is the better Vibrant; #5039B0 (L 0.457) is too light for
      // Dark vibrant and too vivid for the muted roles, so it fills no role.
      expect(named(extractPalette(two, s)), workingSpace).toEqual([["Vibrant", "#1DB07A"]]);
      expect(extractPalette(clear, s), workingSpace).toEqual([]);
    }
    expect(missingRoles([])).toEqual([...SWATCH_ROLES]);
  });
});
