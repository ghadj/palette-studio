/** Angle helpers for the gradient geometry (spec 4.3; plan M4-T6, D21). 0 is up, turning clockwise, as in CSS. */

/** The preset chips: every 45 degrees. */
export const ANGLE_PRESETS: readonly number[] = [0, 45, 90, 135, 180, 225, 270, 315];

/** An angle in [0, 360). */
export function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/** The angle of a screen vector (y grows downward): up is 0, right is 90. */
export function angleFromVector(dx: number, dy: number): number {
  return normalizeAngle((Math.atan2(dx, -dy) * 180) / Math.PI);
}
