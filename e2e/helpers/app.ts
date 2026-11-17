import type { Page, TestInfo } from "@playwright/test";

/** URL of the mockup state, relative to the base URL. */
export const demo = (query = ""): string => `./?demo=mockup${query ? `&${query}` : ""}`;

export const isPhoneProject = (info: TestInfo): boolean => info.project.name.startsWith("phone");

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function box(page: Page, selector: string): Promise<Box> {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`No box for ${selector}`);
  return b;
}

/** True when the page scrolls sideways. */
export async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
}

/** Resolves a token to its computed color through a probe element. */
export async function tokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement("div");
    probe.style.setProperty("color", `var(${name})`);
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, token);
}

export const PHONE_SIZES: ReadonlyArray<{ width: number; height: number }> = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];
