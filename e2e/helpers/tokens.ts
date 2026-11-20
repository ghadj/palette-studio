/**
 * Token conformance checker (visual-testing.md section 1). It resolves every color token through a
 * hidden probe element (reading the custom property directly returns the unresolved light-dark()
 * text), then walks the rendered DOM outside [data-user-content] and reports any color, font size
 * or corner radius that isn't a token, and any phone control smaller than 44 × 44 px.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";

/** Allowed font sizes in px (visual-testing.md). Never add values to make a test pass. */
export const FONT_SIZES = [12, 13, 15, 16, 20] as const;
/** Allowed corner radii in px, besides a pill (visual-testing.md). */
export const RADII = [0, 6, 8, 10, 12] as const;
export const MIN_TOUCH = 44;

/** Every color custom property declared in src/styles/tokens.css. */
export function colorTokenNames(): string[] {
  const css = readFileSync(resolve(process.cwd(), "src/styles/tokens.css"), "utf8");
  const names = new Set<string>();
  for (const [, name] of css.matchAll(
    /(--(?:color|marker|grid-line|surround|checker)-[a-z-]+)\s*:/g,
  )) {
    if (name) names.add(name);
  }
  return [...names];
}

export interface Failure {
  kind: "color" | "font-size" | "radius" | "touch-target";
  selector: string;
  property: string;
  value: string;
}

export interface CheckOptions {
  /** Check touch targets (phone width). */
  touchTargets: boolean;
}

export async function checkTokens(page: Page, options: CheckOptions): Promise<Failure[]> {
  return page.evaluate(
    ({ tokens, fontSizes, radii, minTouch, touchTargets }) => {
      const failures: Failure[] = [];

      // 1. Resolve tokens through probes, per property, so serializations match.
      const colorProps = [
        "color",
        "background-color",
        "border-top-color",
        "border-right-color",
        "border-bottom-color",
        "border-left-color",
      ];
      const allowed = new Set<string>(["rgba(0, 0, 0, 0)", "transparent"]);
      const probe = document.createElement("div");
      probe.setAttribute("aria-hidden", "true");
      probe.style.setProperty("position", "absolute");
      probe.style.setProperty("visibility", "hidden");
      probe.style.setProperty("border-style", "solid");
      document.body.appendChild(probe);
      for (const token of tokens) {
        for (const prop of colorProps) {
          probe.style.setProperty(prop, `var(${token})`);
          allowed.add(getComputedStyle(probe).getPropertyValue(prop));
          probe.style.removeProperty(prop);
        }
      }
      probe.remove();

      // 2. Walk the rendered DOM.
      const selectorPath = (el: Element): string => {
        const parts: string[] = [];
        let node: Element | null = el;
        while (node && node !== document.documentElement) {
          let part = node.tagName.toLowerCase();
          if (node.id) part += `#${node.id}`;
          const classes = Array.from(node.classList).slice(0, 2);
          if (classes.length) part += `.${classes.join(".")}`;
          const parent: Element | null = node.parentElement;
          if (parent) {
            const same = Array.from(parent.children).filter((c) => c.tagName === node?.tagName);
            if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
          }
          parts.unshift(part);
          node = parent;
        }
        return parts.join(" > ");
      };

      const rendered = (el: Element): boolean => {
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        return el.getClientRects().length > 0;
      };

      const radiusOk = (value: string, box: DOMRect): boolean => {
        const px = value.split(" ").map((v) => Number.parseFloat(v));
        return px.every((r) => {
          if (Number.isNaN(r)) return false;
          if (radii.includes(r)) return true;
          // A pill: the radius reaches half of the shorter side (999px in tokens.css).
          return r >= 999 || r >= Math.min(box.width, box.height) / 2 - 0.5;
        });
      };

      const isControl = (el: Element): boolean => {
        if (el.matches("button, a[href], select, textarea, summary")) return true;
        if (el instanceof HTMLInputElement) return el.type !== "hidden";
        const role = el.getAttribute("role");
        return role === "tab" || role === "button" || role === "menuitemradio" || role === "link";
      };

      const visit = (el: Element, insideUserContent: boolean) => {
        if (!rendered(el)) return;
        const userContent = insideUserContent || el.hasAttribute("data-user-content");
        const style = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        if (!userContent) {
          for (const prop of colorProps) {
            const value = style.getPropertyValue(prop);
            if (
              prop.startsWith("border") &&
              style.getPropertyValue(`${prop.replace("-color", "-style")}`) === "none"
            )
              continue;
            if (!allowed.has(value))
              failures.push({ kind: "color", selector: selectorPath(el), property: prop, value });
          }
          const size = Number.parseFloat(style.fontSize);
          if (!fontSizes.includes(size))
            failures.push({
              kind: "font-size",
              selector: selectorPath(el),
              property: "font-size",
              value: style.fontSize,
            });
          for (const corner of [
            "border-top-left-radius",
            "border-top-right-radius",
            "border-bottom-right-radius",
            "border-bottom-left-radius",
          ]) {
            const value = style.getPropertyValue(corner);
            if (!radiusOk(value, box))
              failures.push({
                kind: "radius",
                selector: selectorPath(el),
                property: corner,
                value,
              });
          }
        }
        // Touch targets apply to every control, including swatches in user content.
        // A box measured through a transform can come out a hair under its CSS size (43.99999 for
        // 44, seen in Linux WebKit under the sheet's slide-in), so allow rounding noise only.
        const noise = 0.05;
        if (
          touchTargets &&
          isControl(el) &&
          (box.width < minTouch - noise || box.height < minTouch - noise)
        ) {
          failures.push({
            kind: "touch-target",
            selector: selectorPath(el),
            property: "size",
            value: `${Math.round(box.width * 10) / 10} × ${Math.round(box.height * 10) / 10}`,
          });
        }
        for (const child of Array.from(el.children)) visit(child, userContent);
      };
      visit(document.body, false);
      return failures;
    },
    {
      tokens: colorTokenNames(),
      fontSizes: [...FONT_SIZES] as number[],
      radii: [...RADII] as number[],
      minTouch: MIN_TOUCH,
      touchTargets: options.touchTargets,
    },
  );
}

export const describeFailures = (failures: Failure[]): string =>
  failures.map((f) => `${f.kind}: ${f.selector} ${f.property} = ${f.value}`).join("\n");
