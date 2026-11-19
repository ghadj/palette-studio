/** Colors of the generated fixtures (tools/make-fixtures.ts), shared with the tests that check them. */
export const TWO_COLOR = { major: "#1DB07A", minor: "#5039B0" };
export const SINGLE_COLOR = "#14386B";
/** white-background.png: 80% white with a 20% disk (spec 8 "mostly white background"; M2-T8). */
export const WHITE_BACKGROUND = { background: "#FFFFFF", disk: "#E8693A" };
/** grayscale-plus-red.png: a gray ramp with one red band, 20% of the rows (spec 8; M2-T8). */
export const GRAYSCALE_RED = "#FF0000";
export const TWELVE_COLORS = [
  "#E6194B",
  "#3CB44B",
  "#FFE119",
  "#4363D8",
  "#F58231",
  "#911EB4",
  "#46F0F0",
  "#F032E6",
  "#BCF60C",
  "#008080",
  "#9A6324",
  "#000075",
];

/**
 * studio-backdrop.png (spec 8; M2-T9): a 400 × 300 #ECEAE6 backdrop with a centered 200 × 150
 * subject, its left half #14386B and its right half #E8693A, and a 10 × 10 #ECEAE6 patch enclosed
 * in the #14386B half. Ignore background removes the backdrop but keeps the patch (decision 4).
 */
export const STUDIO_BACKDROP = {
  width: 400,
  height: 300,
  backdrop: "#ECEAE6",
  subject: { x: 100, y: 75, width: 200, height: 150, left: "#14386B", right: "#E8693A" },
  patch: { x: 145, y: 145, width: 10, height: 10 },
} as const;

const inside = (x: number, y: number, r: { x: number; y: number; width: number; height: number }) =>
  x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height;

/** The color of studio-backdrop.png at pixel (x, y). */
export function studioBackdropColor(x: number, y: number): string {
  const { subject, patch, backdrop } = STUDIO_BACKDROP;
  if (inside(x, y, patch) || !inside(x, y, subject)) return backdrop;
  return x < subject.x + subject.width / 2 ? subject.left : subject.right;
}
