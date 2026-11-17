import preact from "@preact/preset-vite";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

// The site is served from /<repo-name>/ on GitHub Pages (spec 7.8).
const base = process.env.BASE_PATH ?? "/palette-studio/";

// Content Security Policy from spec 7.8. GitHub Pages can't set headers, so it is a meta tag.
// Build only: the dev server's hot reload needs looser rules.
const CSP =
  "default-src 'self'; img-src 'self' blob: data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'";

function cspMeta(): Plugin {
  return {
    name: "palette-studio:csp-meta",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const charset = /<meta charset="utf-8" \/>/;
        if (!charset.test(html))
          throw new Error("index.html must start its head with a charset meta");
        return html.replace(
          charset,
          (m) => `${m}\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
        );
      },
    },
  };
}

export default defineConfig({
  base,
  plugins: [preact(), cspMeta()],
  build: {
    target: "es2022",
    // Spec 7.10: keep each bundled dependency's licence notice in the build output.
    license: { fileName: "licenses.md" },
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
