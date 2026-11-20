# Palette Studio

Client-side tool: load an image, extract a palette, edit it, build gradients, export them, and (Part 2) match the palette to real paints. Static site on GitHub Pages. No backend, no uploads.

## Source of truth

- `docs/SPEC.md` is the specification. Read the sections a task touches before writing code. Cite section numbers (for example "spec 3.7") in plans, commits and reports.
- `docs/mockups/` holds the UI mockups (light and dark, desktop and phone) and the architecture diagram.
- `docs/design/` turns the mockups into rules:
  - `tokens.css`: colors, type, spacing, radii, sizes
  - `ui-contract.md`: screen by screen, region by region
  - `mockup-state.md`: the `?demo=mockup` fixture
  - `visual-testing.md`: how the UI is checked against the mockups
- If the spec is silent, ambiguous or contradicts itself, stop and ask. Never invent product behavior. Never edit `docs/SPEC.md` unless the user asks.

## Stack (spec 7.1 to 7.3)

- Vite, strict TypeScript, Preact with `@preact/signals`, Vitest, Playwright, Biome, culori.
- Heavy pixel work runs in module Web Workers (spec 7.4). The UI thread never loops over image pixels.
- Color math lives in `src/color/`. Work in OKLab and OKLCH; output sRGB (spec 2.3, 7.9).
- Keep the repository layout in spec 7.3.

## Commands

Fill these in once M1 has scaffolded the project:

- Dev: `npm run dev`
- Lint and format: `npm run lint`
- Type-check: `npm run typecheck`
- Unit tests: `npm test`
- End-to-end tests: `npm run e2e`
- Production build: `npm run build`
- Visual review page: `npm run visual:review` (writes `artifacts/visual-review/index.html`)

## Rules that are easy to break

- No network requests after load except same-origin files. No analytics, CDNs, web fonts or cookies (spec 7.8).
- No inline scripts or styles in HTML, because the Content Security Policy forbids them (spec 7.8). The theme script is `public/theme-init.js`.
- Build every URL from `import.meta.env.BASE_URL`, since the site is served from `/<repo-name>/`.
- UI styles use only the variables in `src/styles/tokens.css`, copied from `docs/design/tokens.css`: no literal colors, font sizes or radii in components. Mark user content (image, swatches, gradients, paint chips, the grid overlay) with `data-user-content`; it is never themed (spec 6.2).
- Build layouts from `docs/design/ui-contract.md`, not by measuring the mockup images. Its intended deviations D1 to D11 are deliberate.
- Keep `?demo=mockup` working on every screen. It must never read or write autosave or the project library (spec 5.5).
- Never update visual baselines yourself. They change only through the `visual-baselines.yml` workflow, after the user approves the review page.
- Touch targets are at least 44 px. No feature depends on hover. Test at 320 px wide (spec 6.1).
- Exported numbers use a period as the decimal separator under any locale (spec 5).
- Never commit paint catalogue data unless its terms allow redistribution. Never bundle Mixbox (spec 7.10).

## Definition of done for any task

1. The code matches the referenced spec sections.
2. Unit tests cover new logic. Color math is checked against reference values.
3. Lint, type-check, unit tests and build all pass.
4. UI changes work in both themes and at phone width, pass the token conformance tests, and look right on the visual review page next to the mockups.
5. One commit per task. The message starts with the task id, for example `M3-T2: drag sample points`.

## Milestone workflow

Run `/milestone M<n>`. It uses three subagents in `.claude/agents/`:

- `milestone-analyst` writes `docs/milestones/M<n>/plan.md`.
- You approve the plan.
- `implementer` builds it task by task.
- `evaluator` checks the result independently and returns a report, saved as `docs/milestones/M<n>/report.md`.
