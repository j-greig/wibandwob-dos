# Autoresearch: LLM Orch Studio UI Quality

## Objective

Improve the visual quality of the LLM Orch Studio microapp window in
WibWob-DOS. The agent modifies the module source, restarts the app,
captures a screenshot, and scores the UI against a fixed rubric.

The primary metric is a self-scored ui_score (1-10, higher is better),
averaged from five sub-axes. The agent sees the screenshot via the
Read tool and scores against the rubric below.

## Metrics

- **Primary**: ui_score (unitless, higher is better) — average of five sub-scores
- **Secondary**: layout, readability, aesthetic, coherence, character (each 1-10)

## How to Run

```
./autoresearch.sh
```

Restarts app in tmux, waits for health, captures PNG screenshot to
scratch/autoresearch-screenshot.png. Agent then uses Read tool on
the PNG to score it.

## Files in Scope

- `microapps/llm-orch-studio/index.ts` — the module source (layout, components, styling)

That is the ONLY file you may modify. Do not touch theme files, other
modules, core shell code, or SDK internals.

## Off Limits

- `src/` — shell internals
- `microapps/` other than llm-orch-studio
- Theme files
- SDK source (`src/services/microapp-sdk.ts`)
- `scripts/` — build/infra scripts
- `autoresearch.sh`, `autoresearch.checks.sh` — experiment infra

## Constraints

- `bun run typecheck` must pass (enforced by autoresearch.checks.sh)
- Module must load and window must appear in /state (enforced by checks)
- No new npm dependencies
- All SDK imports must come from `../../src/services/microapp-sdk.js`
- Use theme tokens via `host.theme()`, never hardcode colours

## Scoring Rubric

After run_experiment, use the Read tool on scratch/autoresearch-screenshot.png.
Score each axis 1-10:

  LAYOUT      — Use of space, balance, no dead zones, no overlaps,
                responsive to window size, clear visual grouping
  READABILITY — Text legibility, appropriate contrast, clear hierarchy,
                labels and values easy to scan
  AESTHETIC   — Colour harmony within theme tokens, visual interest,
                deliberate rather than accidental appearance
  COHERENCE   — Feels like one designed thing, not random widgets.
                Consistent spacing, alignment, visual language
  CHARACTER   — Personality, charm, WibWob-ness. Does it feel crafted
                and distinctive, or generic and scaffolded?

ui_score = (LAYOUT + READABILITY + AESTHETIC + COHERENCE + CHARACTER) / 5

Report all five sub-scores as secondary metrics in log_experiment.

## Scoring Discipline

- Score against the rubric, not against your expectations of what you changed
- Compare to baseline screenshot if available (scratch/autoresearch-baseline.png)
- A score of 5 = competent default. Below 5 = actively bad. Above 7 = genuinely good.
- Do not inflate scores. A 10 means you cannot imagine how to improve that axis.
- If the window failed to render or is broken, score 0 on all axes.

## SDK Components Available

| Family     | Components |
|------------|-----------|
| Layout     | createStack, createRow, createGrid, createNodePart, pickBreakpoint, createScrollViewport |
| Chrome     | createHeaderBar, createStatusBar, createButtonBar, createBorderedPanel, createSidebarPanel, createRule |
| Content    | createTextBlock, createFigletDisplay, createMessageHistory, createContentStack |
| Navigation | createTabs, createSelectableList, createInlineSearch |
| Forms      | createInputLine, createButton, createCheckbox, createRadioGroup, createSelect |
| Data       | createKeyValuePanel, createLogView, createDataTable |
| Feedback   | createProgressBar, createSpinner |
| Animation  | createAnimationClock, tween, EASINGS |

Full reference: `.agents/microapp-dev/sdk-reference.md`
Example modules to study for patterns:
- `microapps/demo-e026-demo/` — SDK sampler, many component patterns
- `microapps/demo-heartbeat/` — animated, clean timer/cleanup
- `microapps/demo-wibwob-poetry-clock/` — AI integration, modes

## Terminal Design Principles

- TYPOGRAPHY: figlet for headers where appropriate, consistent alignment
- COLOUR: theme tokens only (host.theme()), accent for emphasis, muted for secondary
- COMPOSITION: createStack/createRow for layout, responsive via pickBreakpoint
- RHYTHM: consistent gaps, deliberate whitespace, visual breathing room
- DENSITY: terminal cells are precious — use them wisely, no wasted space

## What's Been Tried

- Baseline (3.6): generic scaffold, no personality
- #2 keep (5.0): figlet header, horizontal action bar, compact settings, status banner
- #4 keep (5.6): subtitle, idle placeholder messages
- #5 keep (5.8): compact 1-row topic, turns to right, tighter proportions
- #8 keep (6.6): responsive window sizing, wider column gap
- #12 keep (7.4): animated pulse in status banner
- #13 keep (7.8): dual figlet headers (LLM ORCH slant + STUDIO small muted)
- #14 keep (8.0): remove help text, 1-unit breathing room, severity colours, keyWidth:10

Key insights:
- CHARACTER: figlet + ASCII art + personality text + animation
- AESTHETIC: structural whitespace, populated idle state, severity colours
- LAYOUT: responsive sizing, remove redundancy, deliberate gaps
- READABILITY: remove noise, severity hierarchy, aligned key-value
- GOTCHA: unicode box-drawing in labels → dashes. Seed logView AFTER layout().
- GOTCHA: gap:1 on left stack adds breathing between ALL children not just last
