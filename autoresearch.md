# Symbient Journal — Autoresearch Brief

## Objective

Build out the Symbient Journal microapp from barebones MVP through a 5-version
feature plan, while maintaining high TUI visual quality throughout.

The primary metric combines **feature completeness** and **UI quality** into
a single `journal_score` (0–100, higher is better).

## Primary Metric

`journal_score = feature_score (0–60) + ui_score (0–40)`

### Feature score (60 pts max)

Checked programmatically by `autoresearch.sh`. Each feature either exists or doesn't.

| Version | Points | Features |
|---------|--------|----------|
| MVP (baseline) | 10 | manifest, entry point, .jsonl persist, input line, lifecycle hooks, system entries |
| v1 Agent parity | 12 | journal.append command, peer distinction, auto-scroll, structured describeState |
| v2 Rich rendering | 12 | day dividers, keyboard nav, search/filter, relative timestamps, word-wrap |
| v3 Persistence | 10 | workspace persist, registerSnapshot, multiple journals, markdown export |
| v4 Provenance | 8 | entry types, tags, actor metadata, collapsible groups, status bar |
| v5 Composition | 8 | patchbay-ready state, ambient mode, summarize command, linked entries |

### UI score (40 pts max)

Self-scored from PNG screenshot against 5 axes, each 1–8, summed.

| Axis | Max | What it measures |
|------|-----|-----------------|
| LAYOUT | 8 | Use of space, balance, no dead zones, responsive, clear visual grouping |
| READABILITY | 8 | Text legibility, contrast, clear hierarchy, easy to scan |
| AESTHETIC | 8 | Colour harmony within theme, visual interest, deliberate appearance |
| COHERENCE | 8 | Feels like one designed thing, consistent spacing/alignment/language |
| CHARACTER | 8 | Personality, charm, WibWob-ness, crafted vs generic |

## How to Run

```bash
bash autoresearch.sh
```

1. Reloads microapps (no restart needed for microapp-only changes)
2. Opens the Journal window
3. Runs programmatic feature checks → `feature_score`
4. Captures PNG screenshot → agent scores UI axes
5. Agent computes `journal_score = feature_score + ui_score`

## Scoring Discipline

- Score UI against the rubric, not against expectations of what changed
- A UI axis score of 4 = competent default. Below 3 = actively bad. Above 6 = genuinely good.
- 8 means you cannot imagine how to improve that axis.
- If the window failed to render, score 0 on all UI axes.
- Feature checks are binary — the feature works or it doesn't. No partial credit.

## Files in Scope

- `microapps/journal/microapp.json` — manifest
- `microapps/journal/index.ts` — entry point (may split into multiple files)

## Off Limits

- `src/` — shell internals
- Other `microapps/` directories
- Theme files, SDK source, scripts

## Constraints

- `bun run typecheck` must pass (no new journal errors)
- Module must load after `microapps.reload`
- No new npm dependencies
- All imports from `../../src/services/microapp-sdk.js`
- Use `host.theme()` tokens, never hardcode colours
- Existing `scratch/journal.jsonl` entries must still load after changes

## Rules

1. One feature per iteration — small slices, each scored
2. Don't skip versions — each builds on the previous
3. Features must actually work, not just exist as dead code
4. Backward compatible — old .jsonl entries always load
5. SDK-only imports
6. All lifecycle hooks required

## Iteration Order

### v1 — Agent parity
1. `journal.append` direct command
2. Peer visual distinction (color/prefix)
3. Auto-scroll + structured describeState

### v2 — Rich rendering
4. Day dividers between entries
5. Keyboard nav j/k/g/G
6. Search/filter by peer or text
7. Relative timestamps + word-wrap

### v3 — Persistence
8. persist:true + registerSnapshot
9. Multiple journal support
10. Markdown export command

### v4 — Provenance
11. Entry types (observation/decision/discovery/question/note)
12. Tags + actor metadata
13. Collapsible groups + status bar

### v5 — Composition
14. Patchbay-ready describeState
15. Ambient mode (compact window)
16. Summarize command
17. Linked entries

## Terminal Design Principles

- TYPOGRAPHY: figlet for headers where appropriate, consistent alignment
- COLOUR: theme tokens only, accent for emphasis, muted for secondary
- COMPOSITION: createStack/createRow for layout, responsive via pickBreakpoint
- RHYTHM: consistent gaps, deliberate whitespace, visual breathing room
- DENSITY: terminal cells are precious — use wisely, no wasted space

## SDK Components Available

| Family | Components |
|--------|-----------|
| Layout | createStack, createRow, createGrid, createNodePart, pickBreakpoint, createScrollViewport |
| Chrome | createHeaderBar, createStatusBar, createButtonBar, createBorderedPanel, createRule |
| Content | createTextBlock, createFigletDisplay, createMessageHistory, createContentStack |
| Navigation | createTabs, createSelectableList, createInlineSearch |
| Forms | createInputLine, createButton, createCheckbox, createRadioGroup, createSelect |
| Data | createKeyValuePanel, createLogView, createDataTable |
| Feedback | createProgressBar, createSpinner |
| Animation | createAnimationClock, tween, EASINGS |
