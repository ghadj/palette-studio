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

/** Resolves a length token to pixels through a probe element. */
export async function tokenPx(page: Page, token: string): Promise<number> {
  return page.evaluate((name) => {
    const probe = document.createElement("div");
    probe.style.setProperty("width", `var(${name})`);
    document.body.appendChild(probe);
    const value = Number.parseFloat(getComputedStyle(probe).width);
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

/**
 * Makes the phone page long enough to scroll, without opening a drawer: the Source and Palette
 * tabs' collapsed rows are bottom sheets below 1024 px (M3 decision 34), so they no longer
 * lengthen the page. The spacer sits after the panel, outside the app's own nodes.
 */
export async function addScrollSpace(page: Page, px = 1400): Promise<void> {
  await page.evaluate((height) => {
    const spacer = document.createElement("div");
    spacer.setAttribute("data-testid", "test-scroll-space");
    spacer.style.height = `${height}px`;
    (document.querySelector("[data-panel]") ?? document.body).append(spacer);
  }, px);
}

/** Switches to a phone tab; does nothing in the three-column layout, where every panel shows. */
export async function showTab(page: Page, name: "Source" | "Palette"): Promise<void> {
  const bar = page.getByTestId("tabbar");
  if ((await bar.count()) === 0) return;
  await bar.getByRole("tab", { name }).click();
}
