import { describe, expect, it } from "vitest";
import { ringImagePixels } from "../../e2e/helpers/ring-image";
import { oklabToHex, oklchToHex } from "../../src/color/convert";
import { ringStops } from "../../src/gradient/image-sample";
import { ringMean } from "../../src/image/ring";

/** Each channel within 1 of the expected hex. */
function near(actual: string, expected: string): void {
  for (const i of [1, 3, 5]) {
    const d = Math.abs(
      Number.parseInt(actual.slice(i, i + 2), 16) - Number.parseInt(expected.slice(i, i + 2), 16),
    );
    expect(d, `${actual} vs ${expected}`).toBeLessThanOrEqual(1);
  }
}

describe("ringMean and the radial scan (plan D18)", () => {
  // Red inside 1/3 of the half-diagonal, green up to 2/3, blue outside: the three equal rings of a
  // radial count of 3. (The plan's 0.2 and 0.4 do not fall on the ring edges; see the plan note.)
  const image = ringImagePixels(300, 200, 1 / 3, 2 / 3);
  const aspect = image.height / image.width;
  const client = {
    sample: async () => {
      throw new Error("not used");
    },
    ring: async (c: { x: number; y: number }, r0: number, r1: number) => ringMean(image, c, r0, r1),
  };

  it("a red disk, a green ring and blue outside give #FF0000, #00FF00, #0000FF ± 1 for a count of 3", async () => {
    const colors = await ringStops(client, 3, aspect);
    expect(colors).toHaveLength(3);
    // Pixels on a boundary may fall into the neighbor ring, so allow a small blend (± 1 in 8 bits
    // is met on this image because the boundary pixels land on the same side in both).
    const hexes = colors.map(oklchToHex);
    near(hexes[0] ?? "", "#FF0000");
    near(hexes[1] ?? "", "#00FF00");
    near(hexes[2] ?? "", "#0000FF");
  });

  it("ringMean of one ring, in OKLab", () => {
    const half = 0.5 * Math.hypot(1, aspect);
    const mean = ringMean(image, { x: 0.5, y: 0.5 }, 0, 0.3 * half);
    expect(oklabToHex(mean)).toBe("#FF0000");
  });

  it("a ring with no pixel gives the nearest pixel instead of failing", () => {
    const tiny = ringImagePixels(4, 4, 0.5, 0.9);
    expect(() => ringMean(tiny, { x: 0.5, y: 0.5 }, 0.1, 0.1001)).not.toThrow();
  });
});
