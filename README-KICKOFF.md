# Kickoff kit for Claude Code

Copy everything in this folder into the root of your new repository, then commit.

```
CLAUDE.md                             Project memory: rules, stack, definition of done
.gitignore                            Ignores build output and visual-review artifacts

docs/SPEC.md                          The specification (v0.3), exported from the Claude Doc
docs/mockups/                         14 UI mockups (light and dark, desktop and phone) and the architecture diagram
docs/design/tokens.css                Design tokens taken from the mockups (colors, type, spacing, radii)
docs/design/ui-contract.md            The mockups as checkable rules, screen by screen and region by region
docs/design/mockup-state.md           The ?demo=mockup fixture, its library, and expected image views and paint matches
docs/design/visual-testing.md         Token tests, mockup review page and regression baselines
docs/milestones/_templates/           Plan and report templates the agents fill in

public/samples/mockup-scene.png       Fixture image for the mockup state
public/samples/mockup-paints.csv      Fictional demo paints for the mockup state
public/samples/mockup-library-*.png   Images for the two other projects in the demo library

.claude/agents/milestone-analyst.md   Plans one milestone (read-only, except for the plan file)
.claude/agents/implementer.md         Builds the approved plan, test first, with a visual self-check
.claude/agents/evaluator.md           Verifies independently, including against the mockups; never edits code
.claude/skills/milestone/SKILL.md     /milestone M<n>: plan, approval, build, evaluation, fix loop, visual sign-off
.claude/settings.json                 Lets test and build commands run without prompts
```

## Start

1. Create the GitHub repository (public, MIT) and clone it.
2. Copy this kit into the root and commit it as "Add spec, design contract and Claude Code setup".
3. Open a terminal in the repository and run `claude`.
4. Pick the product name (spec section 10), then run `/milestone M1`.

M1 also sets up the visual checks: tokens, the mockup state, the token test, the review page and the CI jobs. If the analyst's plan runs past about ten tasks, ask it to split M1 into:
- **M1a:** scaffold, CI, deploy, tokens, themes and visual tooling
- **M1b:** image loading and the first extraction

## How the result is kept matching the mockups

1. Components use only the tokens in `docs/design/tokens.css`. An automated test fails if any UI color, font size or radius isn't a token, or a phone touch target is under 44 px.
2. The app opens in a fixed state, `?demo=mockup`, that reproduces the mockups' content.
3. Screenshots in that state go on a review page beside the mockups. The evaluator checks them region by region against `docs/design/ui-contract.md`, and you sign off.
4. Approved screenshots become CI baselines, so later changes can't drift unnoticed.

Delete this file once you've started.
