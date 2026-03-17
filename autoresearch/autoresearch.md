# Autoresearch: Journal Microapp Quality

## Objective

Improve the overall quality of the Symbient Journal microapp — visual design,
interaction feel, and architectural integrity. The agent modifies the module source,
restarts the app in tmux, captures a screenshot, and scores against a fixed rubric.

The primary metric is a self-scored `ui_score` (1–10, higher is better),
averaged from three sub-axes. The agent sees the screenshot via the Read tool
and scores against the rubric below.

## Metrics

- **Primary**: `ui_score` (unitless, higher is better) — average of three sub-scores
- **Secondary**: `craft`, `usability`, `integrity` (each 1–10)

## How to Run

```
cd autoresearch && ./autoresearch.sh
```

Restarts app in tmux `journal`, waits for health, opens journal, captures PNG
screenshot to `scratch/autoresearch-screenshot.png`. Agent then uses Read tool
on the PNG to score it.

## Files in Scope

| File | Purpose |
|------|---------|
| `microapps/journal/index.ts` | Journal microapp — all UI and logic |

That is the ONLY file you may modify. Do not touch theme files, other
modules, core shell code, or SDK internals.

## Off Limits

- `src/` — shell internals
- `microapps/` other than journal
- Theme files
- SDK source (`src/services/microapp-sdk.ts`)
- `scripts/` — build/infra scripts
- `autoresearch.sh`, `autoresearch.checks.sh` — experiment infra

## Constraints

- `bun run typecheck` must pass (enforced by autoresearch.checks.sh)
- Module must load and journal window must appear in /state (enforced by checks)
- No new npm dependencies
- All SDK imports must come from `../../src/services/microapp-sdk.js`
- Use theme tokens via `host.theme()`, never hardcode colours
- Keyboard shortcuts must keep working (S toggle, m model, j/k nav, Enter, n/e/d)

## Scoring Rubric

After `run_experiment`, use the Read tool on `scratch/autoresearch-screenshot.png`.
Score each axis 1–10:

### CRAFT (aesthetic + character + coherence)

Does this feel like one designed thing with personality — or random widgets?

- Colour harmony within theme tokens, visual interest, deliberate composition
- Consistent spacing, alignment, visual language across both JRN and LOG views
- Personality, charm, WibWob-ness — feels crafted and distinctive, not scaffolded
- Figlet typography used well, not just dumped. Whitespace is deliberate
- Both views feel like siblings — same design language, different content

### USABILITY (layout + readability + interaction)

Can you use this effectively? Would a human enjoy browsing their journal here?

- Text legibility, appropriate contrast, clear visual hierarchy
- Labels and values easy to scan — kind icons, peer glyphs, time-ago labels
- Keyboard shortcuts discoverable (command bar hints), responsive to input
- Two-pane layout balanced — list vs preview proportions feel right
- Mode toggle (JRN/LOG) obvious and immediate — no confusion about current state
- Session browser useful — model tags, message counts, role colours aid scanning
- Works at both narrow (<120) and wide (≥120) breakpoints

### INTEGRITY (COAT + DRY + state completeness)

Would this work if you deleted the TUI and only had the API?

- `describeState()` reports everything an API consumer needs: viewMode, entry/session
  counts, selected item, search state, model filter, available commands
- Commands in catalog cover full CRUD + session access — no hand-wired shortcuts
- No duplicated logic — storage, filtering, sorting each have one owner
- Snapshot serialize/restore preserves viewMode and selection
- Session parsing is efficient — no re-reading files unnecessarily
- Entry shape is clean — no orphan fields, no stringly-typed enums

### Scoring

`ui_score = (CRAFT + USABILITY + INTEGRITY) / 3`

Report all three sub-scores as secondary metrics in `log_experiment`.

### Scoring Discipline

- Score against the rubric, not against your expectations of what you changed
- Compare to baseline screenshot if available (`scratch/autoresearch-baseline.png`)
- A score of 5 = competent default. Below 5 = actively bad. Above 7 = genuinely good.
- Do not inflate scores. A 10 means you cannot imagine how to improve that axis.
- If the window failed to render or is broken, score 0 on all axes.

## SDK Components Available

| Family | Components |
|--------|-----------|
| Layout | createStack, createRow, createGrid, createNodePart, pickBreakpoint, createScrollViewport |
| Chrome | createHeaderBar, createStatusBar, createButtonBar, createBorderedPanel, createSidebarPanel, createRule |
| Content | createTextBlock, createFigletDisplay, createMessageHistory, createContentStack |
| Navigation | createTabs, createSelectableList, createInlineSearch |
| Forms | createInputLine, createButton, createCheckbox, createRadioGroup, createSelect |
| Data | createKeyValuePanel, createLogView, createDataTable |
| Feedback | createProgressBar, createSpinner |
| Animation | createAnimationClock, tween, EASINGS |

Full reference: `.agents/microapp-dev/sdk-reference.md`

## Terminal Design Principles

- TYPOGRAPHY: figlet for headers, consistent alignment
- COLOUR: theme tokens only (`host.theme()`), accent for emphasis, muted for secondary
- COMPOSITION: createStack/createRow for layout, responsive via pickBreakpoint
- RHYTHM: consistent gaps, deliberate whitespace, visual breathing room
- DENSITY: terminal cells are precious — use them wisely

## What's Been Tried

### Baseline (pre-autoresearch)
- JRN/LOG toggle added as plain boxes (focusable:false) — SDK buttons broke keyboard
- Model extraction from session JSONL, m key to cycle filter
- describeState fixed from hardcoded "journal" to actual viewMode
- Both views render with date headers, role colours, tool call summaries
- Known issues: could be more polished, LOG preview is raw dump, code has some repetition

### Experiment #1 (keep, 6.7): cleaner toggle, readable LOG, COAT commands
- LOG preview: filter out toolResult noise, only human/assistant messages
- COAT: added toggle-view and filter-model commands, modelFilter in describeState

### Experiment #2 (keep, 7.2): view-specific figlet, model breakdown, empty state
- JRNL figlet for journal, LOGS figlet for sessions — instant mode cue
- Tagline model breakdown (opus-4-6:2) in LOG view
- Box-drawn empty state card with kind icons
