import { showToast } from "./Toast";

export const COMING_SOON = "Coming in a later version";

/**
 * Every control for a later feature calls this (M1 decision 6): the control sits in its final
 * place and is tappable, and a tap explains that the feature isn't built yet.
 */
export function comingSoon(): void {
  showToast(COMING_SOON);
}
