# Palette Studio

A client-side tool: load an image, extract a palette, edit it, build gradients and export them. It runs entirely in the browser as a static site on GitHub Pages. Images are never uploaded.

The specification is [docs/SPEC.md](docs/SPEC.md).

## Commands

| Command | What it does |
| --- | --- |
| `npm ci` | Install the pinned dependencies |
| `npm run dev` | Start the Vite dev server |
| `npm run lint` | Lint and check formatting with Biome |
| `npm run format` | Format the code with Biome |
| `npm run typecheck` | Type-check with strict TypeScript |
| `npm test` | Run the Vitest unit tests |
| `npm run e2e` | Build, preview and run the Playwright end-to-end tests |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run visual:review` | Screenshot every screen and write `artifacts/visual-review/index.html` |
| `npx tsx tools/make-samples.ts` | Regenerate the three sample images in `public/samples/` |
| `npx tsx tools/make-fixtures.ts` | Regenerate the image fixtures in `tests/fixtures/` |

The site is built for the `/palette-studio/` base path. Set `BASE_PATH` to build for another path, for example `BASE_PATH=/ npm run build`.

Playwright needs its browsers once: `npx playwright install`.

## License

MIT, see [LICENSE](LICENSE).
