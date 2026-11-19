/**
 * Color-vision-deficiency simulation (spec 3.5; plan D6).
 *
 * Protanopia, deuteranopia and tritanopia use the severity 1.0 matrices of Machado, Oliveira and
 * Fernandes, "A Physiologically-based Model for Simulation of Color Vision Deficiency", IEEE TVCG
 * 15(6), 2009 (the published tables at
 * https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html).
 * They apply to linear sRGB and the result is clipped to the sRGB gamut. Achromatopsia is the
 * Rec. 709 relative luminance gray, Y = 0.2126 R + 0.7152 G + 0.0722 B in linear light.
 */
import { type LinearRgb, linearToSrgb, type Rgb, srgbToLinear } from "./convert";

export type CvdType = "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia";

type Matrix = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

export const CVD_MATRICES: Readonly<Record<"protanopia" | "deuteranopia" | "tritanopia", Matrix>> =
  {
    protanopia: [
      [0.152286, 1.052583, -0.204868],
      [0.114503, 0.786281, 0.099216],
      [-0.003882, -0.048116, 1.051998],
    ],
    deuteranopia: [
      [0.367322, 0.860646, -0.227968],
      [0.280085, 0.672501, 0.047413],
      [-0.01182, 0.04294, 0.968881],
    ],
    tritanopia: [
      [1.255528, -0.076749, -0.178779],
      [-0.078411, 0.930809, 0.147602],
      [0.004733, 0.691367, 0.3039],
    ],
  };

export const CVD_TYPES: ReadonlyArray<{ id: CvdType; label: string }> = [
  { id: "protanopia", label: "Protanopia" },
  { id: "deuteranopia", label: "Deuteranopia" },
  { id: "tritanopia", label: "Tritanopia" },
  { id: "achromatopsia", label: "Achromatopsia" },
];

const clip = (v: number): number => Math.min(1, Math.max(0, v));

/** Simulates a linear sRGB color. Not clipped (achromatopsia cannot leave the gamut anyway). */
export function simulateLinear(c: LinearRgb, type: CvdType): LinearRgb {
  if (type === "achromatopsia") {
    const y = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    return { r: y, g: y, b: y };
  }
  const m = CVD_MATRICES[type];
  return {
    r: m[0][0] * c.r + m[0][1] * c.g + m[0][2] * c.b,
    g: m[1][0] * c.r + m[1][1] * c.g + m[1][2] * c.b,
    b: m[2][0] * c.r + m[2][1] * c.g + m[2][2] * c.b,
  };
}

/** Simulates an sRGB (0..1) color: to linear, matrix, clip, back to sRGB. */
export function simulateCvd(c: Rgb, type: CvdType): Rgb {
  const s = simulateLinear(srgbToLinear(c), type);
  return linearToSrgb({ r: clip(s.r), g: clip(s.g), b: clip(s.b) });
}
