/**
 * Generates the three built-in sample images in public/samples (spec 6.3 "First visit"; M1
 * decision 9): abstract gradients and shapes, made here so there are no licensing questions.
 *
 * Usage: tsx tools/make-samples.ts
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { encodePng, hexBytes } from "./png";

const W = 960;
const H = 640;
const SS = 3; // supersampling per axis, for smooth shape edges

type Rgb = [number, number, number];
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

function render(shade: (x: number, y: number) => Rgb): Uint8Array {
  const out = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const c = shade((x + (sx + 0.5) / SS) / W, (y + (sy + 0.5) / SS) / H);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const i = (y * W + x) * 3;
      out[i] = Math.round(r / (SS * SS));
      out[i + 1] = Math.round(g / (SS * SS));
      out[i + 2] = Math.round(b / (SS * SS));
    }
  }
  return out;
}

// Dunes: warm sky gradient over layered sine-wave bands.
const dunes = () => {
  const sky: [Rgb, Rgb] = [hexBytes("#2E3A6B"), hexBytes("#F2A65A")];
  const bands = ["#E07A3F", "#C4553A", "#8E3B46", "#4A2C40"].map(hexBytes);
  return render((x, y) => {
    let c = mix(sky[0], sky[1], clamp01(y / 0.55));
    for (const [i, band] of bands.entries()) {
      const edge = 0.42 + i * 0.13 + 0.05 * Math.sin(x * Math.PI * (2 + i) + i * 1.7);
      if (y > edge)
        c = mix(band, bands[Math.min(i + 1, bands.length - 1)] ?? band, clamp01((y - edge) * 1.5));
    }
    const sun = Math.hypot((x - 0.72) * 1.5, y - 0.28);
    if (sun < 0.09) c = hexBytes("#FBE3A1");
    return c;
  });
};

// Tiles: flat colored squares on an off-white ground.
const tiles = () => {
  const colors = ["#1F6FB2", "#F2C14E", "#D1495B", "#2A9D8F", "#3D348B", "#F78154"].map(hexBytes);
  const ground = hexBytes("#F4F1EA");
  return render((x, y) => {
    const cols = 6;
    const rows = 4;
    const cx = x * cols;
    const cy = y * rows;
    const fx = cx - Math.floor(cx);
    const fy = cy - Math.floor(cy);
    if (fx < 0.12 || fx > 0.88 || fy < 0.12 || fy > 0.88) return ground;
    const i = (Math.floor(cx) + Math.floor(cy) * 2) % colors.length;
    return colors[i] ?? ground;
  });
};

// Orbits: a deep radial gradient with three soft-edged discs.
const orbits = () => {
  const inner = hexBytes("#1B7F79");
  const outer = hexBytes("#0D1B2A");
  const discs: Array<[number, number, number, Rgb]> = [
    [0.3, 0.42, 0.17, hexBytes("#FF6B6B")],
    [0.62, 0.6, 0.12, hexBytes("#FFD166")],
    [0.78, 0.3, 0.08, hexBytes("#EF8FB8")],
  ];
  return render((x, y) => {
    let c = mix(inner, outer, clamp01(Math.hypot((x - 0.5) * 1.5, y - 0.5) / 0.75));
    for (const [dx, dy, r, color] of discs) {
      const d = Math.hypot((x - dx) * 1.5, y - dy);
      if (d < r) c = mix(color, c, clamp01((d - r * 0.85) / (r * 0.15)));
    }
    return c;
  });
};

export const SAMPLES = [
  { file: "sample-dunes.png", make: dunes },
  { file: "sample-tiles.png", make: tiles },
  { file: "sample-orbits.png", make: orbits },
];

for (const { file, make } of SAMPLES) {
  const png = encodePng(W, H, make(), 3);
  writeFileSync(resolve(process.cwd(), "public/samples", file), png);
  process.stdout.write(`${file}: ${(png.length / 1024).toFixed(1)} kB\n`);
}
