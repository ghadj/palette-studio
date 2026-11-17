import preact from "@preact/preset-vite";
import { defineConfig } from "vitest/config";

// The site is served from /<repo-name>/ on GitHub Pages (spec 7.8).
const base = process.env.BASE_PATH ?? "/palette-studio/";

export default defineConfig({
  base,
  plugins: [preact()],
  build: {
    target: "es2022",
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
